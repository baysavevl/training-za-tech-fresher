package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record ActionExecution(
        UUID id,
        UUID traceId,
        UUID conversationId,
        UUID sessionId,
        String nodeId,
        String actionName,
        ActionStatus status,
        String requestJson,
        String responseJson,
        int attemptCount,
        Instant createdAt,
        Instant updatedAt
) {
}
