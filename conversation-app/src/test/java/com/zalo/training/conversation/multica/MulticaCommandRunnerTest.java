package com.zalo.training.conversation.multica;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MulticaCommandRunnerTest {

    @Test
    void redactsSensitiveCommandArgumentsAndOutputWithoutMaskingVersions() {
        MulticaCommandRunner runner = new MulticaCommandRunner(new ObjectMapper());
        String jwtLikeToken = "eyJhbGciOi.abcdefghij.klmnopqrst";

        MulticaCommandResult result = runner.run(
                MulticaCommandKind.DAEMON_STATUS,
                List.of(
                        javaExecutable(),
                        "-cp",
                        System.getProperty("java.class.path"),
                        MulticaCommandRunnerEchoProcess.class.getName(),
                        "Version: 0.3.43",
                        "token=plain-secret",
                        "{\"apiKey\":\"json-secret\"}",
                        "{\"access_token\":\"access-secret\"}",
                        "Bearer bearer-secret-123456",
                        "ghp_abcdefghijklmnopqrstuvwxyz123456",
                        jwtLikeToken
                ),
                false
        );

        String command = String.join(" ", result.command());
        assertThat(result.ok()).isTrue();
        assertThat(command)
                .contains("[ARG]")
                .doesNotContain("plain-secret")
                .doesNotContain("json-secret")
                .doesNotContain("access-secret")
                .doesNotContain("bearer-secret")
                .doesNotContain("abcdefghijklmnopqrstuvwxyz")
                .doesNotContain(jwtLikeToken);
        assertThat(result.stdout())
                .contains("Version: 0.3.43")
                .contains("token=[REDACTED]")
                .contains("\"apiKey\":\"[REDACTED]\"")
                .contains("\"access_token\":\"[REDACTED]\"")
                .contains("Bearer [REDACTED]")
                .contains("[REDACTED_TOKEN]")
                .doesNotContain("plain-secret")
                .doesNotContain("json-secret")
                .doesNotContain("access-secret")
                .doesNotContain("bearer-secret")
                .doesNotContain("abcdefghijklmnopqrstuvwxyz")
                .doesNotContain(jwtLikeToken);
    }

    @Test
    void parsesJsonOutput() {
        MulticaCommandRunner runner = new MulticaCommandRunner(new ObjectMapper());

        MulticaCommandResult result = runner.run(
                MulticaCommandKind.RUNTIME_LIST,
                List.of(
                        javaExecutable(),
                        "-cp",
                        System.getProperty("java.class.path"),
                        MulticaCommandRunnerEchoProcess.class.getName(),
                        "{\"items\":[{\"id\":\"runtime-1\"}]}"
                ),
                true
        );

        assertThat(result.ok()).isTrue();
        assertThat(result.data().get("items").get(0).get("id").asText()).isEqualTo("runtime-1");
    }

    @Test
    void returnsFailureForNonZeroExit() {
        MulticaCommandRunner runner = new MulticaCommandRunner(new ObjectMapper());

        MulticaCommandResult result = runner.run(
                MulticaCommandKind.DAEMON_STATUS,
                List.of(
                        javaExecutable(),
                        "-cp",
                        System.getProperty("java.class.path"),
                        MulticaCommandRunnerExitProcess.class.getName()
                ),
                false
        );

        assertThat(result.ok()).isFalse();
        assertThat(result.exitCode()).isEqualTo(7);
        assertThat(result.stderr()).contains("failed");
    }

    @Test
    void timesOutLongRunningCommands() {
        MulticaCommandRunner runner = new MulticaCommandRunner(new ObjectMapper(), Duration.ofMillis(100));

        MulticaCommandResult result = runner.run(
                MulticaCommandKind.DAEMON_STATUS,
                List.of(
                        javaExecutable(),
                        "-cp",
                        System.getProperty("java.class.path"),
                        MulticaCommandRunnerSleepProcess.class.getName()
                ),
                false
        );

        assertThat(result.ok()).isFalse();
        assertThat(result.message()).isEqualTo("Multica CLI command timed out");
    }

    private String javaExecutable() {
        String executable = System.getProperty("os.name", "").toLowerCase().contains("win") ? "java.exe" : "java";
        return Path.of(System.getProperty("java.home"), "bin", executable).toString();
    }
}

class MulticaCommandRunnerEchoProcess {

    public static void main(String[] args) {
        for (String arg : args) {
            System.out.println(arg);
        }
    }
}

class MulticaCommandRunnerExitProcess {

    public static void main(String[] args) {
        System.err.println("failed");
        System.exit(7);
    }
}

class MulticaCommandRunnerSleepProcess {

    public static void main(String[] args) throws Exception {
        Thread.sleep(5_000);
    }
}
