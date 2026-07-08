package com.zalo.training.conversation.mockchat;

import java.util.UUID;

public record InboundChatMessage(
        String userId,
        UUID conversationId,
        String messageId,
        UUID automationId,
        String text,
        String requestId
) {
}
