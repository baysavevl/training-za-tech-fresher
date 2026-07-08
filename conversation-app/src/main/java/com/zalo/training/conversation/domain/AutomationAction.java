package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record AutomationAction(
        UUID id,
        UUID conversationId,
        UUID sourceMessageId,
        UUID ruleId,
        ActionType actionType,
        ActionStatus status,
        UUID resultMessageId,
        int attemptCount,
        String idempotencyKey,
        String lastError,
        Instant createdAt,
        Instant updatedAt
) {
}
