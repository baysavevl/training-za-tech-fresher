package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.ActionStatus;
import com.zalo.training.conversation.domain.ActionType;
import com.zalo.training.conversation.domain.AutomationAction;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AutomationActionRepository {

    private final JdbcClient jdbcClient;

    public AutomationActionRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void save(AutomationAction action) {
        jdbcClient.sql("""
                        INSERT INTO automation_actions (
                            id, conversation_id, source_message_id, rule_id, action_type, status,
                            result_message_id, attempt_count, idempotency_key, last_error, created_at, updated_at
                        )
                        VALUES (
                            :id, :conversationId, :sourceMessageId, :ruleId, :actionType, :status,
                            :resultMessageId, :attemptCount, :idempotencyKey, :lastError, :createdAt, :updatedAt
                        )
                        """)
                .param("id", action.id())
                .param("conversationId", action.conversationId())
                .param("sourceMessageId", action.sourceMessageId())
                .param("ruleId", action.ruleId())
                .param("actionType", action.actionType().name())
                .param("status", action.status().name())
                .param("resultMessageId", action.resultMessageId())
                .param("attemptCount", action.attemptCount())
                .param("idempotencyKey", action.idempotencyKey())
                .param("lastError", action.lastError())
                .param("createdAt", action.createdAt())
                .param("updatedAt", action.updatedAt())
                .update();
    }

    public Optional<AutomationAction> findByIdempotencyKey(String idempotencyKey) {
        return jdbcClient.sql("""
                        SELECT *
                        FROM automation_actions
                        WHERE idempotency_key = :idempotencyKey
                        """)
                .param("idempotencyKey", idempotencyKey)
                .query(this::map)
                .optional();
    }

    public List<AutomationAction> findByConversationId(UUID conversationId) {
        return jdbcClient.sql("""
                        SELECT *
                        FROM automation_actions
                        WHERE conversation_id = :conversationId
                        ORDER BY created_at ASC
                        """)
                .param("conversationId", conversationId)
                .query(this::map)
                .list();
    }

    private AutomationAction map(ResultSet rs, int rowNum) throws SQLException {
        return new AutomationAction(
                rs.getObject("id", UUID.class),
                rs.getObject("conversation_id", UUID.class),
                rs.getObject("source_message_id", UUID.class),
                rs.getObject("rule_id", UUID.class),
                ActionType.valueOf(rs.getString("action_type")),
                ActionStatus.valueOf(rs.getString("status")),
                rs.getObject("result_message_id", UUID.class),
                rs.getInt("attempt_count"),
                rs.getString("idempotency_key"),
                rs.getString("last_error"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
        );
    }
}
