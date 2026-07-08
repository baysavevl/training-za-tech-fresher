package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record Message(
        UUID id,
        UUID conversationId,
        SenderType senderType,
        String content,
        MessageIntent intent,
        String traceId,
        Instant createdAt
) {
}
