package com.zalo.training.conversation.adapter;

public record ActionResult(
        boolean success,
        String response,
        String responseJson
) {
}
