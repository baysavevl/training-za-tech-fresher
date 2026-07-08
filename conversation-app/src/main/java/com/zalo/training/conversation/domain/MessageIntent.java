package com.zalo.training.conversation.domain;

public enum MessageIntent {
    ORDER_STATUS_REQUEST,
    HUMAN_AGENT_REQUEST,
    GREETING,
    UNKNOWN;

    public static MessageIntent from(String value) {
        if (value == null || value.isBlank()) {
            return UNKNOWN;
        }
        return MessageIntent.valueOf(value.trim().toUpperCase());
    }
}
