package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record ConversationSession(
        UUID id,
        UUID conversationId,
        UUID automationId,
        UUID workflowVersionId,
        String currentNodeId,
        SessionStatus status,
        int version,
        Instant createdAt,
        Instant updatedAt
) {
}
