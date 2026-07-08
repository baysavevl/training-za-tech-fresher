package com.zalo.training.conversation.domain;

import java.util.UUID;

public record MessageForAutomation(
        UUID messageId,
        UUID conversationId,
        String content,
        MessageIntent intent,
        String traceId
) {
}
