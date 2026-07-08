package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record Automation(
        UUID id,
        String name,
        boolean enabled,
        UUID activeWorkflowVersionId,
        Instant createdAt,
        Instant updatedAt
) {
}
