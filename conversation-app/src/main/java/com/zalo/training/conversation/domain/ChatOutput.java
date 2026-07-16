package com.zalo.training.conversation.domain;

public record ChatOutput(OutputType type, String text) {

    public static ChatOutput text(String text) {
        return new ChatOutput(OutputType.TEXT, text);
    }
}
