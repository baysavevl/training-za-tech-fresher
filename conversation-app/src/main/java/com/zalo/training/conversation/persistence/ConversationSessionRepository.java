package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.ConversationSession;
import com.zalo.training.conversation.domain.SessionStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;

@Repository
public class ConversationSessionRepository {

    private final JdbcClient jdbcClient;

    public ConversationSessionRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void save(ConversationSession session) {
        jdbcClient.sql("""
                        INSERT INTO conversation_sessions (
                            id, conversation_id, automation_id, workflow_version_id, current_node_id,
                            status, version, created_at, updated_at
                        )
                        VALUES (
                            :id, :conversationId, :automationId, :workflowVersionId, :currentNodeId,
                            :status, :version, :createdAt, :updatedAt
                        )
                        """)
                .param("id", session.id())
                .param("conversationId", session.conversationId())
                .param("automationId", session.automationId())
                .param("workflowVersionId", session.workflowVersionId())
                .param("currentNodeId", session.currentNodeId())
                .param("status", session.status().name())
                .param("version", session.version())
                .param("createdAt", session.createdAt())
                .param("updatedAt", session.updatedAt())
                .update();
    }

    public void update(ConversationSession session) {
        if (!updateIfVersionMatches(session, session.version() - 1)) {
            throw new IllegalStateException("conversation session version mismatch: " + session.id());
        }
    }

    public boolean updateIfVersionMatches(ConversationSession session, int expectedVersion) {
        int updatedRows = jdbcClient.sql("""
                                UPDATE conversation_sessions
                                SET current_node_id = :currentNodeId,
                                    status = :status,
                                    version = :version,
                                    updated_at = :updatedAt
                                WHERE id = :id AND version = :expectedVersion
                                """)
                .param("id", session.id())
                .param("currentNodeId", session.currentNodeId())
                .param("status", session.status().name())
                .param("version", session.version())
                .param("updatedAt", session.updatedAt())
                .param("expectedVersion", expectedVersion)
                .update();
        return updatedRows == 1;
    }

    public Optional<ConversationSession> findByConversationId(UUID conversationId) {
        return jdbcClient.sql("""
                        SELECT *
                        FROM conversation_sessions
                        WHERE conversation_id = :conversationId
                        """)
                .param("conversationId", conversationId)
                .query(this::map)
                .optional();
    }

    private ConversationSession map(ResultSet rs, int rowNum) throws SQLException {
        return new ConversationSession(
                rs.getObject("id", UUID.class),
                rs.getObject("conversation_id", UUID.class),
                rs.getObject("automation_id", UUID.class),
                rs.getObject("workflow_version_id", UUID.class),
                rs.getString("current_node_id"),
                SessionStatus.valueOf(rs.getString("status")),
                rs.getInt("version"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
        );
    }
}
