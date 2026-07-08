package com.zalo.training.conversation.domain;

import java.util.Optional;
import java.util.UUID;

public record AutomationDecision(
        ActionType actionType,
        MessageIntent intent,
        Optional<UUID> ruleId,
        Optional<String> replyContent,
        String idempotencyKey
) {
    public static AutomationDecision noMatch(MessageForAutomation message) {
        return new AutomationDecision(
                ActionType.NO_MATCH,
                message.intent(),
                Optional.empty(),
                Optional.empty(),
                "message:%s:intent:%s".formatted(message.messageId(), message.intent())
        );
    }
}
