package com.zalo.training.conversation.application;

import com.zalo.training.conversation.automation.MessageEventPublisher;
import com.zalo.training.conversation.automation.MessageReceivedEvent;
import com.zalo.training.conversation.domain.Channel;
import com.zalo.training.conversation.domain.Conversation;
import com.zalo.training.conversation.domain.ConversationDetail;
import com.zalo.training.conversation.domain.ConversationStatus;
import com.zalo.training.conversation.domain.Customer;
import com.zalo.training.conversation.domain.Message;
import com.zalo.training.conversation.domain.SenderType;
import com.zalo.training.conversation.persistence.AutomationActionRepository;
import com.zalo.training.conversation.persistence.ConversationRepository;
import com.zalo.training.conversation.persistence.CustomerRepository;
import com.zalo.training.conversation.persistence.MessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class ConversationService {

    private final CustomerRepository customerRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final AutomationActionRepository automationActionRepository;
    private final MessageEventPublisher messageEventPublisher;

    public ConversationService(
            CustomerRepository customerRepository,
            ConversationRepository conversationRepository,
            MessageRepository messageRepository,
            AutomationActionRepository automationActionRepository,
            MessageEventPublisher messageEventPublisher
    ) {
        this.customerRepository = customerRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.automationActionRepository = automationActionRepository;
        this.messageEventPublisher = messageEventPublisher;
    }

    @Transactional
    public Customer createCustomer(String externalId, String displayName) {
        Customer customer = new Customer(UUID.randomUUID(), externalId, displayName, Instant.now());
        customerRepository.save(customer);
        return customer;
    }

    @Transactional
    public Conversation createConversation(UUID customerId, Channel channel) {
        customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("customer not found: " + customerId));
        Instant now = Instant.now();
        Conversation conversation = new Conversation(
                UUID.randomUUID(),
                customerId,
                channel,
                ConversationStatus.OPEN,
                now,
                now
        );
        conversationRepository.save(conversation);
        return conversation;
    }

    @Transactional
    public SendMessageResult receiveMessage(UUID conversationId, String content, String traceId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("conversation not found: " + conversationId));
        Message message = new Message(
                UUID.randomUUID(),
                conversation.id(),
                SenderType.CUSTOMER,
                content,
                null,
                traceId,
                Instant.now()
        );
        messageRepository.save(message);
        messageEventPublisher.publish(new MessageReceivedEvent(conversation.id(), message.id(), traceId));
        return new SendMessageResult(message.id(), conversation.id(), traceId);
    }

    @Transactional(readOnly = true)
    public ConversationDetail getDetail(UUID conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("conversation not found: " + conversationId));
        Customer customer = customerRepository.findById(conversation.customerId())
                .orElseThrow(() -> new ResourceNotFoundException("customer not found: " + conversation.customerId()));
        return new ConversationDetail(
                conversation,
                customer,
                messageRepository.findByConversationId(conversationId),
                automationActionRepository.findByConversationId(conversationId)
        );
    }
}
