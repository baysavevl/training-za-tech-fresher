package com.zalo.training.conversation.workflow;

import com.zalo.training.conversation.domain.SessionStatus;

import java.util.List;

public record WorkflowExecutionOutcome(
        String nodeId,
        String response,
        SessionStatus sessionStatus,
        String eventType,
        String detailJson,
        List<String> nodePath,
        String actionName
) {
}
