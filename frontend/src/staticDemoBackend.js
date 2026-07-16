const STORAGE_KEY = 'conversationAutomationStaticBackend'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export function shouldUseStaticDemoBackend(hostname = globalThis.location?.hostname, env = import.meta.env) {
  if (env?.VITE_STATIC_DEMO_BACKEND === 'true') {
    return true
  }
  if (env?.VITE_API_BASE_URL) {
    return false
  }
  return Boolean(hostname && !LOCAL_HOSTS.has(hostname))
}

export async function handleStaticDemoRequest(path, options = {}, storage = globalThis.localStorage) {
  const url = new URL(path, 'https://static-demo.local')
  const state = readState(storage)
  const method = (options.method || 'GET').toUpperCase()
  const body = parseBody(options.body)

  if (url.pathname === '/actuator/health' && method === 'GET') {
    return { status: 'UP', runtime: 'static-demo' }
  }

  if (url.pathname === '/api/automations' && method === 'POST') {
    const now = timestamp()
    const automation = {
      id: id(),
      accountId: body.accountId || 'training-account',
      name: body.name || 'Order support',
      enabled: true,
      activeWorkflowVersionId: null,
      createdAt: now,
      updatedAt: now
    }
    state.automations[automation.id] = automation
    writeState(storage, state)
    return automation
  }

  const workflowCreate = url.pathname.match(/^\/api\/automations\/([^/]+)\/workflows$/)
  if (workflowCreate && method === 'POST') {
    const automationId = workflowCreate[1]
    const automation = required(state.automations[automationId], 'automation not found')
    const existingVersions = Object.values(state.workflows).filter(item => item.automationId === automation.id)
    const workflow = {
      id: id(),
      automationId,
      version: existingVersions.length + 1,
      status: 'DRAFT',
      definition: body.definition,
      createdAt: timestamp(),
      publishedAt: null
    }
    state.workflows[workflow.id] = workflow
    writeState(storage, state)
    return publicWorkflow(workflow)
  }

  const workflowPublish = url.pathname.match(/^\/api\/automations\/([^/]+)\/workflows\/([^/]+)\/publish$/)
  if (workflowPublish && method === 'POST') {
    const automationId = workflowPublish[1]
    const workflowId = workflowPublish[2]
    const automation = required(state.automations[automationId], 'automation not found')
    const workflow = required(state.workflows[workflowId], 'workflow not found')
    workflow.status = 'PUBLISHED'
    workflow.publishedAt = timestamp()
    automation.activeWorkflowVersionId = workflow.id
    automation.updatedAt = timestamp()
    writeState(storage, state)
    return publicWorkflow(workflow)
  }

  if (url.pathname === '/api/mock-chat/messages' && method === 'POST') {
    const requestId = options.headers?.['X-Request-Id'] || options.headers?.['x-request-id'] || id()
    const result = processMessage(state, body, requestId)
    writeState(storage, state)
    return result
  }

  const history = url.pathname.match(/^\/api\/mock-chat\/conversations\/([^/]+)\/history$/)
  if (history && method === 'GET') {
    return { items: state.messages.filter(item => item.conversationId === history[1]) }
  }

  const session = url.pathname.match(/^\/api\/mock-chat\/conversations\/([^/]+)\/session$/)
  if (session && method === 'GET') {
    return required(state.sessions[session[1]], 'session not found')
  }

  const trace = url.pathname.match(/^\/api\/mock-chat\/conversations\/([^/]+)\/trace$/)
  if (trace && method === 'GET') {
    return { items: state.traces.filter(item => item.conversationId === trace[1]) }
  }

  const executionTrace = url.pathname.match(/^\/api\/mock-chat\/executions\/([^/]+)\/trace$/)
  if (executionTrace && method === 'GET') {
    return required(state.traces.find(item => item.id === executionTrace[1]), 'execution trace not found')
  }

  const sessionTrace = url.pathname.match(/^\/api\/mock-chat\/sessions\/([^/]+)\/trace$/)
  if (sessionTrace && method === 'GET') {
    return { items: state.traces.filter(item => item.sessionId === sessionTrace[1]) }
  }

  throw new Error(`Static demo backend does not implement ${method} ${url.pathname}`)
}

