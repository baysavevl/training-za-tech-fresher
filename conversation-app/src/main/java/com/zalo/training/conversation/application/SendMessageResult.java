package com.zalo.training.conversation.application;

import java.util.UUID;

public record SendMessageResult(
        UUID messageId,
        UUID conversationId,
        String traceId
) {
}
