package com.zalo.training.conversation.api;

import com.zalo.training.conversation.application.ConversationService;
import com.zalo.training.conversation.application.SendMessageResult;
import com.zalo.training.conversation.domain.ActionStatus;
import com.zalo.training.conversation.domain.ActionType;
import com.zalo.training.conversation.domain.Channel;
import com.zalo.training.conversation.domain.Conversation;
import com.zalo.training.conversation.domain.ConversationDetail;
import com.zalo.training.conversation.domain.ConversationStatus;
import com.zalo.training.conversation.domain.Customer;
import com.zalo.training.conversation.domain.MessageIntent;
import com.zalo.training.conversation.domain.SenderType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping("/customers")
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerResponse createCustomer(@Valid @RequestBody CreateCustomerRequest request) {
        return CustomerResponse.from(conversationService.createCustomer(request.externalId(), request.displayName()));
    }

    @PostMapping("/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponse createConversation(@Valid @RequestBody CreateConversationRequest request) {
        return ConversationResponse.from(conversationService.createConversation(request.customerId(), request.channel()));
    }

    @PostMapping("/conversations/{conversationId}/messages")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public SendMessageResponse sendMessage(
            @PathVariable("conversationId") UUID conversationId,
            @RequestHeader(value = "X-Trace-Id", required = false) String traceId,
            @Valid @RequestBody SendMessageRequest request
    ) {
        String effectiveTraceId = traceId == null || traceId.isBlank() ? UUID.randomUUID().toString() : traceId;
        SendMessageResult result = conversationService.receiveMessage(conversationId, request.content(), effectiveTraceId);
        return new SendMessageResponse(result.messageId(), result.conversationId(), result.traceId(), "ACCEPTED");
    }

    @GetMapping("/conversations/{conversationId}")
    public ConversationDetailResponse getConversation(@PathVariable("conversationId") UUID conversationId) {
        return ConversationDetailResponse.from(conversationService.getDetail(conversationId));
    }

    public record CreateCustomerRequest(@NotBlank String externalId, @NotBlank String displayName) {
    }

    public record CustomerResponse(UUID id, String externalId, String displayName, Instant createdAt) {
        static CustomerResponse from(Customer customer) {
            return new CustomerResponse(customer.id(), customer.externalId(), customer.displayName(), customer.createdAt());
        }
    }

    public record CreateConversationRequest(@NotNull UUID customerId, @NotNull Channel channel) {
    }

    public record ConversationResponse(UUID id, UUID customerId, Channel channel, ConversationStatus status, Instant createdAt, Instant updatedAt) {
        static ConversationResponse from(Conversation conversation) {
            return new ConversationResponse(
                    conversation.id(),
                    conversation.customerId(),
                    conversation.channel(),
                    conversation.status(),
                    conversation.createdAt(),
                    conversation.updatedAt()
            );
        }
    }

    public record SendMessageRequest(@NotBlank String content) {
    }

    public record SendMessageResponse(UUID messageId, UUID conversationId, String traceId, String status) {
    }

    public record ConversationDetailResponse(
            UUID id,
            CustomerResponse customer,
            Channel channel,
            ConversationStatus status,
            List<MessageResponse> messages,
            List<AutomationActionResponse> automationActions
    ) {
        static ConversationDetailResponse from(ConversationDetail detail) {
            return new ConversationDetailResponse(
                    detail.conversation().id(),
                    CustomerResponse.from(detail.customer()),
                    detail.conversation().channel(),
                    detail.conversation().status(),
                    detail.messages().stream().map(MessageResponse::from).toList(),
                    detail.automationActions().stream().map(AutomationActionResponse::from).toList()
            );
        }
    }

    public record MessageResponse(
            UUID id,
            SenderType senderType,
            String content,
            MessageIntent intent,
            String traceId,
            Instant createdAt
    ) {
        static MessageResponse from(com.zalo.training.conversation.domain.Message message) {
            return new MessageResponse(
                    message.id(),
                    message.senderType(),
                    message.content(),
                    message.intent(),
                    message.traceId(),
                    message.createdAt()
            );
        }
    }

    public record AutomationActionResponse(
            UUID id,
            ActionType actionType,
            ActionStatus status,
            String idempotencyKey,
            String lastError
    ) {
        static AutomationActionResponse from(com.zalo.training.conversation.domain.AutomationAction action) {
            return new AutomationActionResponse(
                    action.id(),
                    action.actionType(),
                    action.status(),
                    action.idempotencyKey(),
                    action.lastError()
            );
        }
    }
}
