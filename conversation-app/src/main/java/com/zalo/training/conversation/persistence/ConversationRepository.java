package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.Channel;
import com.zalo.training.conversation.domain.Conversation;
import com.zalo.training.conversation.domain.ConversationStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;

@Repository
public class ConversationRepository {

    private final JdbcClient jdbcClient;

    public ConversationRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void save(Conversation conversation) {
        jdbcClient.sql("""
                        INSERT INTO conversations (id, customer_id, channel, status, created_at, updated_at)
                        VALUES (:id, :customerId, :channel, :status, :createdAt, :updatedAt)
                        """)
                .param("id", conversation.id())
                .param("customerId", conversation.customerId())
                .param("channel", conversation.channel().name())
                .param("status", conversation.status().name())
                .param("createdAt", conversation.createdAt())
                .param("updatedAt", conversation.updatedAt())
                .update();
    }

    public Optional<Conversation> findById(UUID id) {
        return jdbcClient.sql("""
                        SELECT id, customer_id, channel, status, created_at, updated_at
                        FROM conversations
                        WHERE id = :id
                        """)
                .param("id", id)
                .query(this::map)
                .optional();
    }

    private Conversation map(ResultSet rs, int rowNum) throws SQLException {
        return new Conversation(
                rs.getObject("id", UUID.class),
                rs.getObject("customer_id", UUID.class),
                Channel.from(rs.getString("channel")),
                ConversationStatus.valueOf(rs.getString("status")),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
        );
    }
}