function processMessage(state, request, requestId) {
  const conversationId = request.conversationId || id()
  const conversation = state.conversations[conversationId] || {
    id: conversationId,
    userId: request.userId,
    automationId: request.automationId,
    createdAt: timestamp()
  }
  state.conversations[conversationId] = conversation

  const idempotencyKey = `${conversationId}:${request.messageId}`
  const duplicateRecord = state.idempotency[idempotencyKey]
  if (duplicateRecord) {
    const responseMessageId = typeof duplicateRecord === 'string' ? duplicateRecord : duplicateRecord.responseMessageId
    const responseMessage = required(
      state.messages.find(item => item.id === responseMessageId),
      'duplicate response message not found'
    )
    return {
      conversationId,
      sessionId: state.sessions[conversationId]?.id || null,
      executionId: typeof duplicateRecord === 'string' ? null : duplicateRecord.executionId,
      response: responseMessage.content,
      outputs: textOutputs(responseMessage.content),
      currentNodeId: state.sessions[conversationId]?.currentNodeId || null,
      responseMessageId: responseMessage.id,
      duplicate: true,
      status: 'DUPLICATE',
      errorMessage: null
    }
  }

  const automation = request.automationId
    ? required(state.automations[request.automationId], 'automation not found')
    : required(
      Object.values(state.automations).find(item =>
        item.accountId === (request.accountId || 'training-account') &&
        item.enabled &&
        item.activeWorkflowVersionId
      ),
      'active automation not found for account'
    )
  const workflow = required(state.workflows[automation.activeWorkflowVersionId], 'published workflow not found')
  let session = state.sessions[conversationId]
  if (!session) {
    session = {
      id: id(),
      conversationId,
      currentNodeId: 'start',
      status: 'ACTIVE',
      version: 0,
      updatedAt: timestamp(),
      workflowVersionId: workflow.id
    }
    state.sessions[conversationId] = session
  }

  const userMessage = message(conversationId, 'CUSTOMER', request.text, categorizeIntent(request.text), requestId)
  state.messages.push(userMessage)

  const previousNodeId = session.currentNodeId
  const outcome = withNodePath(executeStaticWorkflow(previousNodeId, request.text, state.messages, conversationId), previousNodeId)
  session = {
    ...session,
    currentNodeId: outcome.nodeId,
    status: outcome.status,
    version: session.version + 1,
    updatedAt: timestamp()
  }
  state.sessions[conversationId] = session

  const outputs = textOutputs(outcome.response)
  const botMessage = message(conversationId, 'BOT', outcome.response, null, requestId)
  state.messages.push(botMessage)
  const executionId = id()
  const trace = {
    id: executionId,
    requestId,
    messageId: request.messageId,
    conversationId,
    sessionId: session.id,
    nodeId: outcome.nodeId,
    eventType: outcome.eventType,
    detailJson: JSON.stringify({
      workflowVersionId: workflow.id,
      previousNodeId,
      currentNodeId: outcome.nodeId,
      nodePath: outcome.nodePath,
      eventType: outcome.eventType,
      outputs,
      ...(outcome.actionName ? { actionName: outcome.actionName } : {}),
      outcome: outcome.detail
    }),
    createdAt: timestamp()
  }
  state.traces.push(trace)
  state.idempotency[idempotencyKey] = {
    responseMessageId: botMessage.id,
    executionId
  }

  return {
    conversationId,
    sessionId: session.id,
    executionId,
    response: outcome.response,
    outputs,
    currentNodeId: outcome.nodeId,
    responseMessageId: botMessage.id,
    duplicate: false,
    status: 'SUCCESS',
    errorMessage: null
  }
}

function textOutputs(text) {
  return [{ type: 'TEXT', text }]
}

function withNodePath(outcome, previousNodeId) {
  const actionNodeId = actionNodeFor(outcome.detail?.category)
  const nodePath = [previousNodeId]
  if (actionNodeId) {
    nodePath.push(actionNodeId)
  }
  if (nodePath.at(-1) !== outcome.nodeId) {
    nodePath.push(outcome.nodeId)
  }
  return {
    ...outcome,
    nodePath,
    actionName: actionNodeId ? actionNameFor(actionNodeId) : null
  }
}

