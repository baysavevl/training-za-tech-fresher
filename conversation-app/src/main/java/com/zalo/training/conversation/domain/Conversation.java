package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record Conversation(
        UUID id,
        UUID customerId,
        Channel channel,
        ConversationStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
