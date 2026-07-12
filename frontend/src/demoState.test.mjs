import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEMO_STATE_VERSION,
  SAMPLE_WORKFLOW,
  createAutoDemoMessageFields,
  hydrateDemoState,
  initialDemoState
} from './demoState.js'

test('hydrateDemoState resets stale local state from older UI versions', () => {
  const stale = {
    text: 'legacy browser message',
    workflowJson: '{"nodes":[]}',
    automationId: 'old-automation'
  }

  const state = hydrateDemoState(JSON.stringify(stale))

  assert.equal(state._version, DEMO_STATE_VERSION)
  assert.equal(state.text, initialDemoState.text)
  assert.equal(state.automationId, '')
  assert.match(state.workflowJson, /How can I help you today/)
})

test('hydrateDemoState preserves current-version state', () => {
  const saved = {
    ...initialDemoState,
    _version: DEMO_STATE_VERSION,
    automationId: 'automation-123',
    text: 'custom order check'
  }

  const state = hydrateDemoState(JSON.stringify(saved))

  assert.equal(state.automationId, 'automation-123')
  assert.equal(state.text, 'custom order check')
})

test('sample workflow gives every non-end node an outgoing edge', () => {
  const outgoing = new Set(SAMPLE_WORKFLOW.edges.map((edge) => edge.from))
  const missingOutgoing = SAMPLE_WORKFLOW.nodes
    .filter((node) => node.type !== 'END')
    .filter((node) => !outgoing.has(node.id))
    .map((node) => node.id)

  assert.deepEqual(missingOutgoing, [])
})

test('auto demo message fields start a fresh non-duplicate conversation', () => {
  assert.deepEqual(createAutoDemoMessageFields(123456), {
    conversationId: '',
    messageId: 'msg-auto-2n9c',
    requestId: 'request-auto-2n9c'
  })
})
