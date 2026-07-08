package com.zalo.training.conversation.domain;

import java.util.List;

public record ConversationDetail(
        Conversation conversation,
        Customer customer,
        List<Message> messages,
        List<AutomationAction> automationActions
) {
}
