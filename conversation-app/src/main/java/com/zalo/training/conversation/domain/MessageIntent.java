package com.zalo.training.conversation.domain;

public enum MessageIntent {
    ORDER_STATUS_REQUEST,
    ORDER_ID_PROVIDED,
    STATUS_UPDATE_REQUEST,
    TICKET_REQUEST,
    SUPPORT_CATEGORY_PROVIDED,
    HUMAN_AGENT_REQUEST,
    AFFIRMATION,
    NEGATION,
    GREETING,
    UNKNOWN;

    public static MessageIntent from(String value) {
        if (value == null || value.isBlank()) {
            return UNKNOWN;
        }
        try {
            return MessageIntent.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return UNKNOWN;
        }
    }
}
