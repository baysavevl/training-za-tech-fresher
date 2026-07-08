package com.zalo.training.conversation.automation;

import com.zalo.training.conversation.domain.MessageIntent;

import java.util.UUID;

public final class IdempotencyKeys {

    private IdempotencyKeys() {
    }

    public static String forMessage(UUID messageId, MessageIntent intent) {
        return "message:%s:intent:%s".formatted(messageId, intent.name());
    }
}
