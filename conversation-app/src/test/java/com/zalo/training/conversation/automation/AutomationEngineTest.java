package com.zalo.training.conversation.automation;

import com.zalo.training.conversation.domain.ActionType;
import com.zalo.training.conversation.domain.AutomationDecision;
import com.zalo.training.conversation.domain.AutomationRule;
import com.zalo.training.conversation.domain.MessageForAutomation;
import com.zalo.training.conversation.domain.MessageIntent;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AutomationEngineTest {

    private final AutomationEngine engine = new AutomationEngine();

    @Test
    void matchesEnabledRuleWithHighestPriorityForIntent() {
        UUID highPriorityRuleId = UUID.randomUUID();
        MessageForAutomation message = message(MessageIntent.ORDER_STATUS_REQUEST);

        AutomationDecision decision = engine.evaluate(message, List.of(
                rule(UUID.randomUUID(), MessageIntent.ORDER_STATUS_REQUEST, 20, true, "Low priority"),
                rule(highPriorityRuleId, MessageIntent.ORDER_STATUS_REQUEST, 1, true, "Checking order status")
        ));

        assertThat(decision.actionType()).isEqualTo(ActionType.AUTO_REPLY);
        assertThat(decision.intent()).isEqualTo(MessageIntent.ORDER_STATUS_REQUEST);
        assertThat(decision.ruleId()).contains(highPriorityRuleId);
        assertThat(decision.replyContent()).contains("Checking order status");
    }

    @Test
    void ignoresDisabledRules() {
        MessageForAutomation message = message(MessageIntent.GREETING);

        AutomationDecision decision = engine.evaluate(message, List.of(
                rule(UUID.randomUUID(), MessageIntent.GREETING, 1, false, "Disabled greeting")
        ));

        assertThat(decision.actionType()).isEqualTo(ActionType.NO_MATCH);
        assertThat(decision.ruleId()).isEmpty();
        assertThat(decision.replyContent()).isEmpty();
    }

    @Test
    void returnsNoMatchWhenNoRuleMatches() {
        MessageForAutomation message = message(MessageIntent.UNKNOWN);

        AutomationDecision decision = engine.evaluate(message, List.of(
                rule(UUID.randomUUID(), MessageIntent.ORDER_STATUS_REQUEST, 1, true, "Order reply")
        ));

        assertThat(decision.actionType()).isEqualTo(ActionType.NO_MATCH);
        assertThat(decision.intent()).isEqualTo(MessageIntent.UNKNOWN);
    }

    private static MessageForAutomation message(MessageIntent intent) {
        return new MessageForAutomation(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Cho toi kiem tra don hang #A123",
                intent,
                "trace-test"
        );
    }

    private static AutomationRule rule(UUID id, MessageIntent intent, int priority, boolean enabled, String replyTemplate) {
        return new AutomationRule(id, intent, priority, enabled, ActionType.AUTO_REPLY, replyTemplate, Instant.now());
    }
}
