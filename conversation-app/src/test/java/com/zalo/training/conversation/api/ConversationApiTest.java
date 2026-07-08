package com.zalo.training.conversation.api;

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
class ConversationApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createsConversationReceivesMessageAndFetchesDetail() throws Exception {
        MvcResult customerResult = mockMvc.perform(post("/api/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "externalId": "customer-api-001",
                                  "displayName": "Le Thi C"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.externalId").value("customer-api-001"))
                .andReturn();

        String customerId = read(customerResult, "id");

        MvcResult conversationResult = mockMvc.perform(post("/api/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "customerId": "%s",
                                  "channel": "ZALO"
                                }
                                """.formatted(customerId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andReturn();

        String conversationId = read(conversationResult, "id");

        MvcResult messageResult = mockMvc.perform(post("/api/conversations/{conversationId}/messages", conversationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Trace-Id", "trace-api-test")
                        .content("""
                                {
                                  "content": "Cho toi kiem tra don hang #A123"
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.messageId").isNotEmpty())
                .andExpect(jsonPath("$.traceId").value("trace-api-test"))
                .andReturn();

        String messageId = read(messageResult, "messageId");

        mockMvc.perform(get("/api/conversations/{conversationId}", conversationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(conversationId))
                .andExpect(jsonPath("$.messages[0].id").value(messageId))
                .andExpect(jsonPath("$.messages[0].senderType").value("CUSTOMER"))
                .andExpect(jsonPath("$.messages[0].content").value("Cho toi kiem tra don hang #A123"));
    }

    private String read(MvcResult result, String field) throws Exception {
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(json.get(field)).as("response field %s", field).isNotNull();
        return json.get(field).asText();
    }
}
