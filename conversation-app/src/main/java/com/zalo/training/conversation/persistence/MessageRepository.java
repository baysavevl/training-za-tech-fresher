package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.Message;
import com.zalo.training.conversation.domain.MessageIntent;
import com.zalo.training.conversation.domain.SenderType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class MessageRepository {

    private final JdbcClient jdbcClient;

    public MessageRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void save(Message message) {
        jdbcClient.sql("""
                        INSERT INTO messages (id, conversation_id, sender_type, content, intent, trace_id, created_at)
                        VALUES (:id, :conversationId, :senderType, :content, :intent, :traceId, :createdAt)
                        """)
                .param("id", message.id())
                .param("conversationId", message.conversationId())
                .param("senderType", message.senderType().name())
                .param("content", message.content())
                .param("intent", message.intent() == null ? null : message.intent().name())
                .param("traceId", message.traceId())
                .param("createdAt", message.createdAt())
                .update();
    }

    public Optional<Message> findById(UUID id) {
        return jdbcClient.sql("""
                        SELECT id, conversation_id, sender_type, content, intent, trace_id, created_at
                        FROM messages
                        WHERE id = :id
                        """)
                .param("id", id)
                .query(this::map)
                .optional();
    }

    public List<Message> findByConversationId(UUID conversationId) {
        return jdbcClient.sql("""
                        SELECT id, conversation_id, sender_type, content, intent, trace_id, created_at
                        FROM messages
                        WHERE conversation_id = :conversationId
                        ORDER BY created_at ASC
                        """)
                .param("conversationId", conversationId)
                .query(this::map)
                .list();
    }

    public void updateIntent(UUID id, MessageIntent intent) {
        jdbcClient.sql("""
                        UPDATE messages
                        SET intent = :intent
                        WHERE id = :id
                        """)
                .param("id", id)
                .param("intent", intent.name())
                .update();
    }

    private Message map(ResultSet rs, int rowNum) throws SQLException {
        String intent = rs.getString("intent");
        return new Message(
                rs.getObject("id", UUID.class),
                rs.getObject("conversation_id", UUID.class),
                SenderType.valueOf(rs.getString("sender_type")),
                rs.getString("content"),
                intent == null ? null : MessageIntent.from(intent),
                rs.getString("trace_id"),
                rs.getTimestamp("created_at").toInstant()
        );
    }
}
