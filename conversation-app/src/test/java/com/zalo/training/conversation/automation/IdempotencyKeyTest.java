package com.zalo.training.conversation.automation;

import com.zalo.training.conversation.domain.MessageIntent;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class IdempotencyKeyTest {

    @Test
    void createsStableKeyForSameMessageAndIntent() {
        UUID messageId = UUID.randomUUID();

        String first = IdempotencyKeys.forMessage(messageId, MessageIntent.ORDER_STATUS_REQUEST);
        String second = IdempotencyKeys.forMessage(messageId, MessageIntent.ORDER_STATUS_REQUEST);

        assertThat(first).isEqualTo(second);
        assertThat(first).isEqualTo("message:%s:intent:ORDER_STATUS_REQUEST".formatted(messageId));
    }

    @Test
    void keyChangesWhenIntentChanges() {
        UUID messageId = UUID.randomUUID();

        String orderKey = IdempotencyKeys.forMessage(messageId, MessageIntent.ORDER_STATUS_REQUEST);
        String greetingKey = IdempotencyKeys.forMessage(messageId, MessageIntent.GREETING);

        assertThat(orderKey).isNotEqualTo(greetingKey);
    }
}
