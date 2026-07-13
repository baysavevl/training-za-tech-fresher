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
    void startsByPromptingTheMenuWithoutRoutingTheSameInput() {
        WorkflowExecutionOutcome outcome = engine.execute(workflow(), "start", "hello", (actionName, input) ->
                new ActionResult(true, "should not execute", "{}")
        );

        assertThat(outcome.nodeId()).isEqualTo("menu");
        assertThat(outcome.eventType()).isEqualTo("QUESTION");
        assertThat(outcome.response()).isEqualTo("I can check an order, create a ticket, or route you to an agent. What do you need?");
        assertThat(outcome.sessionStatus()).isEqualTo(SessionStatus.ACTIVE);
    }

    @Test
    void routesOrderIntentToOrderIdFollowUpOnTheNextTurn() {
        WorkflowExecutionOutcome outcome = engine.execute(workflow(), "menu", "order", (actionName, input) ->
                new ActionResult(true, "should not execute", "{}")
        );

        assertThat(outcome.nodeId()).isEqualTo("ask_order_id");
        assertThat(outcome.eventType()).isEqualTo("QUESTION");
        assertThat(outcome.response()).isEqualTo("Please send the order code, for example A123.");
        assertThat(outcome.sessionStatus()).isEqualTo(SessionStatus.ACTIVE);
    }

    @Test
    void extractsOrderIdThenOffersProactiveStatusUpdate() {
        WorkflowExecutionOutcome outcome = engine.execute(workflow(), "ask_order_id", "A123", (actionName, input) ->
                new ActionResult(
                        true,
                        "Order A123 is PACKING. Reply update for the latest status or ticket to create a follow-up.",
                        "{\"category\":\"ORDER_STATUS\",\"orderId\":\"A123\",\"status\":\"PACKING\"}"
                )
        );

        assertThat(outcome.nodeId()).isEqualTo("offer_update");
        assertThat(outcome.eventType()).isEqualTo("ACTION_EXECUTED");
        assertThat(outcome.response()).contains("Order A123 is PACKING");
        assertThat(outcome.detailJson()).contains("\"category\":\"ORDER_STATUS\"");
        assertThat(outcome.sessionStatus()).isEqualTo(SessionStatus.ACTIVE);
    }

    @Test
    void runsStatusUpdateAndKeepsTheConversationOpenForCategoryFollowUp() {
        WorkflowExecutionOutcome outcome = engine.execute(workflow(), "offer_update", "update A123", (actionName, input) ->
                new ActionResult(
                        true,
                        "Update: order A123 moved from PACKING to SHIPPING. What follow-up category should I file?",
                        "{\"category\":\"ORDER_STATUS_UPDATE\",\"orderId\":\"A123\",\"status\":\"SHIPPING\"}"
                )
        );

        assertThat(outcome.nodeId()).isEqualTo("ask_followup_category");
        assertThat(outcome.eventType()).isEqualTo("ACTION_EXECUTED");
        assertThat(outcome.response()).contains("moved from PACKING to SHIPPING");
        assertThat(outcome.response()).contains("follow-up category");
        assertThat(outcome.detailJson()).contains("\"category\":\"ORDER_STATUS_UPDATE\"");
        assertThat(outcome.sessionStatus()).isEqualTo(SessionStatus.ACTIVE);
    }

    @Test
    void routesSupportCategoryToTicketCreationAndCompletesTheSession() {
        WorkflowExecutionOutcome outcome = engine.execute(workflow(), "ask_followup_category", "delivery delay", (actionName, input) ->
                new ActionResult(
                        true,
                        "Ticket TCK-1001 was created for order A123 with category DELIVERY_DELAY.",
                        "{\"category\":\"TICKET_CREATION\",\"orderId\":\"A123\",\"supportCategory\":\"DELIVERY_DELAY\"}"
                )
        );

        assertThat(outcome.nodeId()).isEqualTo("end");
        assertThat(outcome.eventType()).isEqualTo("ACTION_EXECUTED");
        assertThat(outcome.response()).contains("Ticket TCK-1001");
        assertThat(outcome.response()).contains("DELIVERY_DELAY");
        assertThat(outcome.detailJson()).contains("\"supportCategory\":\"DELIVERY_DELAY\"");
        assertThat(outcome.sessionStatus()).isEqualTo(SessionStatus.COMPLETED);
    }

    @Test
    void routesFallbackToRetryPromptWithoutCompletingTheSession() {
        WorkflowExecutionOutcome outcome = engine.execute(workflow(), "menu", "weather", (actionName, input) ->
                new ActionResult(true, "should not execute", "{}")
        );

        assertThat(outcome.nodeId()).isEqualTo("menu_retry");
        assertThat(outcome.eventType()).isEqualTo("QUESTION");
        assertThat(outcome.response()).isEqualTo("I did not catch that. Choose order, ticket, or agent.");
        assertThat(outcome.sessionStatus()).isEqualTo(SessionStatus.ACTIVE);
    }

    private static WorkflowDefinition workflow() {
        return new WorkflowDefinition(
                List.of(
                        new WorkflowDefinition.Node("start", WorkflowNodeType.START, Map.of()),
                        new WorkflowDefinition.Node("menu", WorkflowNodeType.QUESTION, Map.of(
                                "message", "I can check an order, create a ticket, or route you to an agent. What do you need?",
                                "category", "INTENT_MENU"
                        )),
                        new WorkflowDefinition.Node("menu_retry", WorkflowNodeType.QUESTION, Map.of(
                                "message", "I did not catch that. Choose order, ticket, or agent.",
                                "category", "FALLBACK"
                        )),
                        new WorkflowDefinition.Node("ask_order_id", WorkflowNodeType.QUESTION, Map.of(
                                "message", "Please send the order code, for example A123.",
                                "category", "ORDER_ID_COLLECTION"
                        )),
                        new WorkflowDefinition.Node("lookup", WorkflowNodeType.ACTION, Map.of("action", "ORDER_LOOKUP")),
                        new WorkflowDefinition.Node("offer_update", WorkflowNodeType.QUESTION, Map.of(
                                "message", "Reply update for a proactive status refresh, ticket to create a follow-up, or done.",
                                "category", "FOLLOW_UP"
                        )),
                        new WorkflowDefinition.Node("update_status", WorkflowNodeType.ACTION, Map.of("action", "ORDER_STATUS_UPDATE")),
                        new WorkflowDefinition.Node("ask_followup_category", WorkflowNodeType.QUESTION, Map.of(
                                "message", "I updated the order status. What follow-up category should I file: delivery delay, address change, refund, agent, or done?",
                                "category", "FOLLOW_UP_CATEGORY"
                        )),
                        new WorkflowDefinition.Node("ticket", WorkflowNodeType.ACTION, Map.of("action", "TICKET_CREATION")),
                        new WorkflowDefinition.Node("handoff", WorkflowNodeType.HANDOFF, Map.of("message", "I will route this conversation to a support specialist.")),
                        new WorkflowDefinition.Node("end", WorkflowNodeType.END, Map.of("message", "Done. I have enough information for this case."))
                ),
                List.of(
                        new WorkflowDefinition.Edge("start", "menu", WorkflowMatchType.ALWAYS, ""),
                        new WorkflowDefinition.Edge("menu", "ask_order_id", WorkflowMatchType.KEYWORD, "order"),
                        new WorkflowDefinition.Edge("menu", "ticket", WorkflowMatchType.KEYWORD, "ticket"),
                        new WorkflowDefinition.Edge("menu", "handoff", WorkflowMatchType.KEYWORD, "agent"),
                        new WorkflowDefinition.Edge("menu", "menu_retry", WorkflowMatchType.FALLBACK, ""),
                        new WorkflowDefinition.Edge("menu_retry", "ask_order_id", WorkflowMatchType.KEYWORD, "order"),
                        new WorkflowDefinition.Edge("menu_retry", "ticket", WorkflowMatchType.KEYWORD, "ticket"),
                        new WorkflowDefinition.Edge("menu_retry", "handoff", WorkflowMatchType.KEYWORD, "agent"),
                        new WorkflowDefinition.Edge("menu_retry", "menu_retry", WorkflowMatchType.FALLBACK, ""),
                        new WorkflowDefinition.Edge("ask_order_id", "lookup", WorkflowMatchType.CONDITION, "[a-z][0-9]{3}"),
                        new WorkflowDefinition.Edge("ask_order_id", "ask_order_id", WorkflowMatchType.FALLBACK, ""),
                        new WorkflowDefinition.Edge("lookup", "offer_update", WorkflowMatchType.ALWAYS, ""),
                        new WorkflowDefinition.Edge("offer_update", "update_status", WorkflowMatchType.KEYWORD, "update"),
                        new WorkflowDefinition.Edge("offer_update", "ticket", WorkflowMatchType.KEYWORD, "ticket"),
                        new WorkflowDefinition.Edge("offer_update", "end", WorkflowMatchType.KEYWORD, "done"),
                        new WorkflowDefinition.Edge("offer_update", "offer_update", WorkflowMatchType.FALLBACK, ""),
                        new WorkflowDefinition.Edge("update_status", "ask_followup_category", WorkflowMatchType.ALWAYS, ""),
                        new WorkflowDefinition.Edge("ask_followup_category", "ticket", WorkflowMatchType.KEYWORD, "delivery"),
                        new WorkflowDefinition.Edge("ask_followup_category", "ticket", WorkflowMatchType.KEYWORD, "address"),
                        new WorkflowDefinition.Edge("ask_followup_category", "ticket", WorkflowMatchType.KEYWORD, "refund"),
                        new WorkflowDefinition.Edge("ask_followup_category", "handoff", WorkflowMatchType.KEYWORD, "agent"),
                        new WorkflowDefinition.Edge("ask_followup_category", "end", WorkflowMatchType.KEYWORD, "done"),
                        new WorkflowDefinition.Edge("ask_followup_category", "ask_followup_category", WorkflowMatchType.FALLBACK, ""),
                        new WorkflowDefinition.Edge("ticket", "end", WorkflowMatchType.ALWAYS, ""),
                        new WorkflowDefinition.Edge("handoff", "end", WorkflowMatchType.ALWAYS, "")
                )
        );
    }
}