function actionNodeFor(category) {
  if (category === 'ORDER_STATUS') return 'lookup'
  if (category === 'ORDER_STATUS_UPDATE') return 'update_status'
  if (category === 'TICKET_CREATION') return 'ticket'
  return null
}

function actionNameFor(nodeId) {
  if (nodeId === 'lookup') return 'ORDER_LOOKUP'
  if (nodeId === 'update_status') return 'ORDER_STATUS_UPDATE'
  if (nodeId === 'ticket') return 'TICKET_CREATION'
  return null
}

function executeStaticWorkflow(currentNodeId, input, messages, conversationId) {
  const normalized = normalize(input)
  const orderId = extractOrderId(input) || extractOrderId(transcript(messages, conversationId)) || 'UNKNOWN'

  if (currentNodeId === 'start') {
    return question('menu', 'I can check an order, create a ticket, or route you to an agent. What do you need?', 'INTENT_MENU')
  }
  if (currentNodeId === 'menu' || currentNodeId === 'menu_retry') {
    if (normalized.includes('order')) {
      return question('ask_order_id', 'Please send the order code, for example A123.', 'ORDER_ID_COLLECTION')
    }
    if (normalized.includes('ticket')) {
      return ticket(orderId, supportCategory(input))
    }
    if (normalized.includes('agent')) {
      return question('end', 'I will route this conversation to a support specialist.', 'HANDOFF')
    }
    return question('menu_retry', 'I did not catch that. Choose order, ticket, or agent.', 'FALLBACK')
  }
  if (currentNodeId === 'ask_order_id') {
    if (extractOrderId(input)) {
      return {
        nodeId: 'offer_update',
        status: 'ACTIVE',
        eventType: 'ACTION_EXECUTED',
        response: `Order ${orderId} is PACKING. Reply update for the latest status, ticket to create a follow-up, or done.`,
        detail: { category: 'ORDER_STATUS', orderId, status: 'PACKING', nextQuestion: 'update|ticket|done' }
      }
    }
    return question('ask_order_id', 'Please send the order code, for example A123.', 'ORDER_ID_COLLECTION')
  }
  if (currentNodeId === 'offer_update') {
    if (normalized.includes('update')) {
      return {
        nodeId: 'ask_followup_category',
        status: 'ACTIVE',
        eventType: 'ACTION_EXECUTED',
        response: `Update: order ${orderId} moved from PACKING to SHIPPING. What follow-up category should I file: delivery delay, address change, refund, agent, or done?`,
        detail: {
          category: 'ORDER_STATUS_UPDATE',
          orderId,
          previousStatus: 'PACKING',
          status: 'SHIPPING',
          nextQuestion: 'delivery delay|address change|refund|agent|done'
        }
      }
    }
    if (normalized.includes('ticket')) {
      return ticket(orderId, 'GENERAL_SUPPORT')
    }
    if (normalized.includes('done')) {
      return end('Done. I have enough information for this case.')
    }
    return question('offer_update', 'Reply update for a proactive status refresh, ticket to create a follow-up, or done.', 'FOLLOW_UP')
  }
  if (currentNodeId === 'ask_followup_category') {
    if (normalized.includes('agent')) {
      return question('end', 'I will route this conversation to a support specialist.', 'HANDOFF')
    }
    if (normalized.includes('done')) {
      return end('Done. I have enough information for this case.')
    }
    if (['delivery', 'delay', 'shipping', 'address', 'refund'].some(keyword => normalized.includes(keyword))) {
      return ticket(orderId, supportCategory(input))
    }
    return question(
      'ask_followup_category',
      'I updated the order status. What follow-up category should I file: delivery delay, address change, refund, agent, or done?',
      'FOLLOW_UP_CATEGORY'
    )
  }
  return end('Done. I have enough information for this case.')
}

