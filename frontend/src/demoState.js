export const DEMO_STATE_VERSION = '2026-07-13-category-demo-v4'

export const SAMPLE_WORKFLOW = {
  nodes: [
    { id: 'start', type: 'START', config: {} },
    {
      id: 'menu',
      type: 'QUESTION',
      config: {
        message: 'I can check an order, create a ticket, or route you to an agent. What do you need?',
        category: 'INTENT_MENU'
      }
    },
    {
      id: 'menu_retry',
      type: 'QUESTION',
      config: {
        message: 'I did not catch that. Choose order, ticket, or agent.',
        category: 'FALLBACK'
      }
    },
    {
      id: 'ask_order_id',
      type: 'QUESTION',
      config: {
        message: 'Please send the order code, for example A123.',
        category: 'ORDER_ID_COLLECTION'
      }
    },
    { id: 'lookup', type: 'ACTION', config: { action: 'ORDER_LOOKUP' } },
    {
      id: 'offer_update',
      type: 'QUESTION',
      config: {
        message: 'Reply update for a proactive status refresh, ticket to create a follow-up, or done.',
        category: 'FOLLOW_UP'
      }
    },
    { id: 'update_status', type: 'ACTION', config: { action: 'ORDER_STATUS_UPDATE' } },
    {
      id: 'ask_followup_category',
      type: 'QUESTION',
      config: {
        message: 'I updated the order status. What follow-up category should I file: delivery delay, address change, refund, agent, or done?',
        category: 'FOLLOW_UP_CATEGORY'
      }
    },
    { id: 'ticket', type: 'ACTION', config: { action: 'TICKET_CREATION' } },
    { id: 'handoff', type: 'HANDOFF', config: { message: 'I will route this conversation to a support specialist.' } },
    { id: 'end', type: 'END', config: { message: 'Done. I have enough information for this case.' } }
  ],
  edges: [
    { from: 'start', to: 'menu', matchType: 'ALWAYS', matchValue: '' },
    { from: 'menu', to: 'ask_order_id', matchType: 'KEYWORD', matchValue: 'order' },
    { from: 'menu', to: 'ticket', matchType: 'KEYWORD', matchValue: 'ticket' },
    { from: 'menu', to: 'handoff', matchType: 'KEYWORD', matchValue: 'agent' },
    { from: 'menu', to: 'menu_retry', matchType: 'FALLBACK', matchValue: '' },
    { from: 'menu_retry', to: 'ask_order_id', matchType: 'KEYWORD', matchValue: 'order' },
    { from: 'menu_retry', to: 'ticket', matchType: 'KEYWORD', matchValue: 'ticket' },
    { from: 'menu_retry', to: 'handoff', matchType: 'KEYWORD', matchValue: 'agent' },
    { from: 'menu_retry', to: 'menu_retry', matchType: 'FALLBACK', matchValue: '' },
    { from: 'ask_order_id', to: 'lookup', matchType: 'CONDITION', matchValue: '[a-z][0-9]{3}' },
    { from: 'ask_order_id', to: 'ask_order_id', matchType: 'FALLBACK', matchValue: '' },
    { from: 'lookup', to: 'offer_update', matchType: 'ALWAYS', matchValue: '' },
    { from: 'offer_update', to: 'update_status', matchType: 'KEYWORD', matchValue: 'update' },
    { from: 'offer_update', to: 'ticket', matchType: 'KEYWORD', matchValue: 'ticket' },
    { from: 'offer_update', to: 'end', matchType: 'KEYWORD', matchValue: 'done' },
    { from: 'offer_update', to: 'offer_update', matchType: 'FALLBACK', matchValue: '' },
    { from: 'update_status', to: 'ask_followup_category', matchType: 'ALWAYS', matchValue: '' },
    { from: 'ask_followup_category', to: 'ticket', matchType: 'KEYWORD', matchValue: 'delivery' },
    { from: 'ask_followup_category', to: 'ticket', matchType: 'KEYWORD', matchValue: 'address' },
    { from: 'ask_followup_category', to: 'ticket', matchType: 'KEYWORD', matchValue: 'refund' },
    { from: 'ask_followup_category', to: 'handoff', matchType: 'KEYWORD', matchValue: 'agent' },
    { from: 'ask_followup_category', to: 'end', matchType: 'KEYWORD', matchValue: 'done' },
    { from: 'ask_followup_category', to: 'ask_followup_category', matchType: 'FALLBACK', matchValue: '' },
    { from: 'ticket', to: 'end', matchType: 'ALWAYS', matchValue: '' },
    { from: 'handoff', to: 'end', matchType: 'ALWAYS', matchValue: '' }
  ]
}

