package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record WorkflowVersion(
        UUID id,
        UUID automationId,
        int version,
        WorkflowStatus status,
        String definitionJson,
        Instant createdAt,
        Instant publishedAt
) {
}
