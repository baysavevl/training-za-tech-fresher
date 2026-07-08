package com.zalo.training.conversation.workflow;

import com.zalo.training.conversation.domain.SessionStatus;

public record WorkflowExecutionOutcome(
        String nodeId,
        String response,
        SessionStatus sessionStatus,
        String eventType,
        String detailJson
) {
}
