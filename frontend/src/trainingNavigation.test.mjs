import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  firstSessionNumberForTopic,
  knowledgeSelectionForTopic,
  roadmapDetailSelection,
  sessionDetailPath,
  sessionFromPath,
  toggleExpandedSession
} from './trainingNavigation.js'

test('knowledge topic selection uses the first session that belongs to the topic', () => {
  assert.equal(firstSessionNumberForTopic('ob'), '08')
  assert.deepEqual(knowledgeSelectionForTopic('ob'), {
    topicId: 'ob',
    sessionNumber: '08',
    scrollTarget: 'knowledge-tab'
  })
})

test('roadmap detail exposes a dedicated session route', () => {
  assert.equal(sessionDetailPath('07'), '/training/session/07')
  assert.equal(sessionDetailPath('99'), '/training/session/01')
  assert.equal(sessionFromPath('/training/session/07').title, 'Concurrency')
  assert.equal(sessionFromPath('/training/session/99').number, '01')
})

test('roadmap detail keeps selected session context for legacy inline navigation', () => {
  assert.deepEqual(roadmapDetailSelection('09'), {
    topicId: 'ob',
    sessionNumber: '09',
    scrollTarget: 'session-09'
  })
})

test('roadmap detail expansion keeps existing sessions open while opening another one', () => {
  assert.deepEqual(toggleExpandedSession(['02'], '04'), ['02', '04'])
  assert.deepEqual(toggleExpandedSession(['02', '04'], '02'), ['04'])
})
