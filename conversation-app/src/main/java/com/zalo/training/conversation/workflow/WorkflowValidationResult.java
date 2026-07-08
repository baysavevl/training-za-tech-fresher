package com.zalo.training.conversation.workflow;

import java.util.List;

public record WorkflowValidationResult(
        boolean valid,
        List<String> errors
) {
}
