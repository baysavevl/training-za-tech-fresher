export const DEMO_STATE_VERSION = '2026-07-13-multi-turn-demo-v3'

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
      id: 'offer_ticket',
      type: 'QUESTION',
      config: {
        message: 'Do you want me to create a follow-up ticket?',
        category: 'TICKET_OFFER'
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
    { from: 'update_status', to: 'offer_ticket', matchType: 'ALWAYS', matchValue: '' },
    { from: 'offer_ticket', to: 'ticket', matchType: 'OPTION', matchValue: 'yes' },
    { from: 'offer_ticket', to: 'end', matchType: 'OPTION', matchValue: 'no' },
    { from: 'offer_ticket', to: 'offer_ticket', matchType: 'FALLBACK', matchValue: '' },
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
    { text: 'hello', messageId: `msg-auto-${suffix}-01`, requestId: `request-auto-${suffix}-01`, expect: 'Menu prompt' },
    { text: 'order', messageId: `msg-auto-${suffix}-02`, requestId: `request-auto-${suffix}-02`, expect: 'Order id follow-up' },
    { text: 'A123', messageId: `msg-auto-${suffix}-03`, requestId: `request-auto-${suffix}-03`, expect: 'Order status lookup' },
    { text: 'update', messageId: `msg-auto-${suffix}-04`, requestId: `request-auto-${suffix}-04`, expect: 'Proactive status update' },
    { text: 'yes', messageId: `msg-auto-${suffix}-05`, requestId: `request-auto-${suffix}-05`, expect: 'Ticket follow-up' }
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
