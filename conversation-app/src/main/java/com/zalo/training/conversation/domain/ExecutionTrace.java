package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record ExecutionTrace(
        UUID id,
        String requestId,
        String externalMessageId,
        UUID conversationId,
        UUID sessionId,
        String nodeId,
        String eventType,
        String detailJson,
        Instant createdAt
) {
}
