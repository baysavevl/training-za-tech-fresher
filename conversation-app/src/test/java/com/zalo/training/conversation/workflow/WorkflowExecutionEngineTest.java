package com.zalo.training.conversation.workflow;

import com.zalo.training.conversation.adapter.ActionResult;
import com.zalo.training.conversation.domain.SessionStatus;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowExecutionEngineTest {

    private final WorkflowExecutionEngine engine = new WorkflowExecutionEngine();

    @Test
    void routesToKeywordActionWhenInputMatchesQuestionRule() {
        WorkflowExecutionOutcome outcome = engine.execute(workflow(), "start", "toi muon kiem tra don hang", (actionName, input) ->
                new ActionResult(true, "Order A123 dang duoc xu ly.", "{\"orderId\":\"A123\"}")
        );

        assertThat(outcome.nodeId()).isEqualTo("end");
        assertThat(outcome.eventType()).isEqualTo("ACTION_EXECUTED");
        assertThat(outcome.response()).isEqualTo("Order A123 dang duoc xu ly.");
        assertThat(outcome.sessionStatus()).isEqualTo(SessionStatus.COMPLETED);
    }

    @Test
    void routesToFallbackWhenInputDoesNotMatchAnyRule() {
        WorkflowExecutionOutcome outcome = engine.execute(workflow(), "start", "noi chuyen voi nhan vien", (actionName, input) ->
                new ActionResult(true, "should not execute", "{}")
        );

        assertThat(outcome.nodeId()).isEqualTo("end");
        assertThat(outcome.eventType()).isEqualTo("END");
        assertThat(outcome.response()).isEqualTo("Minh chua hieu yeu cau nay.");
        assertThat(outcome.sessionStatus()).isEqualTo(SessionStatus.COMPLETED);
    }

    private static WorkflowDefinition workflow() {
        return new WorkflowDefinition(
                List.of(
                        new WorkflowDefinition.Node("start", WorkflowNodeType.START, Map.of()),
                        new WorkflowDefinition.Node("ask", WorkflowNodeType.QUESTION, Map.of("message", "Ban can ho tro gi?")),
                        new WorkflowDefinition.Node("lookup", WorkflowNodeType.ACTION, Map.of("action", "ORDER_LOOKUP")),
                        new WorkflowDefinition.Node("end", WorkflowNodeType.END, Map.of("message", "Minh chua hieu yeu cau nay."))
                ),
                List.of(
                        new WorkflowDefinition.Edge("start", "ask", WorkflowMatchType.ALWAYS, ""),
                        new WorkflowDefinition.Edge("ask", "lookup", WorkflowMatchType.KEYWORD, "don hang"),
                        new WorkflowDefinition.Edge("ask", "end", WorkflowMatchType.FALLBACK, ""),
                        new WorkflowDefinition.Edge("lookup", "end", WorkflowMatchType.ALWAYS, "")
                )
        );
    }
}
