package com.zalo.training.conversation.automation;

import java.util.UUID;

public record MessageReceivedEvent(
        UUID conversationId,
        UUID messageId,
        String traceId
) {
}
