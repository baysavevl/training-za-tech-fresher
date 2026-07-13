import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEMO_STATE_VERSION,
  SAMPLE_WORKFLOW,
  createAutoDemoMessageFields,
  createAutoDemoScript,
  hydrateDemoState,
  initialDemoState,
  updateOperationResponses
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
  assert.match(state.workflowJson, /I can check an order/)
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

test('sample workflow models the multi-turn order follow-up automation', () => {
  const nodeIds = new Set(SAMPLE_WORKFLOW.nodes.map((node) => node.id))
  const edgeKeys = new Set(SAMPLE_WORKFLOW.edges.map((edge) => `${edge.from}->${edge.to}:${edge.matchType}:${edge.matchValue}`))

  assert.equal(nodeIds.has('ask_order_id'), true)
  assert.equal(nodeIds.has('offer_update'), true)
  assert.equal(nodeIds.has('update_status'), true)
  assert.equal(nodeIds.has('ask_followup_category'), true)
  assert.equal(nodeIds.has('ticket'), true)
  assert.equal(edgeKeys.has('ask_order_id->lookup:CONDITION:[a-z][0-9]{3}'), true)
  assert.equal(edgeKeys.has('update_status->ask_followup_category:ALWAYS:'), true)
  assert.equal(edgeKeys.has('ask_followup_category->ticket:KEYWORD:delivery'), true)
})

test('auto demo message fields start a fresh non-duplicate conversation', () => {
  assert.deepEqual(createAutoDemoMessageFields(123456), {
    conversationId: '',
    messageId: 'msg-auto-2n9c',
    requestId: 'request-auto-2n9c'
  })
})

test('auto demo script sends a deterministic multi-message conversation', () => {
  const script = createAutoDemoScript(123456)

  assert.deepEqual(script.map((step) => step.text), ['hello', 'order', 'A123', 'update', 'delivery delay'])
  assert.deepEqual(script.map((step) => step.messageId), [
    'msg-auto-2n9c-01',
    'msg-auto-2n9c-02',
    'msg-auto-2n9c-03',
    'msg-auto-2n9c-04',
    'msg-auto-2n9c-05'
  ])
  assert.deepEqual(script.map((step) => step.expect), [
    'Menu prompt',
    'Order id follow-up',
    'Order status lookup',
    'Proactive status update',
    'Support category and ticket'
  ])
})

test('auto demo script explains which engineering concept each product step proves', () => {
  const script = createAutoDemoScript(123456)
  const coveredConcepts = new Set(script.flatMap((step) => step.conceptIds))

  assert.deepEqual([...coveredConcepts].sort(), ['ob', 'pc', 'rpc', 'te'])
  for (const step of script) {
    assert.ok(step.feature.length > 12, `${step.text} should name the product feature`)
    assert.match(step.flow, /->/, `${step.text} should show the workflow path`)
    assert.ok(step.engineeringConcept.length > 20, `${step.text} should explain the engineering concept`)
    assert.ok(step.evidence.length > 20, `${step.text} should show what to inspect`)
    assert.ok(step.conceptIds.length >= 1, `${step.text} should map to at least one concept`)
  }
})

test('workflow operation response does not replace the last chat response', () => {
  const chatResponse = { response: 'Order A123 dang duoc xu ly.', duplicate: false }
  const publishResponse = { id: 'workflow-version-1', status: 'PUBLISHED' }

  const next = updateOperationResponses({ chat: chatResponse, workflow: null }, 'workflow', publishResponse)

  assert.deepEqual(next.chat, chatResponse)
  assert.deepEqual(next.workflow, publishResponse)
})
