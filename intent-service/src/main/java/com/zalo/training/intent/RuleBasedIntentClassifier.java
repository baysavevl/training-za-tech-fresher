package com.zalo.training.intent;

import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class RuleBasedIntentClassifier {

    public IntentClassification classify(String content) {
        String normalized = content == null ? "" : content.toLowerCase(Locale.ROOT);
        if (normalized.contains("don hang") || normalized.contains("order")) {
            return new IntentClassification("ORDER_STATUS_REQUEST", 0.92, "keyword: order status");
        }
        if (normalized.contains("nhan vien") || normalized.contains("ho tro") || normalized.contains("agent")) {
            return new IntentClassification("HUMAN_AGENT_REQUEST", 0.86, "keyword: human support");
        }
        if (normalized.contains("xin chao") || normalized.contains("hello") || normalized.contains("hi")) {
            return new IntentClassification("GREETING", 0.81, "keyword: greeting");
        }
        return new IntentClassification("UNKNOWN", 0.2, "no deterministic rule matched");
    }
}
