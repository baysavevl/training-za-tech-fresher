package com.zalo.training.conversation.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zalo.training.conversation.multica.MulticaCommandKind;
import com.zalo.training.conversation.multica.MulticaCommandResult;
import com.zalo.training.conversation.multica.MulticaCommandService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Duration;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MulticaController.class)
class MulticaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MulticaCommandService multicaCommandService;

    @Test
    void rejectsMulticaRequestsWithoutControlHeader() throws Exception {
        mockMvc.perform(get("/api/multica/runtimes"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.ok").value(false));
    }

    @Test
    void rejectsNonLocalMulticaRequests() throws Exception {
        mockMvc.perform(get("/api/multica/runtimes")
                        .with(remoteAddress("192.168.1.20"))
                        .header(MulticaLocalRequestGuard.HEADER_NAME, MulticaLocalRequestGuard.HEADER_VALUE))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.ok").value(false));
    }

    @Test
    void returnsRuntimesCommandResult() throws Exception {
        when(multicaCommandService.runtimes()).thenReturn(json(
                MulticaCommandKind.RUNTIME_LIST,
                List.of("multica", "runtime", "list", "--output", "json"),
                """
                        [
                          {"id":"runtime-1","provider":"codex","status":"online"}
                        ]
                        """
        ));

        mockMvc.perform(get("/api/multica/runtimes").with(multicaRequest()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.data[0].provider").value("codex"));
    }

    @Test
    void delegatesCreateIssueRequest() throws Exception {
        when(multicaCommandService.createIssue(any())).thenReturn(json(
                MulticaCommandKind.ISSUE_CREATE,
                List.of("multica", "issue", "create", "--title", "Fix login", "--output", "json"),
                """
                        {"id":"LOCA-1","title":"Fix login"}
                        """
        ));

        mockMvc.perform(post("/api/multica/issues")
                        .with(multicaRequest())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Fix login",
                                  "description": "Patch edge case",
                                  "status": "todo",
                                  "priority": "high",
                                  "projectId": "project-1",
                                  "assigneeId": "agent-1"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.data.id").value("LOCA-1"));

        verify(multicaCommandService).createIssue(new MulticaCommandService.CreateIssueInput(
                "Fix login",
                "Patch edge case",
                "todo",
                "high",
                "project-1",
                "agent-1"
        ));
    }

    @Test
    void returnsCommandLog() throws Exception {
        when(multicaCommandService.commands()).thenReturn(List.of(
                MulticaCommandResult.successText(
                        MulticaCommandKind.DAEMON_STATUS,
                        List.of("multica", "daemon", "status"),
                        "Daemon: running",
                        "",
                        Duration.ofMillis(7)
                )
        ));

        mockMvc.perform(get("/api/multica/commands").with(multicaRequest()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].kind").value("DAEMON_STATUS"))
                .andExpect(jsonPath("$[0].stdout").value("Daemon: running"));
    }

    @Test
    void returnsBadRequestForInvalidMulticaInput() throws Exception {
        when(multicaCommandService.createIssue(any()))
                .thenThrow(new IllegalArgumentException("issue title is required"));

        mockMvc.perform(post("/api/multica/issues")
                        .with(multicaRequest())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.ok").value(false))
                .andExpect(jsonPath("$.message").value("issue title is required"));
    }

    private MulticaCommandResult json(MulticaCommandKind kind, List<String> command, String stdout) {
        return MulticaCommandResult.successJson(kind, command, stdout, objectMapper, Duration.ofMillis(25));
    }

    private RequestPostProcessor multicaRequest() {
        return request -> {
            request.setRemoteAddr("127.0.0.1");
            request.addHeader(MulticaLocalRequestGuard.HEADER_NAME, MulticaLocalRequestGuard.HEADER_VALUE);
            return request;
        };
    }

    private RequestPostProcessor remoteAddress(String remoteAddress) {
        return request -> {
            request.setRemoteAddr(remoteAddress);
            return request;
        };
    }
}
