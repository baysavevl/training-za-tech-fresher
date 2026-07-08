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

import static org.assertj.core.api.Assertions.assertThat;
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
    void publishesWorkflowProcessesIncomingMessageAndExposesTrace() throws Exception {
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
                        .content("""
                                {
                                  "definition": {
                                    "nodes": [
                                      {"id": "start", "type": "START", "config": {}},
                                      {"id": "ask", "type": "QUESTION", "config": {"message": "Ban can ho tro gi?"}},
                                      {"id": "lookup", "type": "ACTION", "config": {"action": "ORDER_LOOKUP"}},
                                      {"id": "end", "type": "END", "config": {"message": "Da xu ly xong"}}
                                    ],
                                    "edges": [
                                      {"from": "start", "to": "ask", "matchType": "ALWAYS", "matchValue": ""},
                                      {"from": "ask", "to": "lookup", "matchType": "KEYWORD", "matchValue": "don hang"},
                                      {"from": "ask", "to": "end", "matchType": "FALLBACK", "matchValue": ""},
                                      {"from": "lookup", "to": "end", "matchType": "ALWAYS", "matchValue": ""}
                                    ]
                                  }
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn(), "id");

        mockMvc.perform(post("/api/automations/{automationId}/workflows/{workflowVersionId}/publish", automationId, workflowVersionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        MvcResult chatResult = mockMvc.perform(post("/api/mock-chat/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Request-Id", "request-flow-test")
                        .content("""
                                {
                                  "userId": "mock-user-001",
                                  "messageId": "msg-001",
                                  "automationId": "%s",
                                  "text": "toi muon xem don hang A123"
                                }
                                """.formatted(automationId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversationId").isNotEmpty())
                .andExpect(jsonPath("$.sessionId").isNotEmpty())
                .andExpect(jsonPath("$.response").value("Order A123 dang duoc xu ly."))
                .andExpect(jsonPath("$.duplicate").value(false))
                .andReturn();

        String conversationId = read(chatResult, "conversationId");
        String responseMessageId = read(chatResult, "responseMessageId");

        mockMvc.perform(post("/api/mock-chat/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Request-Id", "request-flow-test-duplicate")
                        .content("""
                                {
                                  "userId": "mock-user-001",
                                  "conversationId": "%s",
                                  "messageId": "msg-001",
                                  "automationId": "%s",
                                  "text": "toi muon xem don hang A123"
                                }
                                """.formatted(conversationId, automationId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(true))
                .andExpect(jsonPath("$.responseMessageId").value(responseMessageId))
                .andExpect(jsonPath("$.response").value("Order A123 dang duoc xu ly."));

        mockMvc.perform(get("/api/mock-chat/conversations/{conversationId}/history", conversationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2));

        mockMvc.perform(get("/api/mock-chat/conversations/{conversationId}/trace", conversationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].requestId").value("request-flow-test"))
                .andExpect(jsonPath("$.items[0].messageId").value("msg-001"));
    }

    private String read(MvcResult result, String field) throws Exception {
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(json.get(field)).as("response field %s", field).isNotNull();
        return json.get(field).asText();
    }
}
