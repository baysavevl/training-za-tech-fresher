package com.zalo.training.conversation.persistence;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public class MessageIdempotencyRepository {

    private final JdbcClient jdbcClient;

    public MessageIdempotencyRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<MessageIdempotencyRecord> findByMessage(UUID conversationId, String externalMessageId) {
        return jdbcClient.sql("""
                        SELECT response_message_id, execution_trace_id
                        FROM message_idempotency
                        WHERE conversation_id = :conversationId AND external_message_id = :externalMessageId
                        """)
                .param("conversationId", conversationId)
                .param("externalMessageId", externalMessageId)
                .query((rs, rowNum) -> new MessageIdempotencyRecord(
                        rs.getObject("response_message_id", UUID.class),
                        rs.getObject("execution_trace_id", UUID.class)
                ))
                .optional();
    }

    public void save(
            UUID conversationId,
            String externalMessageId,
            UUID requestMessageId,
            UUID responseMessageId,
            UUID executionTraceId,
            Instant createdAt
    ) {
        jdbcClient.sql("""
                        INSERT INTO message_idempotency (
                            conversation_id, external_message_id, request_message_id,
                            response_message_id, execution_trace_id, created_at
                        )
                        VALUES (
                            :conversationId, :externalMessageId, :requestMessageId,
                            :responseMessageId, :executionTraceId, :createdAt
                        )
                        """)
                .param("conversationId", conversationId)
                .param("externalMessageId", externalMessageId)
                .param("requestMessageId", requestMessageId)
                .param("responseMessageId", responseMessageId)
                .param("executionTraceId", executionTraceId)
                .param("createdAt", createdAt)
                .update();
    }

    public record MessageIdempotencyRecord(UUID responseMessageId, UUID executionTraceId) {
    }
}
