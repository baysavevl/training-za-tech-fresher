package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record AutomationRule(
        UUID id,
        MessageIntent intent,
        int priority,
        boolean enabled,
        ActionType actionType,
        String replyTemplate,
        Instant createdAt
) {
}
