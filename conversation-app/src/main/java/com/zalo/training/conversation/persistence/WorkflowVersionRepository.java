package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.WorkflowStatus;
import com.zalo.training.conversation.domain.WorkflowVersion;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;

@Repository
public class WorkflowVersionRepository {

    private final JdbcClient jdbcClient;

    public WorkflowVersionRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public int nextVersion(UUID automationId) {
        Integer current = jdbcClient.sql("""
                        SELECT COALESCE(MAX(version), 0)
                        FROM workflow_versions
                        WHERE automation_id = :automationId
                        """)
                .param("automationId", automationId)
                .query(Integer.class)
                .single();
        return current + 1;
    }

    public void save(WorkflowVersion version) {
        jdbcClient.sql("""
                        INSERT INTO workflow_versions (id, automation_id, version, status, definition_json, created_at, published_at)
                        VALUES (:id, :automationId, :version, :status, :definitionJson, :createdAt, :publishedAt)
                        """)
                .param("id", version.id())
                .param("automationId", version.automationId())
                .param("version", version.version())
                .param("status", version.status().name())
                .param("definitionJson", version.definitionJson())
                .param("createdAt", version.createdAt())
                .param("publishedAt", version.publishedAt())
                .update();
    }

    public void publish(WorkflowVersion version) {
        jdbcClient.sql("""
                        UPDATE workflow_versions
                        SET status = :status, published_at = :publishedAt
                        WHERE id = :id
                        """)
                .param("id", version.id())
                .param("status", version.status().name())
                .param("publishedAt", version.publishedAt())
                .update();
    }

    public Optional<WorkflowVersion> findById(UUID id) {
        return jdbcClient.sql("""
                        SELECT id, automation_id, version, status, definition_json, created_at, published_at
                        FROM workflow_versions
                        WHERE id = :id
                        """)
                .param("id", id)
                .query(this::map)
                .optional();
    }

    private WorkflowVersion map(ResultSet rs, int rowNum) throws SQLException {
        Timestamp publishedAt = rs.getTimestamp("published_at");
        return new WorkflowVersion(
                rs.getObject("id", UUID.class),
                rs.getObject("automation_id", UUID.class),
                rs.getInt("version"),
                WorkflowStatus.valueOf(rs.getString("status")),
                rs.getString("definition_json"),
                rs.getTimestamp("created_at").toInstant(),
                publishedAt == null ? null : publishedAt.toInstant()
        );
    }
}
