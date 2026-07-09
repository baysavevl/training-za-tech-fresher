package com.zalo.training.conversation.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TrainingSourceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void readsWhitelistedTrainingMarkdownSource() throws Exception {
        mockMvc.perform(get("/api/training/sources").param("path", "docs/design/database.md"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.path").value("docs/design/database.md"))
                .andExpect(jsonPath("$.language").value("markdown"))
                .andExpect(jsonPath("$.content", containsString("Database")));
    }

    @Test
    void readsWhitelistedSchemaSource() throws Exception {
        mockMvc.perform(get("/api/training/sources").param("path", "conversation-app/src/main/resources/schema.sql"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.path").value("conversation-app/src/main/resources/schema.sql"))
                .andExpect(jsonPath("$.language").value("sql"))
                .andExpect(jsonPath("$.content", containsString("CREATE TABLE")));
    }

    @Test
    void rejectsPathTraversal() throws Exception {
        mockMvc.perform(get("/api/training/sources").param("path", "../pom.xml"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void rejectsBuildOutputPathEvenWhenExtensionIsAllowed() throws Exception {
        mockMvc.perform(get("/api/training/sources").param("path", "conversation-app/target/classes/schema.sql"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }
}
