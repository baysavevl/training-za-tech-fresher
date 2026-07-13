package com.zalo.training.conversation.multica;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MulticaCommandServiceTest {

    @Test
    void buildsCreateIssueCommandWithProjectAndAssignee() {
        RecordingExecutor executor = new RecordingExecutor();
        MulticaCommandService service = new MulticaCommandService(executor, new MulticaCommandLog());

        service.createIssue(new MulticaCommandService.CreateIssueInput(
                "Fix login validation",
                "Patch validation edge cases",
                "todo",
                "high",
                "project-123",
                "agent-456"
        ));

        assertThat(executor.lastCommand()).containsExactly(
                "multica", "issue", "create",
                "--title", "Fix login validation",
                "--description", "Patch validation edge cases",
                "--status", "todo",
                "--priority", "high",
                "--project", "project-123",
                "--assignee-id", "agent-456",
                "--output", "json"
        );
        assertThat(executor.lastParseJson()).isTrue();
    }

    @Test
    void buildsCreateAgentCommandWithRuntimeAndVisibility() {
        RecordingExecutor executor = new RecordingExecutor();
        MulticaCommandService service = new MulticaCommandService(executor, new MulticaCommandLog());

        service.createAgent(new MulticaCommandService.CreateAgentInput(
                "Frontend Agent",
                "runtime-123",
                "Reviews UI work",
                "Focus on accessibility and layout bugs.",
                "workspace"
        ));

        assertThat(executor.lastCommand()).containsExactly(
                "multica", "agent", "create",
                "--name", "Frontend Agent",
                "--runtime-id", "runtime-123",
                "--description", "Reviews UI work",
                "--instructions", "Focus on accessibility and layout bugs.",
                "--visibility", "workspace",
                "--output", "json"
        );
    }

    @Test
    void rejectsInvalidRepoUrl() {
        RecordingExecutor executor = new RecordingExecutor();
        MulticaCommandService service = new MulticaCommandService(executor, new MulticaCommandLog());

        assertThatThrownBy(() -> service.addRepo(new MulticaCommandService.AddRepoInput("file:///etc/passwd", "")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("repo URL");

        assertThatThrownBy(() -> service.addRepo(new MulticaCommandService.AddRepoInput("git@github.com:org/repo.git --flag", "")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("repo URL");

        assertThatThrownBy(() -> service.addRepo(new MulticaCommandService.AddRepoInput("https://token@github.com/org/repo.git", "")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("repo URL");
    }

    @Test
    void rejectsOversizedOptionalTextBeforeRunningCommand() {
        RecordingExecutor executor = new RecordingExecutor();
        MulticaCommandService service = new MulticaCommandService(executor, new MulticaCommandLog());

        assertThatThrownBy(() -> service.createIssue(new MulticaCommandService.CreateIssueInput(
                "Fix login validation",
                "x".repeat(2_001),
                "todo",
                "high",
                "",
                ""
        )))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("issue description is too long");

        assertThat(executor.lastCommand()).isEmpty();
    }

    @Test
    void logsCommandResults() {
        RecordingExecutor executor = new RecordingExecutor();
        MulticaCommandLog log = new MulticaCommandLog();
        MulticaCommandService service = new MulticaCommandService(executor, log);

        service.runtimes();

        assertThat(log.recent()).hasSize(1);
        assertThat(log.recent().getFirst().kind()).isEqualTo(MulticaCommandKind.RUNTIME_LIST);
    }

    private static class RecordingExecutor implements MulticaCommandExecutor {
        private List<String> lastCommand = new ArrayList<>();
        private boolean lastParseJson;

        @Override
        public MulticaCommandResult run(MulticaCommandKind kind, List<String> command, boolean parseJson) {
            this.lastCommand = List.copyOf(command);
            this.lastParseJson = parseJson;
            return MulticaCommandResult.failure(kind, command, 0, "{}", "", Duration.ofMillis(1), "OK");
        }

        List<String> lastCommand() {
            return lastCommand;
        }

        boolean lastParseJson() {
            return lastParseJson;
        }
    }
}
