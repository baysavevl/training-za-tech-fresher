package com.zalo.training.conversation.multica;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;

public record MulticaCommandResult(
        boolean ok,
        MulticaCommandKind kind,
        List<String> command,
        Integer exitCode,
        long durationMs,
        String stdout,
        String stderr,
        JsonNode data,
        String message
) {

    public static MulticaCommandResult successText(
            MulticaCommandKind kind,
            List<String> command,
            String stdout,
            String stderr,
            Duration duration
    ) {
        return new MulticaCommandResult(true, kind, List.copyOf(command), 0, duration.toMillis(), stdout, stderr, null, "OK");
    }

    public static MulticaCommandResult successJson(
            MulticaCommandKind kind,
            List<String> command,
            String stdout,
            ObjectMapper objectMapper,
            Duration duration
    ) {
        try {
            JsonNode data = stdout == null || stdout.isBlank() ? objectMapper.nullNode() : objectMapper.readTree(stdout);
            return new MulticaCommandResult(true, kind, List.copyOf(command), 0, duration.toMillis(), stdout, "", data, "OK");
        } catch (Exception exception) {
            return new MulticaCommandResult(
                    false,
                    kind,
                    List.copyOf(command),
                    0,
                    duration.toMillis(),
                    stdout == null ? "" : stdout,
                    "",
                    null,
                    "Failed to parse Multica JSON output: " + exception.getMessage()
            );
        }
    }

    public static MulticaCommandResult failure(
            MulticaCommandKind kind,
            List<String> command,
            Integer exitCode,
            String stdout,
            String stderr,
            Duration duration,
            String message
    ) {
        return new MulticaCommandResult(
                false,
                kind,
                List.copyOf(command),
                exitCode,
                duration.toMillis(),
                stdout == null ? "" : stdout,
                stderr == null ? "" : stderr,
                null,
                message
        );
    }
}
