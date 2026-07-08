package com.zalo.training.intent;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RuleBasedIntentClassifierTest {

    private final RuleBasedIntentClassifier classifier = new RuleBasedIntentClassifier();

    @Test
    void classifiesOrderStatusByKeyword() {
        IntentClassification result = classifier.classify("toi muon xem don hang A123");

        assertThat(result.intent()).isEqualTo("ORDER_STATUS_REQUEST");
        assertThat(result.confidence()).isGreaterThan(0.9);
    }

    @Test
    void returnsUnknownWhenNoRuleMatches() {
        IntentClassification result = classifier.classify("noi dung khong ro");

        assertThat(result.intent()).isEqualTo("UNKNOWN");
        assertThat(result.confidence()).isLessThan(0.5);
    }
}
