package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.ConversationSession;
import com.zalo.training.conversation.domain.SessionStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ConversationSessionRepositoryTest {

    @Autowired
    private JdbcClient jdbcClient;

    @Autowired
    private ConversationSessionRepository repository;

    @Test
    void updateIfVersionMatchesRejectsStaleSessionVersion() {
        UUID conversationId = seedConversation();
        UUID automationId = UUID.randomUUID();
        UUID workflowVersionId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        Instant now = Instant.now();

        seedAutomationAndWorkflow(automationId, workflowVersionId, now);
        repository.save(new ConversationSession(
                sessionId,
                conversationId,
                automationId,
                workflowVersionId,
                "start",
                SessionStatus.ACTIVE,
                0,
                now,
                now
        ));

        boolean firstUpdate = repository.updateIfVersionMatches(new ConversationSession(
                sessionId,
                conversationId,
                automationId,
                workflowVersionId,
                "menu",
                SessionStatus.ACTIVE,
                1,
                now,
                now.plusSeconds(1)
        ), 0);
        boolean staleUpdate = repository.updateIfVersionMatches(new ConversationSession(
                sessionId,
                conversationId,
                automationId,
                workflowVersionId,
                "end",
                SessionStatus.COMPLETED,
                1,
                now,
                now.plusSeconds(2)
        ), 0);

        ConversationSession current = repository.findByConversationId(conversationId).orElseThrow();
        assertThat(firstUpdate).isTrue();
        assertThat(staleUpdate).isFalse();
        assertThat(current.currentNodeId()).isEqualTo("menu");
        assertThat(current.status()).isEqualTo(SessionStatus.ACTIVE);
        assertThat(current.version()).isEqualTo(1);
    }

    private UUID seedConversation() {
        UUID customerId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant now = Instant.now();
        jdbcClient.sql("""
                        INSERT INTO customers (id, external_id, display_name, created_at)
                        VALUES (:id, :externalId, :displayName, :createdAt)
                        """)
                .param("id", customerId)
                .param("externalId", "customer-" + customerId)
                .param("displayName", "Test Customer")
                .param("createdAt", now)
                .update();
        jdbcClient.sql("""
                        INSERT INTO conversations (id, customer_id, channel, status, created_at, updated_at)
                        VALUES (:id, :customerId, 'ZALO', 'OPEN', :createdAt, :updatedAt)
                        """)
                .param("id", conversationId)
                .param("customerId", customerId)
                .param("createdAt", now)
                .param("updatedAt", now)
                .update();
        return conversationId;
    }

    private void seedAutomationAndWorkflow(UUID automationId, UUID workflowVersionId, Instant now) {
        jdbcClient.sql("""
                        INSERT INTO automations (id, account_id, name, enabled, active_workflow_version_id, created_at, updated_at)
                        VALUES (:id, :accountId, 'Test automation', true, null, :createdAt, :updatedAt)
                        """)
                .param("id", automationId)
                .param("accountId", "repository-test-account")
                .param("createdAt", now)
                .param("updatedAt", now)
                .update();
        jdbcClient.sql("""
                        INSERT INTO workflow_versions (id, automation_id, version, status, definition_json, created_at, published_at)
                        VALUES (:id, :automationId, 1, 'PUBLISHED', '{}', :createdAt, :publishedAt)
                        """)
                .param("id", workflowVersionId)
                .param("automationId", automationId)
                .param("createdAt", now)
                .param("publishedAt", now)
                .update();
        jdbcClient.sql("""
                        UPDATE automations
                        SET active_workflow_version_id = :workflowVersionId
                        WHERE id = :automationId
                        """)
                .param("workflowVersionId", workflowVersionId)
                .param("automationId", automationId)
                .update();
    }
}
