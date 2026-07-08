package com.zalo.training.intent;

public record IntentClassification(
        String intent,
        double confidence,
        String reason
) {
}
