package com.zalo.training.conversation.workflow;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowValidatorTest {

    private final WorkflowValidator validator = new WorkflowValidator();

    @Test
    void acceptsWorkflowWithStartQuestionActionAndEnd() {
        WorkflowDefinition workflow = new WorkflowDefinition(
                List.of(
                        new WorkflowDefinition.Node("start", WorkflowNodeType.START, Map.of()),
                        new WorkflowDefinition.Node("ask", WorkflowNodeType.QUESTION, Map.of("message", "Ban can ho tro gi?")),
                        new WorkflowDefinition.Node("lookup", WorkflowNodeType.ACTION, Map.of("action", "ORDER_LOOKUP")),
                        new WorkflowDefinition.Node("end", WorkflowNodeType.END, Map.of("message", "Da xu ly xong"))
                ),
                List.of(
                        new WorkflowDefinition.Edge("start", "ask", WorkflowMatchType.ALWAYS, ""),
                        new WorkflowDefinition.Edge("ask", "lookup", WorkflowMatchType.KEYWORD, "don hang"),
                        new WorkflowDefinition.Edge("ask", "end", WorkflowMatchType.FALLBACK, ""),
                        new WorkflowDefinition.Edge("lookup", "end", WorkflowMatchType.ALWAYS, "")
                )
        );

        WorkflowValidationResult result = validator.validate(workflow);

        assertThat(result.valid()).isTrue();
        assertThat(result.errors()).isEmpty();
    }

    @Test
    void rejectsWorkflowWithoutStartNode() {
        WorkflowDefinition workflow = new WorkflowDefinition(
                List.of(new WorkflowDefinition.Node("end", WorkflowNodeType.END, Map.of())),
                List.of()
        );

        WorkflowValidationResult result = validator.validate(workflow);

        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).contains("workflow must contain exactly one START node");
    }

    @Test
    void rejectsEdgePointingToMissingNode() {
        WorkflowDefinition workflow = new WorkflowDefinition(
                List.of(
                        new WorkflowDefinition.Node("start", WorkflowNodeType.START, Map.of()),
                        new WorkflowDefinition.Node("end", WorkflowNodeType.END, Map.of())
                ),
                List.of(new WorkflowDefinition.Edge("start", "missing", WorkflowMatchType.ALWAYS, ""))
        );

        WorkflowValidationResult result = validator.validate(workflow);

        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).contains("edge start -> missing points to a missing node");
    }

    @Test
    void rejectsWorkflowWithoutEndNode() {
        WorkflowDefinition workflow = new WorkflowDefinition(
                List.of(
                        new WorkflowDefinition.Node("start", WorkflowNodeType.START, Map.of()),
                        new WorkflowDefinition.Node("ask", WorkflowNodeType.QUESTION, Map.of("message", "Ban can ho tro gi?"))
                ),
                List.of(
                        new WorkflowDefinition.Edge("start", "ask", WorkflowMatchType.ALWAYS, ""),
                        new WorkflowDefinition.Edge("ask", "ask", WorkflowMatchType.FALLBACK, "")
                )
        );

        WorkflowValidationResult result = validator.validate(workflow);

        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).contains("workflow must contain at least one END node");
    }

    @Test
    void rejectsMessageNodeWithoutMessage() {
        WorkflowDefinition workflow = new WorkflowDefinition(
                List.of(
                        new WorkflowDefinition.Node("start", WorkflowNodeType.START, Map.of()),
                        new WorkflowDefinition.Node("message", WorkflowNodeType.MESSAGE, Map.of()),
                        new WorkflowDefinition.Node("end", WorkflowNodeType.END, Map.of())
                ),
                List.of(
                        new WorkflowDefinition.Edge("start", "message", WorkflowMatchType.ALWAYS, ""),
                        new WorkflowDefinition.Edge("message", "end", WorkflowMatchType.ALWAYS, "")
                )
        );

        WorkflowValidationResult result = validator.validate(workflow);

        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).contains("MESSAGE node message must define config.message");
    }

    @Test
    void rejectsConditionNodeWithoutRule() {
        WorkflowDefinition workflow = new WorkflowDefinition(
                List.of(
                        new WorkflowDefinition.Node("start", WorkflowNodeType.START, Map.of()),
                        new WorkflowDefinition.Node("condition", WorkflowNodeType.CONDITION, Map.of()),
                        new WorkflowDefinition.Node("end", WorkflowNodeType.END, Map.of())
                ),
                List.of(
                        new WorkflowDefinition.Edge("start", "condition", WorkflowMatchType.ALWAYS, ""),
                        new WorkflowDefinition.Edge("condition", "end", WorkflowMatchType.FALLBACK, "")
                )
        );

        WorkflowValidationResult result = validator.validate(workflow);

        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).contains("CONDITION node condition must define config.rule");
    }
}
