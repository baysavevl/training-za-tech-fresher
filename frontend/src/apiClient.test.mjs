import assert from 'node:assert/strict'
import { test } from 'node:test'

import { withJsonHeaders } from './apiClient.js'

test('withJsonHeaders preserves JSON content type when custom headers are passed', () => {
  const options = withJsonHeaders({
    method: 'POST',
    headers: { 'X-Request-Id': 'request-ui-001' },
    body: '{}'
  })

  assert.equal(options.method, 'POST')
  assert.equal(options.headers['Content-Type'], 'application/json')
  assert.equal(options.headers['X-Request-Id'], 'request-ui-001')
})
