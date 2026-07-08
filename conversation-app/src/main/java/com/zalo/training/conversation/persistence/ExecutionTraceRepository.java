package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.ExecutionTrace;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

@Repository
public class ExecutionTraceRepository {

    private final JdbcClient jdbcClient;

    public ExecutionTraceRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void save(ExecutionTrace trace) {
        jdbcClient.sql("""
                        INSERT INTO execution_traces (
                            id, request_id, external_message_id, conversation_id, session_id,
                            node_id, event_type, detail_json, created_at
                        )
                        VALUES (
                            :id, :requestId, :externalMessageId, :conversationId, :sessionId,
                            :nodeId, :eventType, :detailJson, :createdAt
                        )
                        """)
                .param("id", trace.id())
                .param("requestId", trace.requestId())
                .param("externalMessageId", trace.externalMessageId())
                .param("conversationId", trace.conversationId())
                .param("sessionId", trace.sessionId())
                .param("nodeId", trace.nodeId())
                .param("eventType", trace.eventType())
                .param("detailJson", trace.detailJson())
                .param("createdAt", trace.createdAt())
                .update();
    }

    public List<ExecutionTrace> findByConversationId(UUID conversationId) {
        return jdbcClient.sql("""
                        SELECT *
                        FROM execution_traces
                        WHERE conversation_id = :conversationId
                        ORDER BY created_at ASC
                        """)
                .param("conversationId", conversationId)
                .query(this::map)
                .list();
    }

    private ExecutionTrace map(ResultSet rs, int rowNum) throws SQLException {
        return new ExecutionTrace(
                rs.getObject("id", UUID.class),
                rs.getString("request_id"),
                rs.getString("external_message_id"),
                rs.getObject("conversation_id", UUID.class),
                rs.getObject("session_id", UUID.class),
                rs.getString("node_id"),
                rs.getString("event_type"),
                rs.getString("detail_json"),
                rs.getTimestamp("created_at").toInstant()
        );
    }
}
