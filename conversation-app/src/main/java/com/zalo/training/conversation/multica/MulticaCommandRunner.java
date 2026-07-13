package com.zalo.training.conversation.multica;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@Component
public class MulticaCommandRunner implements MulticaCommandExecutor {

    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(10);
    private static final Set<String> COMMAND_WORDS = Set.of(
            "multica", "daemon", "status", "restart", "runtime", "list",
            "agent", "create", "project", "repo", "add", "issue", "assign"
    );
    private static final Set<String> FLAGS_WITH_DISPLAYABLE_VALUES = Set.of(
            "--output", "--status", "--priority", "--visibility"
    );
    private static final Pattern JWT_PATTERN = Pattern.compile("\\b[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b");
    private static final Pattern COMMON_TOKEN_PATTERN = Pattern.compile("\\b(?:ghp|gho|ghu|ghs|ghr|github_pat|glpat|sk|xox[baprs])-?[A-Za-z0-9_-]{12,}\\b");
    private static final Pattern BEARER_PATTERN = Pattern.compile("(?i)\\bBearer\\s+[A-Za-z0-9._~+/=-]{12,}");
    private static final Pattern PRIVATE_KEY_PATTERN = Pattern.compile("-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----");
    private static final Pattern JSON_SECRET_PATTERN = Pattern.compile("(?i)(\"[A-Za-z0-9_-]*(?:token|secret|password|api[_-]?key)[A-Za-z0-9_-]*\"\\s*:\\s*\")([^\"]+)(\")");
    private static final Pattern SECRET_ASSIGNMENT_PATTERN = Pattern.compile("(?i)\\b([A-Za-z0-9_-]*(?:token|secret|password|api[_-]?key)[A-Za-z0-9_-]*)(\\s*[=:]\\s*)([^\\s,}\\]\"]+)");

    private final ObjectMapper objectMapper;
    private final Duration timeout;

    @Autowired
    public MulticaCommandRunner(ObjectMapper objectMapper) {
        this(objectMapper, DEFAULT_TIMEOUT);
    }

    MulticaCommandRunner(ObjectMapper objectMapper, Duration timeout) {
        this.objectMapper = objectMapper;
        this.timeout = timeout;
    }

    @Override
    public MulticaCommandResult run(MulticaCommandKind kind, List<String> command, boolean parseJson) {
        Instant startedAt = Instant.now();
        List<String> safeCommand = redactCommand(command);
        try {
            Process process = new ProcessBuilder(command).start();
            CompletableFuture<String> stdoutFuture = CompletableFuture.supplyAsync(() -> read(process.getInputStream()));
            CompletableFuture<String> stderrFuture = CompletableFuture.supplyAsync(() -> read(process.getErrorStream()));

            boolean finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
            Duration duration = Duration.between(startedAt, Instant.now());
            if (!finished) {
                process.destroyForcibly();
                return MulticaCommandResult.failure(
                        kind,
                        safeCommand,
                        null,
                        "",
                        "Command timed out after " + timeout.toMillis() + "ms",
                        duration,
                        "Multica CLI command timed out"
                );
            }

            String stdout = redact(stdoutFuture.join());
            String stderr = redact(stderrFuture.join());
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                return MulticaCommandResult.failure(
                        kind,
                        safeCommand,
                        exitCode,
                        stdout,
                        stderr,
                        duration,
                        "Multica CLI command failed"
                );
            }
            if (parseJson) {
                return MulticaCommandResult.successJson(kind, safeCommand, stdout, objectMapper, duration);
            }
            return MulticaCommandResult.successText(kind, safeCommand, stdout, stderr, duration);
        } catch (IOException exception) {
            return MulticaCommandResult.failure(
                    kind,
                    safeCommand,
                    null,
                    "",
                    redact(exception.getMessage()),
                    Duration.between(startedAt, Instant.now()),
                    "Could not start Multica CLI"
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return MulticaCommandResult.failure(
                    kind,
                    safeCommand,
                    null,
                    "",
                    "Interrupted while waiting for command",
                    Duration.between(startedAt, Instant.now()),
                    "Multica CLI command interrupted"
            );
        }
    }

    private String read(java.io.InputStream stream) {
        try {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            return "";
        }
    }

    private String redact(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String withoutPrivateKeys = PRIVATE_KEY_PATTERN.matcher(value).replaceAll("[REDACTED_PRIVATE_KEY]");
        String withoutBearer = BEARER_PATTERN.matcher(withoutPrivateKeys).replaceAll("Bearer [REDACTED]");
        String withoutCommonTokens = COMMON_TOKEN_PATTERN.matcher(withoutBearer).replaceAll("[REDACTED_TOKEN]");
        String withoutJwt = JWT_PATTERN.matcher(withoutCommonTokens).replaceAll("[REDACTED_TOKEN]");
        String withoutJsonSecrets = JSON_SECRET_PATTERN.matcher(withoutJwt).replaceAll("$1[REDACTED]$3");
        return SECRET_ASSIGNMENT_PATTERN.matcher(withoutJsonSecrets).replaceAll("$1$2[REDACTED]");
    }

    private List<String> redactCommand(List<String> command) {
        List<String> redacted = new java.util.ArrayList<>(command.size());
        String previousFlag = null;
        for (String argument : command) {
            String safeArgument = redact(argument);
            if (previousFlag != null) {
                redacted.add(FLAGS_WITH_DISPLAYABLE_VALUES.contains(previousFlag) ? safeArgument : "[ARG]");
                previousFlag = null;
                continue;
            }
            if (argument.startsWith("--")) {
                redacted.add(argument);
                previousFlag = argument;
                continue;
            }
            redacted.add(COMMAND_WORDS.contains(argument) ? safeArgument : "[ARG]");
        }
        return redacted;
    }
}
