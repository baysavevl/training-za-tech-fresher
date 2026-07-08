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

    public Optional<UUID> findResponseMessageId(UUID conversationId, String externalMessageId) {
        return jdbcClient.sql("""
                        SELECT response_message_id
                        FROM message_idempotency
                        WHERE conversation_id = :conversationId AND external_message_id = :externalMessageId
                        """)
                .param("conversationId", conversationId)
                .param("externalMessageId", externalMessageId)
                .query((rs, rowNum) -> rs.getObject("response_message_id", UUID.class))
                .optional();
    }

    public void save(UUID conversationId, String externalMessageId, UUID requestMessageId, UUID responseMessageId, Instant createdAt) {
        jdbcClient.sql("""
                        INSERT INTO message_idempotency (
                            conversation_id, external_message_id, request_message_id, response_message_id, created_at
                        )
                        VALUES (:conversationId, :externalMessageId, :requestMessageId, :responseMessageId, :createdAt)
                        """)
                .param("conversationId", conversationId)
                .param("externalMessageId", externalMessageId)
                .param("requestMessageId", requestMessageId)
                .param("responseMessageId", responseMessageId)
                .param("createdAt", createdAt)
                .update();
    }
}
