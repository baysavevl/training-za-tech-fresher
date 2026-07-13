package com.zalo.training.conversation.mockchat;

import com.zalo.training.conversation.domain.ConversationSession;
import com.zalo.training.conversation.domain.ExecutionTrace;
import com.zalo.training.conversation.domain.Message;
import com.zalo.training.conversation.domain.MessageIntent;
import com.zalo.training.conversation.domain.SenderType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/mock-chat")
public class MockChatController {

    private final MockChatChannelAdapter channelAdapter;
    private final MockChatService mockChatService;

    public MockChatController(MockChatChannelAdapter channelAdapter, MockChatService mockChatService) {
        this.channelAdapter = channelAdapter;
        this.mockChatService = mockChatService;
    }

    @PostMapping("/messages")
    public MockIncomingMessageResponse incoming(
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @Valid @RequestBody MockIncomingMessageRequest request
    ) {
        String effectiveRequestId = requestId == null || requestId.isBlank() ? UUID.randomUUID().toString() : requestId;
        MockChatService.MockChatResult result = mockChatService.handleIncoming(channelAdapter.toInbound(request, effectiveRequestId));
        return MockIncomingMessageResponse.from(result);
    }

    @GetMapping("/conversations/{conversationId}/history")
    public HistoryResponse history(@PathVariable("conversationId") UUID conversationId) {
        return new HistoryResponse(mockChatService.history(conversationId).stream().map(MessageItem::from).toList());
    }

    @GetMapping("/conversations/{conversationId}/session")
    public SessionResponse session(@PathVariable("conversationId") UUID conversationId) {
        return SessionResponse.from(mockChatService.session(conversationId));
    }

    @GetMapping("/conversations/{conversationId}/trace")
    public TraceResponse trace(@PathVariable("conversationId") UUID conversationId) {
        return new TraceResponse(mockChatService.trace(conversationId).stream().map(TraceItem::from).toList());
    }

    public record MockIncomingMessageRequest(
            @NotBlank String userId,
            UUID conversationId,
            @NotBlank String messageId,
            @NotNull UUID automationId,
            @NotBlank String text
    ) {
    }

    public record MockIncomingMessageResponse(
            UUID conversationId,
            UUID sessionId,
            String response,
            String currentNodeId,
            UUID responseMessageId,
            boolean duplicate
    ) {
        static MockIncomingMessageResponse from(MockChatService.MockChatResult result) {
            return new MockIncomingMessageResponse(
                    result.conversationId(),
                    result.sessionId(),
                    result.response(),
                    result.currentNodeId(),
                    result.responseMessageId(),
                    result.duplicate()
            );
        }
    }

    public record HistoryResponse(List<MessageItem> items) {
    }

    public record MessageItem(UUID id, SenderType senderType, String content, MessageIntent intent, String traceId, Instant createdAt) {
        static MessageItem from(Message message) {
            return new MessageItem(message.id(), message.senderType(), message.content(), message.intent(), message.traceId(), message.createdAt());
        }
    }

    public record SessionResponse(UUID id, UUID conversationId, String currentNodeId, String status, int version, Instant updatedAt) {
        static SessionResponse from(ConversationSession session) {
            return new SessionResponse(
                    session.id(),
                    session.conversationId(),
                    session.currentNodeId(),
                    session.status().name(),
                    session.version(),
                    session.updatedAt()
            );
        }
    }

    public record TraceResponse(List<TraceItem> items) {
    }

    public record TraceItem(
            UUID id,
            String requestId,
            String messageId,
            UUID conversationId,
            UUID sessionId,
            String nodeId,
            String eventType,
            String detailJson,
            Instant createdAt
    ) {
        static TraceItem from(ExecutionTrace trace) {
            return new TraceItem(
                    trace.id(),
                    trace.requestId(),
                    trace.externalMessageId(),
                    trace.conversationId(),
                    trace.sessionId(),
                    trace.nodeId(),
                    trace.eventType(),
                    trace.detailJson(),
                    trace.createdAt()
            );
        }
    }
}
