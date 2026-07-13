package com.zalo.training.conversation.mockchat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class MockChatFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void publishesWorkflowRunsMultiTurnFollowUpAndCategorizesUserInput() throws Exception {
        String automationId = read(mockMvc.perform(post("/api/automations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Order support"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.enabled").value(true))
                .andReturn(), "id");

        String workflowVersionId = read(mockMvc.perform(post("/api/automations/{automationId}/workflows", automationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(multiTurnWorkflowRequest()))
                .andExpect(status().isCreated())
                .andReturn(), "id");

        mockMvc.perform(post("/api/automations/{automationId}/workflows/{workflowVersionId}/publish", automationId, workflowVersionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        MvcResult helloResult = sendMessage(null, automationId, "msg-001", "request-flow-001", "hello")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversationId").isNotEmpty())
                .andExpect(jsonPath("$.sessionId").isNotEmpty())
                .andExpect(jsonPath("$.response").value("I can check an order, create a ticket, or route you to an agent. What do you need?"))
                .andExpect(jsonPath("$.duplicate").value(false))
                .andReturn();

        String conversationId = read(helloResult, "conversationId");

        sendMessage(conversationId, automationId, "msg-002", "request-flow-002", "order")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.response").value("Please send the order code, for example A123."))
                .andExpect(jsonPath("$.currentNodeId").value("ask_order_id"));

        sendMessage(conversationId, automationId, "msg-003", "request-flow-003", "A123")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.response").value(containsString("Order A123 is PACKING")))
                .andExpect(jsonPath("$.currentNodeId").value("offer_update"));

        sendMessage(conversationId, automationId, "msg-004", "request-flow-004", "update")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.response").value(containsString("moved from PACKING to SHIPPING")))
                .andExpect(jsonPath("$.response").value(containsString("follow-up category")))
                .andExpect(jsonPath("$.currentNodeId").value("ask_followup_category"));

        MvcResult ticketResult = sendMessage(conversationId, automationId, "msg-005", "request-flow-005", "delivery delay")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.response").value(containsString("Ticket TCK-1001")))
                .andExpect(jsonPath("$.response").value(containsString("DELIVERY_DELAY")))
                .andExpect(jsonPath("$.currentNodeId").value("end"))
                .andReturn();

        String responseMessageId = read(ticketResult, "responseMessageId");

        sendMessage(conversationId, automationId, "msg-005", "request-flow-005-duplicate", "delivery delay")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(true))
                .andExpect(jsonPath("$.responseMessageId").value(responseMessageId))
                .andExpect(jsonPath("$.response").value(containsString("Ticket TCK-1001")));

        mockMvc.perform(get("/api/mock-chat/conversations/{conversationId}/session", conversationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.currentNodeId").value("end"))
                .andExpect(jsonPath("$.version").value(5));

        mockMvc.perform(get("/api/mock-chat/conversations/{conversationId}/history", conversationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(10))
                .andExpect(jsonPath("$.items[0].intent").value("GREETING"))
                .andExpect(jsonPath("$.items[2].intent").value("ORDER_STATUS_REQUEST"))
                .andExpect(jsonPath("$.items[4].intent").value("ORDER_ID_PROVIDED"))
                .andExpect(jsonPath("$.items[6].intent").value("STATUS_UPDATE_REQUEST"))
                .andExpect(jsonPath("$.items[8].intent").value("SUPPORT_CATEGORY_PROVIDED"));

        mockMvc.perform(get("/api/mock-chat/conversations/{conversationId}/trace", conversationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(5))
                .andExpect(jsonPath("$.items[2].detailJson").value(containsString("\"category\":\"ORDER_STATUS\"")))
                .andExpect(jsonPath("$.items[3].detailJson").value(containsString("\"category\":\"ORDER_STATUS_UPDATE\"")))
                .andExpect(jsonPath("$.items[4].detailJson").value(containsString("\"category\":\"TICKET_CREATION\"")))
                .andExpect(jsonPath("$.items[4].detailJson").value(containsString("\"supportCategory\":\"DELIVERY_DELAY\"")));
    }

    private ResultActions sendMessage(
            String conversationId,
            String automationId,
            String messageId,
            String requestId,
            String text
    ) throws Exception {
        String conversationField = conversationId == null ? "" : """
                                  "conversationId": "%s",
                """.formatted(conversationId);
        return mockMvc.perform(post("/api/mock-chat/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Request-Id", requestId)
                .content("""
                        {
                          "userId": "mock-user-001",
                %s          "messageId": "%s",
                          "automationId": "%s",
                          "text": "%s"
                        }
                        """.formatted(conversationField, messageId, automationId, text)));
    }

    private String multiTurnWorkflowRequest() {
        return """
                {
                  "definition": {
                    "nodes": [
                      {"id": "start", "type": "START", "config": {}},
                      {"id": "menu", "type": "QUESTION", "config": {"message": "I can check an order, create a ticket, or route you to an agent. What do you need?", "category": "INTENT_MENU"}},
                      {"id": "menu_retry", "type": "QUESTION", "config": {"message": "I did not catch that. Choose order, ticket, or agent.", "category": "FALLBACK"}},
                      {"id": "ask_order_id", "type": "QUESTION", "config": {"message": "Please send the order code, for example A123.", "category": "ORDER_ID_COLLECTION"}},
                      {"id": "lookup", "type": "ACTION", "config": {"action": "ORDER_LOOKUP"}},
                      {"id": "offer_update", "type": "QUESTION", "config": {"message": "Reply update for a proactive status refresh, ticket to create a follow-up, or done.", "category": "FOLLOW_UP"}},
                      {"id": "update_status", "type": "ACTION", "config": {"action": "ORDER_STATUS_UPDATE"}},
                      {"id": "ask_followup_category", "type": "QUESTION", "config": {"message": "I updated the order status. What follow-up category should I file: delivery delay, address change, refund, agent, or done?", "category": "FOLLOW_UP_CATEGORY"}},
                      {"id": "ticket", "type": "ACTION", "config": {"action": "TICKET_CREATION"}},
                      {"id": "handoff", "type": "HANDOFF", "config": {"message": "I will route this conversation to a support specialist."}},
                      {"id": "end", "type": "END", "config": {"message": "Done. I have enough information for this case."}}
                    ],
                    "edges": [
                      {"from": "start", "to": "menu", "matchType": "ALWAYS", "matchValue": ""},
                      {"from": "menu", "to": "ask_order_id", "matchType": "KEYWORD", "matchValue": "order"},
                      {"from": "menu", "to": "ticket", "matchType": "KEYWORD", "matchValue": "ticket"},
                      {"from": "menu", "to": "handoff", "matchType": "KEYWORD", "matchValue": "agent"},
                      {"from": "menu", "to": "menu_retry", "matchType": "FALLBACK", "matchValue": ""},
                      {"from": "menu_retry", "to": "ask_order_id", "matchType": "KEYWORD", "matchValue": "order"},
                      {"from": "menu_retry", "to": "ticket", "matchType": "KEYWORD", "matchValue": "ticket"},
                      {"from": "menu_retry", "to": "handoff", "matchType": "KEYWORD", "matchValue": "agent"},
                      {"from": "menu_retry", "to": "menu_retry", "matchType": "FALLBACK", "matchValue": ""},
                      {"from": "ask_order_id", "to": "lookup", "matchType": "CONDITION", "matchValue": "[a-z][0-9]{3}"},
                      {"from": "ask_order_id", "to": "ask_order_id", "matchType": "FALLBACK", "matchValue": ""},
                      {"from": "lookup", "to": "offer_update", "matchType": "ALWAYS", "matchValue": ""},
                      {"from": "offer_update", "to": "update_status", "matchType": "KEYWORD", "matchValue": "update"},
                      {"from": "offer_update", "to": "ticket", "matchType": "KEYWORD", "matchValue": "ticket"},
                      {"from": "offer_update", "to": "end", "matchType": "KEYWORD", "matchValue": "done"},
                      {"from": "offer_update", "to": "offer_update", "matchType": "FALLBACK", "matchValue": ""},
                      {"from": "update_status", "to": "ask_followup_category", "matchType": "ALWAYS", "matchValue": ""},
                      {"from": "ask_followup_category", "to": "ticket", "matchType": "KEYWORD", "matchValue": "delivery"},
                      {"from": "ask_followup_category", "to": "ticket", "matchType": "KEYWORD", "matchValue": "address"},
                      {"from": "ask_followup_category", "to": "ticket", "matchType": "KEYWORD", "matchValue": "refund"},
                      {"from": "ask_followup_category", "to": "handoff", "matchType": "KEYWORD", "matchValue": "agent"},
                      {"from": "ask_followup_category", "to": "end", "matchType": "KEYWORD", "matchValue": "done"},
                      {"from": "ask_followup_category", "to": "ask_followup_category", "matchType": "FALLBACK", "matchValue": ""},
                      {"from": "ticket", "to": "end", "matchType": "ALWAYS", "matchValue": ""},
                      {"from": "handoff", "to": "end", "matchType": "ALWAYS", "matchValue": ""}
                    ]
                  }
                }
                """;
    }

    private String read(MvcResult result, String field) throws Exception {
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(json.get(field)).as("response field %s", field).isNotNull();
        return json.get(field).asText();
    }
}