function question(nodeId, response, category) {
  return {
    nodeId,
    status: nodeId === 'end' ? 'COMPLETED' : 'ACTIVE',
    eventType: nodeId === 'end' ? 'END' : 'QUESTION',
    response,
    detail: { category, node: nodeId }
  }
}

function ticket(orderId, category) {
  return {
    nodeId: 'end',
    status: 'COMPLETED',
    eventType: 'ACTION_EXECUTED',
    response: `Ticket TCK-1001 was created for order ${orderId} with category ${category}. A support specialist can follow up with the right playbook.`,
    detail: { category: 'TICKET_CREATION', orderId, ticketId: 'TCK-1001', supportCategory: category, status: 'CREATED' }
  }
}

function end(response) {
  return {
    nodeId: 'end',
    status: 'COMPLETED',
    eventType: 'END',
    response,
    detail: { category: 'END', node: 'end' }
  }
}

function categorizeIntent(input) {
  const normalized = normalize(input)
  if (!normalized) return 'UNKNOWN'
  if (['yes', 'y', 'co'].includes(normalized)) return 'AFFIRMATION'
  if (['no', 'n', 'khong'].includes(normalized)) return 'NEGATION'
  if (normalized === 'hello' || normalized === 'hi' || normalized.includes('xin chao')) return 'GREETING'
  if (normalized.includes('agent') || normalized.includes('nhan vien')) return 'HUMAN_AGENT_REQUEST'
  if (normalized.includes('ticket')) return 'TICKET_REQUEST'
  if (normalized.includes('update') || normalized.includes('cap nhat')) return 'STATUS_UPDATE_REQUEST'
  if (['delivery', 'delay', 'shipping', 'address', 'refund'].some(keyword => normalized.includes(keyword))) {
    return 'SUPPORT_CATEGORY_PROVIDED'
  }
  if (extractOrderId(input)) return 'ORDER_ID_PROVIDED'
  if (normalized.includes('order') || normalized.includes('don hang') || normalized.includes('status')) {
    return 'ORDER_STATUS_REQUEST'
  }
  return 'UNKNOWN'
}

function supportCategory(input) {
  const normalized = normalize(input)
  if (normalized.includes('delivery') || normalized.includes('delay') || normalized.includes('shipping')) {
    return 'DELIVERY_DELAY'
  }
  if (normalized.includes('address')) {
    return 'ADDRESS_CHANGE'
  }
  if (normalized.includes('refund')) {
    return 'REFUND_REQUEST'
  }
  return 'GENERAL_SUPPORT'
}

function extractOrderId(input) {
  return String(input || '').match(/\b([A-Z][0-9]{3,})\b/i)?.[1]?.toUpperCase() || ''
}

function transcript(messages, conversationId) {
  return messages
    .filter(item => item.conversationId === conversationId)
    .map(item => item.content)
    .join('\n')
}

function message(conversationId, senderType, content, intent, traceId) {
  return {
    id: id(),
    conversationId,
    senderType,
    content,
    intent,
    traceId,
    createdAt: timestamp()
  }
}

function publicWorkflow(workflow) {
  return {
    id: workflow.id,
    automationId: workflow.automationId,
    version: workflow.version,
    status: workflow.status,
    createdAt: workflow.createdAt,
    publishedAt: workflow.publishedAt
  }
}

function readState(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (raw) {
      return { ...emptyState(), ...JSON.parse(raw) }
    }
  } catch {
    return emptyState()
  }
  return emptyState()
}

function writeState(storage, state) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(state))
}

function emptyState() {
  return {
    automations: {},
    workflows: {},
    conversations: {},
    sessions: {},
    messages: [],
    traces: [],
    idempotency: {}
  }
}

function parseBody(body) {
  if (!body) {
    return {}
  }
  return typeof body === 'string' ? JSON.parse(body) : body
}

function normalize(input) {
  return String(input || '').trim().toLowerCase()
}

function required(value, message) {
  if (!value) {
    throw new Error(message)
  }
  return value
}

function id() {
  return globalThis.crypto?.randomUUID?.() || `id-${Math.random().toString(36).slice(2)}`
}

function timestamp() {
  return new Date().toISOString()
}
