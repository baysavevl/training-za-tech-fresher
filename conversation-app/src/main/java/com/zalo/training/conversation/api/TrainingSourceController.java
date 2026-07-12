package com.zalo.training.conversation.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@RestController
public class TrainingSourceController {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".md", ".sql", ".java", ".proto", ".yml", ".yaml");
    private static final List<String> ALLOWED_ROOTS = List.of(
            "docs/",
            "conversation-app/src/",
            "intent-contract/src/",
            "intent-service/src/"
    );

    @GetMapping("/api/training/sources")
    public TrainingSourceResponse readSource(@RequestParam String path) throws IOException {
        String normalizedPath = normalizeRequestPath(path);
        Path repoRoot = findRepoRoot();
        Path sourcePath = repoRoot.resolve(normalizedPath).normalize();

        if (!sourcePath.startsWith(repoRoot)) {
            throw new IllegalArgumentException("source path is outside the training project");
        }
        if (!isAllowedPath(normalizedPath)) {
            throw new IllegalArgumentException("source path is not allowed for training viewer");
        }
        if (!Files.isRegularFile(sourcePath)) {
            throw new IllegalArgumentException("source file does not exist: " + normalizedPath);
        }

        String content = Files.readString(sourcePath, StandardCharsets.UTF_8);
        return new TrainingSourceResponse(normalizedPath, languageFor(normalizedPath), content);
    }

    private String normalizeRequestPath(String path) {
        if (path == null || path.isBlank()) {
            throw new IllegalArgumentException("source path is required");
        }
        String normalized = path.replace('\\', '/').trim();
        if (normalized.startsWith("/") || normalized.contains("../") || normalized.equals("..") || normalized.contains("/../")) {
            throw new IllegalArgumentException("source path is not allowed for training viewer");
        }
        return normalized;
    }

    private boolean isAllowedPath(String path) {
        boolean allowedRoot = path.equals("README.md") || ALLOWED_ROOTS.stream().anyMatch(path::startsWith);
        return allowedRoot && ALLOWED_EXTENSIONS.stream().anyMatch(extension -> path.toLowerCase(Locale.ROOT).endsWith(extension));
    }

    private Path findRepoRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        Path cursor = current;
        while (cursor != null) {
            if (Files.isDirectory(cursor.resolve("docs"))
                    && Files.isDirectory(cursor.resolve("conversation-app"))
                    && Files.isDirectory(cursor.resolve("intent-contract"))
                    && Files.isDirectory(cursor.resolve("intent-service"))) {
                return cursor;
            }
            cursor = cursor.getParent();
        }
        throw new IllegalStateException("could not locate training project root from " + current);
    }

    private String languageFor(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".md")) {
            return "markdown";
        }
        if (lower.endsWith(".sql")) {
            return "sql";
        }
        if (lower.endsWith(".java")) {
            return "java";
        }
        if (lower.endsWith(".proto")) {
            return "protobuf";
        }
        if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
            return "yaml";
        }
        return "text";
    }

    public record TrainingSourceResponse(String path, String language, String content) {
    }
}
