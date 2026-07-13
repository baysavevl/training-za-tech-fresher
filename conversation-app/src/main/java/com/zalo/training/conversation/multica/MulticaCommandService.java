package com.zalo.training.conversation.multica;

import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class MulticaCommandService {

    private static final int MAX_OPTIONAL_TEXT_LENGTH = 2_000;
    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_.:-]{0,120}");
    private static final Pattern GIT_SSH_REPO = Pattern.compile("git@[A-Za-z0-9.-]+:[A-Za-z0-9._~/-]+(?:\\.git)?");

    private final MulticaCommandExecutor executor;
    private final MulticaCommandLog commandLog;

    public MulticaCommandService(MulticaCommandExecutor executor, MulticaCommandLog commandLog) {
        this.executor = executor;
        this.commandLog = commandLog;
    }

    public MulticaCommandResult status() {
        return executeText(MulticaCommandKind.DAEMON_STATUS, List.of("multica", "daemon", "status"));
    }

    public MulticaCommandResult runtimes() {
        return executeJson(MulticaCommandKind.RUNTIME_LIST, List.of("multica", "runtime", "list"));
    }

    public MulticaCommandResult agents() {
        return executeJson(MulticaCommandKind.AGENT_LIST, List.of("multica", "agent", "list"));
    }

    public MulticaCommandResult createAgent(CreateAgentInput input) {
        requireText(input.name(), "agent name");
        requireIdentifier(input.runtimeId(), "runtime id");
        List<String> args = new ArrayList<>(List.of(
                "multica", "agent", "create",
                "--name", input.name().trim(),
                "--runtime-id", input.runtimeId().trim()
        ));
        addOptionalText(args, "--description", input.description(), "agent description");
        addOptionalText(args, "--instructions", input.instructions(), "agent instructions");
        args.add("--visibility");
        args.add(normalizeVisibility(input.visibility()));
        return executeJson(MulticaCommandKind.AGENT_CREATE, args);
    }

    public MulticaCommandResult projects() {
        return executeJson(MulticaCommandKind.PROJECT_LIST, List.of("multica", "project", "list"));
    }

    public MulticaCommandResult createProject(CreateProjectInput input) {
        requireText(input.title(), "project title");
        List<String> args = new ArrayList<>(List.of("multica", "project", "create", "--title", input.title().trim()));
        addOptionalText(args, "--description", input.description(), "project description");
        if (input.repoUrl() != null && !input.repoUrl().isBlank()) {
            requireRepoUrl(input.repoUrl());
            args.add("--repo");
            args.add(input.repoUrl().trim());
        }
        return executeJson(MulticaCommandKind.PROJECT_CREATE, args);
    }

    public MulticaCommandResult repos() {
        return executeJson(MulticaCommandKind.REPO_LIST, List.of("multica", "repo", "list"));
    }

    public MulticaCommandResult addRepo(AddRepoInput input) {
        requireRepoUrl(input.url());
        List<String> args = new ArrayList<>(List.of("multica", "repo", "add", "--url", input.url().trim()));
        addOptionalText(args, "--description", input.description(), "repo description");
        return executeJson(MulticaCommandKind.REPO_ADD, args);
    }

    public MulticaCommandResult issues() {
        return executeJson(MulticaCommandKind.ISSUE_LIST, List.of("multica", "issue", "list"));
    }

    public MulticaCommandResult createIssue(CreateIssueInput input) {
        requireText(input.title(), "issue title");
        List<String> args = new ArrayList<>(List.of("multica", "issue", "create", "--title", input.title().trim()));
        addOptionalText(args, "--description", input.description(), "issue description");
        addOptionalText(args, "--status", input.status(), "issue status");
        addOptionalText(args, "--priority", input.priority(), "issue priority");
        if (input.projectId() != null && !input.projectId().isBlank()) {
            requireIdentifier(input.projectId(), "project id");
            args.add("--project");
            args.add(input.projectId().trim());
        }
        if (input.assigneeId() != null && !input.assigneeId().isBlank()) {
            requireIdentifier(input.assigneeId(), "assignee id");
            args.add("--assignee-id");
            args.add(input.assigneeId().trim());
        }
        return executeJson(MulticaCommandKind.ISSUE_CREATE, args);
    }

    public MulticaCommandResult assignIssue(String issueId, AssignIssueInput input) {
        requireIdentifier(issueId, "issue id");
        requireIdentifier(input.assigneeId(), "assignee id");
        return executeJson(MulticaCommandKind.ISSUE_ASSIGN, List.of(
                "multica", "issue", "assign", issueId.trim(), "--to-id", input.assigneeId().trim()
        ));
    }

    public MulticaCommandResult restartDaemon() {
        return executeText(MulticaCommandKind.DAEMON_RESTART, List.of("multica", "daemon", "restart"));
    }

    public List<MulticaCommandResult> commands() {
        return commandLog.recent();
    }

    private MulticaCommandResult executeJson(MulticaCommandKind kind, List<String> args) {
        List<String> command = withOutputJson(args);
        MulticaCommandResult result = executor.run(kind, command, true);
        commandLog.record(result);
        return result;
    }

    private MulticaCommandResult executeText(MulticaCommandKind kind, List<String> command) {
        MulticaCommandResult result = executor.run(kind, command, false);
        commandLog.record(result);
        return result;
    }

    private List<String> withOutputJson(List<String> args) {
        ArrayList<String> command = new ArrayList<>(args);
        command.add("--output");
        command.add("json");
        return command;
    }

    private void addOptionalText(List<String> args, String flag, String value, String label) {
        if (value != null && !value.isBlank()) {
            if (value.length() > MAX_OPTIONAL_TEXT_LENGTH) {
                throw new IllegalArgumentException(label + " is too long");
            }
            args.add(flag);
            args.add(value.trim());
        }
    }

    private String normalizeVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return "private";
        }
        String normalized = visibility.trim().toLowerCase();
        if (!normalized.equals("private") && !normalized.equals("workspace")) {
            throw new IllegalArgumentException("visibility must be private or workspace");
        }
        return normalized;
    }

    private void requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " is required");
        }
        if (value.length() > 240) {
            throw new IllegalArgumentException(label + " is too long");
        }
    }

    private void requireIdentifier(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " is required");
        }
        if (!SAFE_IDENTIFIER.matcher(value.trim()).matches()) {
            throw new IllegalArgumentException(label + " is invalid");
        }
    }

    private void requireRepoUrl(String url) {
        requireText(url, "repo URL");
        String value = url.trim();
        if (value.startsWith("git@")) {
            if (!GIT_SSH_REPO.matcher(value).matches()) {
                throw new IllegalArgumentException("repo URL is invalid");
            }
            return;
        }
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            if ((scheme == null || (!scheme.equals("https") && !scheme.equals("http") && !scheme.equals("ssh") && !scheme.equals("git")))
                    || uri.getHost() == null
                    || uri.getUserInfo() != null) {
                throw new IllegalArgumentException("repo URL must be http, https, ssh, git, or git@ style");
            }
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("repo URL is invalid");
        }
    }

    public record CreateAgentInput(String name, String runtimeId, String description, String instructions, String visibility) {
    }

    public record CreateProjectInput(String title, String description, String repoUrl) {
    }

    public record AddRepoInput(String url, String description) {
    }

    public record CreateIssueInput(
            String title,
            String description,
            String status,
            String priority,
            String projectId,
            String assigneeId
    ) {
    }

    public record AssignIssueInput(String assigneeId) {
    }
}
