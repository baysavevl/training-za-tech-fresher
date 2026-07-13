import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MULTICA_CONTROL_HEADER,
  MULTICA_CONTROL_HEADER_VALUE,
  commandData,
  concepts,
  controlCenterRequest,
  createEmptyControlCenterState,
  displayIssue,
  displayRuntime,
  validateAssignForm,
  validateIssueForm,
  validateProjectForm,
  validateRepoForm
} from './multicaControlCenter.js'

test('displayRuntime normalizes provider and status labels', () => {
  assert.deepEqual(displayRuntime({
    id: 'runtime-1',
    provider: 'codex',
    status: 'online',
    name: 'Codex (MacBook)',
    daemon_id: 'daemon-1',
    last_seen_at: '2026-07-13T10:00:00+07:00'
  }), {
    id: 'runtime-1',
    provider: 'codex',
    providerLabel: 'Codex',
    status: 'online',
    statusLabel: 'Online',
    name: 'Codex (MacBook)',
    daemonId: 'daemon-1',
    lastSeenAt: '2026-07-13T10:00:00+07:00'
  })
})

test('commandData extracts arrays and named collections', () => {
  assert.deepEqual(commandData({ data: [{ id: 'a' }] }), [{ id: 'a' }])
  assert.deepEqual(commandData({ data: { issues: [{ id: 'LOCA-1' }] } }, 'issues'), [{ id: 'LOCA-1' }])
  assert.deepEqual(commandData({ data: { total: 0 } }, 'issues'), [])
})

test('form validation rejects unsafe or incomplete inputs', () => {
  assert.deepEqual(validateProjectForm({ title: '', repoUrl: 'https://github.com/acme/app' }), ['Project title is required.'])
  assert.deepEqual(validateProjectForm({ title: 'App', repoUrl: 'file:///etc/passwd' }), ['Repo URL must be http(s), ssh, git, or git@ style.'])
  assert.deepEqual(validateRepoForm({ url: 'https://token@github.com/acme/app.git' }), ['Repo URL must be http(s), ssh, git, or git@ style.'])
  assert.deepEqual(validateRepoForm({ url: 'git@github.com:acme/app.git' }), [])
  assert.deepEqual(validateIssueForm({ title: '', status: 'todo' }), ['Issue title is required.'])
  assert.deepEqual(validateAssignForm({ issueId: 'LOCA-1', assigneeId: '' }), ['Choose an agent.'])
})

test('control center requests include the local guard header', async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '{"ok":true,"data":[]}'
    }
  }

  try {
    await controlCenterRequest('/status')
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(request.url, '/api/multica/status')
  assert.equal(request.options.headers[MULTICA_CONTROL_HEADER], MULTICA_CONTROL_HEADER_VALUE)
})

test('empty control center state and concepts are ready for first render', () => {
  const state = createEmptyControlCenterState()

  assert.deepEqual(state.runtimes, [])
  assert.equal(state.loading, false)
  assert.equal(concepts.some(concept => concept.term === 'Runtime'), true)
})

test('displayIssue supports Multica issue list fields', () => {
  assert.deepEqual(displayIssue({
    identifier: 'LOCA-1',
    title: 'Fix login',
    status: 'todo',
    priority: 'high',
    assignee_name: 'Codex Agent',
    project_id: 'project-1'
  }), {
    id: 'LOCA-1',
    title: 'Fix login',
    status: 'todo',
    priority: 'high',
    assignee: 'Codex Agent',
    projectId: 'project-1'
  })
})
