package com.zalo.training.conversation.mockchat;

import java.util.UUID;

public record InboundChatMessage(
        String userId,
        UUID conversationId,
        String messageId,
        String accountId,
        UUID automationId,
        String text,
        String requestId
) {
}
