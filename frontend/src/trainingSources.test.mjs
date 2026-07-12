import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sourceReferencesFor } from './trainingSources.js'

test('sourceReferencesFor resolves markdown and sql paths directly', () => {
  assert.deepEqual(sourceReferencesFor('docs/design/database.md'), [
    { label: 'docs/design/database.md', path: 'docs/design/database.md' }
  ])
  assert.deepEqual(sourceReferencesFor('conversation-app/src/main/resources/schema.sql'), [
    {
      label: 'conversation-app/src/main/resources/schema.sql',
      path: 'conversation-app/src/main/resources/schema.sql'
    }
  ])
  assert.deepEqual(sourceReferencesFor('conversation-app/src/main/resources/application.yml'), [
    {
      label: 'conversation-app/src/main/resources/application.yml',
      path: 'conversation-app/src/main/resources/application.yml'
    }
  ])
})

test('sourceReferencesFor resolves Java class references inside combined labels', () => {
  assert.deepEqual(sourceReferencesFor('MockChatController and AutomationController'), [
    {
      label: 'MockChatController',
      path: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java'
    },
    {
      label: 'AutomationController',
      path: 'conversation-app/src/main/java/com/zalo/training/conversation/api/AutomationController.java'
    }
  ])
})
