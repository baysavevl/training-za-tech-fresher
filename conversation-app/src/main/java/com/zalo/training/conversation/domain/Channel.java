package com.zalo.training.conversation.domain;

public enum Channel {
    ZALO,
    WEB,
    EMAIL;

    public static Channel from(String value) {
        return Channel.valueOf(value.trim().toUpperCase());
    }
}
