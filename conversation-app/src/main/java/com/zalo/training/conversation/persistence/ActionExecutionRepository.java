package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.ActionExecution;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ActionExecutionRepository {

    private final JdbcClient jdbcClient;

    public ActionExecutionRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void save(ActionExecution execution) {
        jdbcClient.sql("""
                        INSERT INTO action_executions (
                            id, trace_id, conversation_id, session_id, node_id, action_name, status,
                            request_json, response_json, attempt_count, created_at, updated_at
                        )
                        VALUES (
                            :id, :traceId, :conversationId, :sessionId, :nodeId, :actionName, :status,
                            :requestJson, :responseJson, :attemptCount, :createdAt, :updatedAt
                        )
                        """)
                .param("id", execution.id())
                .param("traceId", execution.traceId())
                .param("conversationId", execution.conversationId())
                .param("sessionId", execution.sessionId())
                .param("nodeId", execution.nodeId())
                .param("actionName", execution.actionName())
                .param("status", execution.status().name())
                .param("requestJson", execution.requestJson())
                .param("responseJson", execution.responseJson())
                .param("attemptCount", execution.attemptCount())
                .param("createdAt", execution.createdAt())
                .param("updatedAt", execution.updatedAt())
                .update();
    }
}
