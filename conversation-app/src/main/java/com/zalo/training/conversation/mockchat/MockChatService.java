package com.zalo.training.conversation.mockchat;

import com.zalo.training.conversation.adapter.ActionAdapter;
import com.zalo.training.conversation.application.AutomationService;
import com.zalo.training.conversation.application.ResourceNotFoundException;
import com.zalo.training.conversation.domain.ActionExecution;
import com.zalo.training.conversation.domain.ActionStatus;
import com.zalo.training.conversation.domain.Automation;
import com.zalo.training.conversation.domain.Channel;
import com.zalo.training.conversation.domain.Conversation;
import com.zalo.training.conversation.domain.ConversationSession;
import com.zalo.training.conversation.domain.ConversationStatus;
import com.zalo.training.conversation.domain.Customer;
import com.zalo.training.conversation.domain.ExecutionTrace;
import com.zalo.training.conversation.domain.Message;
import com.zalo.training.conversation.domain.SenderType;
import com.zalo.training.conversation.domain.SessionStatus;
import com.zalo.training.conversation.domain.WorkflowVersion;
import com.zalo.training.conversation.persistence.ActionExecutionRepository;
import com.zalo.training.conversation.persistence.ConversationRepository;
import com.zalo.training.conversation.persistence.ConversationSessionRepository;
import com.zalo.training.conversation.persistence.CustomerRepository;
import com.zalo.training.conversation.persistence.ExecutionTraceRepository;
import com.zalo.training.conversation.persistence.MessageIdempotencyRepository;
import com.zalo.training.conversation.persistence.MessageRepository;
import com.zalo.training.conversation.workflow.WorkflowDefinition;
import com.zalo.training.conversation.workflow.WorkflowExecutionEngine;
import com.zalo.training.conversation.workflow.WorkflowExecutionOutcome;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class MockChatService {

    private static final Logger log = LoggerFactory.getLogger(MockChatService.class);

    private final CustomerRepository customerRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final MessageIdempotencyRepository idempotencyRepository;
    private final ConversationSessionRepository sessionRepository;
    private final ExecutionTraceRepository traceRepository;
    private final ActionExecutionRepository actionExecutionRepository;
    private final AutomationService automationService;
    private final WorkflowExecutionEngine executionEngine;
    private final ActionAdapter actionAdapter;
    private final ConversationLockManager lockManager;

    public MockChatService(
            CustomerRepository customerRepository,
            ConversationRepository conversationRepository,
            MessageRepository messageRepository,
            MessageIdempotencyRepository idempotencyRepository,
            ConversationSessionRepository sessionRepository,
            ExecutionTraceRepository traceRepository,
            ActionExecutionRepository actionExecutionRepository,
            AutomationService automationService,
            WorkflowExecutionEngine executionEngine,
            ActionAdapter actionAdapter,
            ConversationLockManager lockManager
    ) {
        this.customerRepository = customerRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.idempotencyRepository = idempotencyRepository;
        this.sessionRepository = sessionRepository;
        this.traceRepository = traceRepository;
        this.actionExecutionRepository = actionExecutionRepository;
        this.automationService = automationService;
        this.executionEngine = executionEngine;
        this.actionAdapter = actionAdapter;
        this.lockManager = lockManager;
    }

    /**
     * Handles one incoming Mock Chat message end to end.
     *
     * <p>This method is the training project's main orchestration path: normalize
     * channel input, find/create conversation state, guard concurrent updates,
     * enforce idempotency, execute the workflow, persist messages, and write debug
     * trace rows. Keeping these steps in one readable flow makes the tradeoffs easy
     * to discuss during mentoring.</p>
     */
    @Transactional
    public MockChatResult handleIncoming(InboundChatMessage inbound) {
        Customer customer = findOrCreateCustomer(inbound.userId());
        Conversation conversation = findOrCreateConversation(inbound.conversationId(), customer.id());
        return lockManager.withConversationLock(conversation.id(), () -> processLocked(inbound, conversation));
    }

    private MockChatResult processLocked(InboundChatMessage inbound, Conversation conversation) {
        var duplicateResponseId = idempotencyRepository.findResponseMessageId(conversation.id(), inbound.messageId());
        if (duplicateResponseId.isPresent()) {
            Message responseMessage = messageRepository.findById(duplicateResponseId.get())
                    .orElseThrow(() -> new ResourceNotFoundException("duplicate response message not found"));
            return new MockChatResult(conversation.id(), null, responseMessage.content(), null, responseMessage.id(), true);
        }

        Automation automation = automationService.getAutomation(inbound.automationId());
        if (!automation.enabled() || automation.activeWorkflowVersionId() == null) {
            throw new IllegalArgumentException("automation is not enabled or has no published workflow");
        }
        WorkflowVersion workflowVersion = automationService.getWorkflowVersion(automation.activeWorkflowVersionId());
        WorkflowDefinition workflow = automationService.readDefinition(workflowVersion);

        Instant now = Instant.now();
        Message userMessage = new Message(
                UUID.randomUUID(),
                conversation.id(),
                SenderType.CUSTOMER,
                inbound.text(),
                null,
                inbound.requestId(),
                now
        );
        messageRepository.save(userMessage);

        ConversationSession session = sessionRepository.findByConversationId(conversation.id())
                .orElseGet(() -> createSession(conversation.id(), automation.id(), workflowVersion.id(), now));

        WorkflowExecutionOutcome outcome = executionEngine.execute(workflow, session.currentNodeId(), inbound.text(), actionAdapter);
        ConversationSession updatedSession = new ConversationSession(
                session.id(),
                session.conversationId(),
                session.automationId(),
                session.workflowVersionId(),
                outcome.nodeId(),
                outcome.sessionStatus(),
                session.version() + 1,
                session.createdAt(),
                Instant.now()
        );
        sessionRepository.update(updatedSession);

        Message botMessage = new Message(
                UUID.randomUUID(),
                conversation.id(),
                SenderType.BOT,
                outcome.response(),
                null,
                inbound.requestId(),
                Instant.now()
        );
        messageRepository.save(botMessage);

        ExecutionTrace trace = new ExecutionTrace(
                UUID.randomUUID(),
                inbound.requestId(),
                inbound.messageId(),
                conversation.id(),
                updatedSession.id(),
                outcome.nodeId(),
                outcome.eventType(),
                outcome.detailJson(),
                Instant.now()
        );
        traceRepository.save(trace);
        if ("ACTION_EXECUTED".equals(outcome.eventType())) {
            actionExecutionRepository.save(new ActionExecution(
                    UUID.randomUUID(),
                    trace.id(),
                    conversation.id(),
                    updatedSession.id(),
                    outcome.nodeId(),
                    "MOCK_ACTION",
                    ActionStatus.DONE,
                    "{\"input\":\"%s\"}".formatted(inbound.text()),
                    outcome.detailJson(),
                    1,
                    Instant.now(),
                    Instant.now()
            ));
        }
        idempotencyRepository.save(conversation.id(), inbound.messageId(), userMessage.id(), botMessage.id(), Instant.now());

        log.info(
                "event=mock_chat_processed request_id={} message_id={} conversation_id={} session_id={} node_id={} status={}",
                inbound.requestId(),
                inbound.messageId(),
                conversation.id(),
                updatedSession.id(),
                outcome.nodeId(),
                updatedSession.status()
        );

        return new MockChatResult(conversation.id(), updatedSession.id(), outcome.response(), outcome.nodeId(), botMessage.id(), false);
    }

    private Customer findOrCreateCustomer(String userId) {
        return customerRepository.findByExternalId(userId)
                .orElseGet(() -> {
                    Customer customer = new Customer(UUID.randomUUID(), userId, userId, Instant.now());
                    customerRepository.save(customer);
                    return customer;
                });
    }

    private Conversation findOrCreateConversation(UUID requestedConversationId, UUID customerId) {
        if (requestedConversationId != null) {
            return conversationRepository.findById(requestedConversationId)
                    .orElseThrow(() -> new ResourceNotFoundException("conversation not found: " + requestedConversationId));
        }
        Instant now = Instant.now();
        Conversation conversation = new Conversation(
                UUID.randomUUID(),
                customerId,
                Channel.ZALO,
                ConversationStatus.OPEN,
                now,
                now
        );
        conversationRepository.save(conversation);
        return conversation;
    }

    private ConversationSession createSession(UUID conversationId, UUID automationId, UUID workflowVersionId, Instant now) {
        ConversationSession session = new ConversationSession(
                UUID.randomUUID(),
                conversationId,
                automationId,
                workflowVersionId,
                "start",
                SessionStatus.ACTIVE,
                0,
                now,
                now
        );
        sessionRepository.save(session);
        return session;
    }

    @Transactional(readOnly = true)
    public List<Message> history(UUID conversationId) {
        return messageRepository.findByConversationId(conversationId);
    }

    @Transactional(readOnly = true)
    public ConversationSession session(UUID conversationId) {
        return sessionRepository.findByConversationId(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("session not found for conversation: " + conversationId));
    }

    @Transactional(readOnly = true)
    public List<ExecutionTrace> trace(UUID conversationId) {
        return traceRepository.findByConversationId(conversationId);
    }

    public record MockChatResult(
            UUID conversationId,
            UUID sessionId,
            String response,
            String currentNodeId,
            UUID responseMessageId,
            boolean duplicate
    ) {
    }
}
