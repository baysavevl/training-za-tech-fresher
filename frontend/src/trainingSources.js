const SOURCE_MAP = new Map([
  ['docs/api/api-contract.md', 'docs/api/api-contract.md'],
  ['docs/design/database.md', 'docs/design/database.md'],
  ['docs/design/architecture.md#10-observability', 'docs/design/architecture.md'],
  ['docs/training/knowledge-program.md', 'docs/training/knowledge-program.md'],
  ['conversation-app/src/main/resources/schema.sql', 'conversation-app/src/main/resources/schema.sql'],
  ['conversation-app/src/main/resources/application.yml', 'conversation-app/src/main/resources/application.yml'],
  ['frontend/src/demoState.js', 'frontend/src/demoState.js'],
  ['frontend/src/main.jsx', 'frontend/src/main.jsx'],
  ['frontend/src/trainingContent.js', 'frontend/src/trainingContent.js'],
  ['frontend/src/trainingContent.test.mjs', 'frontend/src/trainingContent.test.mjs'],
  ['message_idempotency and conversation_sessions.version', 'conversation-app/src/main/resources/schema.sql'],
  ['execution_traces and action_executions tables', 'conversation-app/src/main/resources/schema.sql'],
  ['WorkflowExecutionEngine.java', 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngine.java'],
  ['WorkflowExecutionEngineTest.java', 'conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngineTest.java'],
  ['WorkflowExecutionEngineTest', 'conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngineTest.java'],
  ['WorkflowValidatorTest', 'conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowValidatorTest.java'],
  ['WorkflowValidator.java', 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowValidator.java'],
  ['WorkflowDefinition.java', 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowDefinition.java'],
  ['MockChatController', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java'],
  ['MockChatController.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java'],
  ['AutomationController', 'conversation-app/src/main/java/com/zalo/training/conversation/api/AutomationController.java'],
  ['AutomationController.java', 'conversation-app/src/main/java/com/zalo/training/conversation/api/AutomationController.java'],
  ['AutomationService.java', 'conversation-app/src/main/java/com/zalo/training/conversation/application/AutomationService.java'],
  ['AutomationService.publishWorkflowVersion', 'conversation-app/src/main/java/com/zalo/training/conversation/application/AutomationService.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/application/AutomationService.java', 'conversation-app/src/main/java/com/zalo/training/conversation/application/AutomationService.java'],
  ['ConversationController', 'conversation-app/src/main/java/com/zalo/training/conversation/api/ConversationController.java'],
  ['ConversationController.java', 'conversation-app/src/main/java/com/zalo/training/conversation/api/ConversationController.java'],
  ['MockChatService.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java'],
  ['MockChatService structured log statement', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/domain/MessageIntent.java', 'conversation-app/src/main/java/com/zalo/training/conversation/domain/MessageIntent.java'],
  ['MessageIntent.java', 'conversation-app/src/main/java/com/zalo/training/conversation/domain/MessageIntent.java'],
  ['MessageIdempotencyRepository.java', 'conversation-app/src/main/java/com/zalo/training/conversation/persistence/MessageIdempotencyRepository.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/persistence/MessageIdempotencyRepository.java', 'conversation-app/src/main/java/com/zalo/training/conversation/persistence/MessageIdempotencyRepository.java'],
  ['MockChatFlowTest.java', 'conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java'],
  ['MockChatFlowTest', 'conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java'],
  ['ConversationLockManager.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/ConversationLockManager.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/mockchat/ConversationLockManager.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/ConversationLockManager.java'],
  ['ConversationLockManagerTest', 'conversation-app/src/test/java/com/zalo/training/conversation/mockchat/ConversationLockManagerTest.java'],
  ['ConversationSessionRepository.java', 'conversation-app/src/main/java/com/zalo/training/conversation/persistence/ConversationSessionRepository.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/persistence/ConversationSessionRepository.java', 'conversation-app/src/main/java/com/zalo/training/conversation/persistence/ConversationSessionRepository.java'],
  ['ConversationApiTest', 'conversation-app/src/test/java/com/zalo/training/conversation/api/ConversationApiTest.java'],
  ['ContextSmokeTest', 'conversation-app/src/test/java/com/zalo/training/conversation/ContextSmokeTest.java'],
  ['IntentServiceContextTest', 'intent-service/src/test/java/com/zalo/training/intent/IntentServiceContextTest.java'],
  ['trace API', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java'],
  ['/api/mock-chat/conversations/{conversationId}/trace', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java'],
  ['ChannelAdapter.java', 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/ChannelAdapter.java'],
  ['MockChatChannelAdapter.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatChannelAdapter.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatChannelAdapter.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatChannelAdapter.java'],
  ['ActionAdapter.java', 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/ActionAdapter.java'],
  ['MockActionAdapter.java', 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/MockActionAdapter.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/adapter/MockActionAdapter.java', 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/MockActionAdapter.java'],
  ['conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java', 'conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java'],
  ['conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngineTest.java', 'conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngineTest.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngine.java', 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngine.java'],
  ['conversation-app/src/main/java/com/zalo/training/conversation/api/AutomationController.java', 'conversation-app/src/main/java/com/zalo/training/conversation/api/AutomationController.java'],
  ['intent_classifier.proto', 'intent-contract/src/main/proto/intent_classifier.proto']
])

export function sourceReferencesFor(label) {
  if (typeof label !== 'string') {
    return []
  }

  const normalized = label.replace(/^Code:\s*/, '').replace(/^Schema:\s*/, '').trim()
  const direct = SOURCE_MAP.get(normalized) || SOURCE_MAP.get(label)
  if (direct) {
    return [{ label: normalized, path: direct }]
  }

  const matches = []
  for (const [key, path] of SOURCE_MAP.entries()) {
    if (normalized.includes(key)) {
      matches.push({ label: key, path })
    }
  }

  return matches
}
