export const DEMO_STATE_VERSION = '2026-07-09-english-demo-v2'

export const SAMPLE_WORKFLOW = {
  nodes: [
    { id: 'start', type: 'START', config: {} },
    { id: 'ask', type: 'QUESTION', config: { message: 'How can I help you today?' } },
    { id: 'lookup', type: 'ACTION', config: { action: 'ORDER_LOOKUP' } },
    { id: 'handoff', type: 'HANDOFF', config: { message: 'I will route this conversation to a support specialist.' } },
    { id: 'end', type: 'END', config: { message: 'The request has been handled.' } }
  ],
  edges: [
    { from: 'start', to: 'ask', matchType: 'ALWAYS', matchValue: '' },
    { from: 'ask', to: 'lookup', matchType: 'KEYWORD', matchValue: 'order' },
    { from: 'ask', to: 'handoff', matchType: 'KEYWORD', matchValue: 'agent' },
    { from: 'ask', to: 'end', matchType: 'FALLBACK', matchValue: '' },
    { from: 'lookup', to: 'end', matchType: 'ALWAYS', matchValue: '' },
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
  text: 'please check order A123',
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
