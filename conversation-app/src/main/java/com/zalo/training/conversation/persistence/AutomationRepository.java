package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.Automation;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AutomationRepository {

    private final JdbcClient jdbcClient;

    public AutomationRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void save(Automation automation) {
        jdbcClient.sql("""
                        INSERT INTO automations (id, account_id, name, enabled, active_workflow_version_id, created_at, updated_at)
                        VALUES (:id, :accountId, :name, :enabled, :activeWorkflowVersionId, :createdAt, :updatedAt)
                        """)
                .param("id", automation.id())
                .param("accountId", automation.accountId())
                .param("name", automation.name())
                .param("enabled", automation.enabled())
                .param("activeWorkflowVersionId", automation.activeWorkflowVersionId())
                .param("createdAt", automation.createdAt())
                .param("updatedAt", automation.updatedAt())
                .update();
    }

    public void update(Automation automation) {
        jdbcClient.sql("""
                        UPDATE automations
                        SET account_id = :accountId,
                            name = :name,
                            enabled = :enabled,
                            active_workflow_version_id = :activeWorkflowVersionId,
                            updated_at = :updatedAt
                        WHERE id = :id
                        """)
                .param("id", automation.id())
                .param("accountId", automation.accountId())
                .param("name", automation.name())
                .param("enabled", automation.enabled())
                .param("activeWorkflowVersionId", automation.activeWorkflowVersionId())
                .param("updatedAt", automation.updatedAt())
                .update();
    }

    public Optional<Automation> findById(UUID id) {
        return jdbcClient.sql("""
                        SELECT id, account_id, name, enabled, active_workflow_version_id, created_at, updated_at
                        FROM automations
                        WHERE id = :id
                        """)
                .param("id", id)
                .query(this::map)
                .optional();
    }

    public Optional<Automation> findActiveByAccountId(String accountId) {
        return jdbcClient.sql("""
                        SELECT id, account_id, name, enabled, active_workflow_version_id, created_at, updated_at
                        FROM automations
                        WHERE account_id = :accountId
                          AND enabled = true
                          AND active_workflow_version_id IS NOT NULL
                        ORDER BY updated_at DESC
                        LIMIT 1
                        """)
                .param("accountId", accountId)
                .query(this::map)
                .optional();
    }

    private Automation map(ResultSet rs, int rowNum) throws SQLException {
        return new Automation(
                rs.getObject("id", UUID.class),
                rs.getString("account_id"),
                rs.getString("name"),
                rs.getBoolean("enabled"),
                rs.getObject("active_workflow_version_id", UUID.class),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
        );
    }
}
