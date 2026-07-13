import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SAMPLE_WORKFLOW, createAutoDemoScript } from './demoState.js'
import { handleStaticDemoRequest, shouldUseStaticDemoBackend } from './staticDemoBackend.js'

class MemoryStorage {
  constructor() {
    this.values = new Map()
  }

  getItem(key) {
    return this.values.get(key) || null
  }

  setItem(key, value) {
    this.values.set(key, value)
  }
}

test('static demo backend activates on hosted static domains without an API base URL', () => {
  assert.equal(shouldUseStaticDemoBackend('localhost', {}), false)
  assert.equal(shouldUseStaticDemoBackend('training-demo.vercel.app', {}), true)
  assert.equal(shouldUseStaticDemoBackend('training-demo.vercel.app', { VITE_API_BASE_URL: 'https://api.example.com' }), false)
  assert.equal(shouldUseStaticDemoBackend('localhost', { VITE_STATIC_DEMO_BACKEND: 'true' }), true)
})

test('static demo backend runs the categorized automation flow and duplicate replay', async () => {
  const storage = new MemoryStorage()
  const automation = await request('/api/automations', {
    method: 'POST',
    body: JSON.stringify({ name: 'Order support' })
  }, storage)
  const workflow = await request(`/api/automations/${automation.id}/workflows`, {
    method: 'POST',
    body: JSON.stringify({ definition: SAMPLE_WORKFLOW })
  }, storage)
  await request(`/api/automations/${automation.id}/workflows/${workflow.id}/publish`, { method: 'POST' }, storage)

  let conversationId = null
  let response = null
  for (const step of createAutoDemoScript(123456)) {
    response = await request('/api/mock-chat/messages', {
      method: 'POST',
      headers: { 'X-Request-Id': step.requestId },
      body: JSON.stringify({
        userId: 'mock-user-001',
        conversationId,
        messageId: step.messageId,
        automationId: automation.id,
        text: step.text
      })
    }, storage)
    conversationId = response.conversationId
  }

  assert.match(response.response, /Ticket TCK-1001/)
  assert.match(response.response, /DELIVERY_DELAY/)
  assert.equal(response.currentNodeId, 'end')
  assert.equal(response.duplicate, false)

  const history = await request(`/api/mock-chat/conversations/${conversationId}/history`, {}, storage)
  const trace = await request(`/api/mock-chat/conversations/${conversationId}/trace`, {}, storage)
  const session = await request(`/api/mock-chat/conversations/${conversationId}/session`, {}, storage)

  assert.equal(history.items.length, 10)
  assert.deepEqual(history.items.filter(item => item.senderType === 'CUSTOMER').map(item => item.intent), [
    'GREETING',
    'ORDER_STATUS_REQUEST',
    'ORDER_ID_PROVIDED',
    'STATUS_UPDATE_REQUEST',
    'SUPPORT_CATEGORY_PROVIDED'
  ])
  assert.equal(trace.items.length, 5)
  assert.match(trace.items.at(-1).detailJson, /"supportCategory":"DELIVERY_DELAY"/)
  assert.equal(session.status, 'COMPLETED')
  assert.equal(session.version, 5)

  const duplicate = await request('/api/mock-chat/messages', {
    method: 'POST',
    headers: { 'X-Request-Id': 'request-auto-2n9c-05-duplicate' },
    body: JSON.stringify({
      userId: 'mock-user-001',
      conversationId,
      messageId: 'msg-auto-2n9c-05',
      automationId: automation.id,
      text: 'delivery delay'
    })
  }, storage)
  const historyAfterDuplicate = await request(`/api/mock-chat/conversations/${conversationId}/history`, {}, storage)

  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.responseMessageId, response.responseMessageId)
  assert.equal(historyAfterDuplicate.items.length, 10)
})

async function request(path, options, storage) {
  return handleStaticDemoRequest(path, options, storage)
}
