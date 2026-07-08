package com.zalo.training.conversation.automation;

import com.zalo.training.conversation.domain.AutomationDecision;
import com.zalo.training.conversation.domain.AutomationRule;
import com.zalo.training.conversation.domain.MessageForAutomation;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public class AutomationEngine {

    public AutomationDecision evaluate(MessageForAutomation message, List<AutomationRule> rules) {
        return rules.stream()
                .filter(AutomationRule::enabled)
                .filter(rule -> rule.intent() == message.intent())
                .min(Comparator.comparingInt(AutomationRule::priority))
                .map(rule -> decisionFor(message, rule))
                .orElseGet(() -> AutomationDecision.noMatch(message));
    }

    private AutomationDecision decisionFor(MessageForAutomation message, AutomationRule rule) {
        String reply = render(rule.replyTemplate(), message);
        return new AutomationDecision(
                rule.actionType(),
                message.intent(),
                Optional.of(rule.id()),
                Optional.of(reply),
                IdempotencyKeys.forMessage(message.messageId(), message.intent())
        );
    }

    private String render(String template, MessageForAutomation message) {
        return template
                .replace("{message}", message.content())
                .replace("{intent}", message.intent().name());
    }
}