export const initialDemoState = {
  _version: DEMO_STATE_VERSION,
  automationName: 'Order support',
  automationId: '',
  workflowVersionId: '',
  userId: 'mock-user-001',
  messageId: 'msg-001',
  requestId: 'request-ui-001',
  text: 'hello',
  conversationId: '',
  workflowJson: JSON.stringify(SAMPLE_WORKFLOW, null, 2)
}

export function createAutoDemoMessageFields(seed = Date.now()) {
  const suffix = Number(seed).toString(36)
  return {
    conversationId: '',
    messageId: `msg-auto-${suffix}`,
    requestId: `request-auto-${suffix}`
  }
}

export function createAutoDemoScript(seed = Date.now()) {
  const suffix = Number(seed).toString(36)
  return [
    {
      text: 'hello',
      messageId: `msg-auto-${suffix}-01`,
      requestId: `request-auto-${suffix}-01`,
      expect: 'Menu prompt',
      feature: 'Conversation entry and channel contract',
      flow: 'START -> menu',
      engineeringConcept: 'Client/server boundary and state-machine entry are separated from business actions.',
      evidence: 'Trace node_id=menu, customer intent=GREETING, no action execution yet.',
      conceptIds: ['rpc', 'te', 'ob']
    },
    {
      text: 'order',
      messageId: `msg-auto-${suffix}-02`,
      requestId: `request-auto-${suffix}-02`,
      expect: 'Order id follow-up',
      feature: 'Intent routing and follow-up question',
      flow: 'menu -> ask_order_id',
      engineeringConcept: 'Workflow edge matching converts user intent into the next state without calling external services.',
      evidence: 'Session current_node_id moves to ask_order_id and intent=ORDER_STATUS_REQUEST.',
      conceptIds: ['te', 'ob']
    },
    {
      text: 'A123',
      messageId: `msg-auto-${suffix}-03`,
      requestId: `request-auto-${suffix}-03`,
      expect: 'Order status lookup',
      feature: 'Order lookup action adapter',
      flow: 'ask_order_id -> lookup -> offer_update',
      engineeringConcept: 'CONDITION matching validates the order code before ACTION calls the mock external adapter.',
      evidence: 'Trace detail category=ORDER_STATUS, action_executions stores the mock adapter response.',
      conceptIds: ['rpc', 'te', 'ob']
    },
    {
      text: 'update',
      messageId: `msg-auto-${suffix}-04`,
      requestId: `request-auto-${suffix}-04`,
      expect: 'Proactive status update',
      feature: 'Automated status refresh and next best question',
      flow: 'offer_update -> update_status -> ask_followup_category',
      engineeringConcept: 'The automation proactively updates order state, then asks the next question needed for case categorization.',
      evidence: 'Trace detail category=ORDER_STATUS_UPDATE and session remains ACTIVE for the category step.',
      conceptIds: ['te', 'ob']
    },
    {
      text: 'delivery delay',
      messageId: `msg-auto-${suffix}-05`,
      requestId: `request-auto-${suffix}-05`,
      expect: 'Support category and ticket',
      feature: 'Categorized ticket creation',
      flow: 'ask_followup_category -> ticket -> end',
      engineeringConcept: 'User-provided category drives the ticket action while idempotency protects duplicate delivery.',
      evidence: 'Trace detail supportCategory=DELIVERY_DELAY, session COMPLETED, duplicate replay keeps history stable.',
      conceptIds: ['pc', 'ob', 'te']
    }
  ]
}

export function updateOperationResponses(currentResponses, target, payload) {
  const next = {
    chat: currentResponses?.chat || null,
    workflow: currentResponses?.workflow || null
  }

  if (target === 'chat') {
    return { ...next, chat: payload }
  }
  if (target === 'workflow') {
    return { ...next, workflow: payload }
  }
  return next
}

export function hydrateDemoState(rawValue) {
  if (!rawValue) {
    return initialDemoState
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (parsed?._version !== DEMO_STATE_VERSION) {
      return initialDemoState
    }
    return { ...initialDemoState, ...parsed, _version: DEMO_STATE_VERSION }
  } catch {
    return initialDemoState
  }
}
