package com.zalo.training.conversation.mockchat;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zalo.training.conversation.adapter.ActionAdapter;
import com.zalo.training.conversation.application.AutomationService;
import com.zalo.training.conversation.application.ResourceNotFoundException;
import com.zalo.training.conversation.domain.ActionExecution;
import com.zalo.training.conversation.domain.ActionStatus;
import com.zalo.training.conversation.domain.Automation;
import com.zalo.training.conversation.domain.Channel;
import com.zalo.training.conversation.domain.ChatOutput;
import com.zalo.training.conversation.domain.Conversation;
import com.zalo.training.conversation.domain.ConversationSession;
import com.zalo.training.conversation.domain.ConversationStatus;
import com.zalo.training.conversation.domain.Customer;
import com.zalo.training.conversation.domain.ExecutionTrace;
import com.zalo.training.conversation.domain.Message;
import com.zalo.training.conversation.domain.MessageIntent;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class MockChatService {

    private static final Logger log = LoggerFactory.getLogger(MockChatService.class);
    private static final Pattern ORDER_ID_PATTERN = Pattern.compile("\\b[A-Z][0-9]{3,}\\b", Pattern.CASE_INSENSITIVE);
    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_DUPLICATE = "DUPLICATE";

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
    private final ObjectMapper objectMapper;

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
            ConversationLockManager lockManager,
            ObjectMapper objectMapper
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
        this.objectMapper = objectMapper;
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
        var duplicateRecord = idempotencyRepository.findByMessage(conversation.id(), inbound.messageId());
        if (duplicateRecord.isPresent()) {
            Message responseMessage = messageRepository.findById(duplicateRecord.get().responseMessageId())
                    .orElseThrow(() -> new ResourceNotFoundException("duplicate response message not found"));
            ConversationSession currentSession = sessionRepository.findByConversationId(conversation.id()).orElse(null);
            return new MockChatResult(
                    conversation.id(),
                    currentSession == null ? null : currentSession.id(),
                    duplicateRecord.get().executionTraceId(),
                    responseMessage.content(),
                    List.of(ChatOutput.text(responseMessage.content())),
                    currentSession == null ? null : currentSession.currentNodeId(),
                    responseMessage.id(),
                    true,
                    STATUS_DUPLICATE,
                    null
            );
        }

        Automation automation = resolveAutomation(inbound);
        if (!automation.enabled() || automation.activeWorkflowVersionId() == null) {
            throw new IllegalArgumentException("automation is not enabled or has no published workflow");
        }
        WorkflowVersion workflowVersion = automationService.getWorkflowVersion(automation.activeWorkflowVersionId());
        WorkflowDefinition workflow = automationService.readDefinition(workflowVersion);
        String actionInput = actionInput(conversation.id(), inbound.text());

        Instant now = Instant.now();
        Message userMessage = new Message(
                UUID.randomUUID(),
                conversation.id(),
                SenderType.CUSTOMER,
                inbound.text(),
                categorizeIntent(inbound.text()),
                inbound.requestId(),
                now
        );
        messageRepository.save(userMessage);

        ConversationSession session = sessionRepository.findByConversationId(conversation.id())
                .orElseGet(() -> createSession(conversation.id(), automation.id(), workflowVersion.id(), now));

        WorkflowExecutionOutcome outcome = executionEngine.execute(
                workflow,
                session.currentNodeId(),
                inbound.text(),
                (actionName, ignoredInput) -> actionAdapter.execute(actionName, actionInput)
        );
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
        if (!sessionRepository.updateIfVersionMatches(updatedSession, session.version())) {
            throw new IllegalStateException("conversation session version mismatch: " + session.id());
        }

        ChatOutput textOutput = ChatOutput.text(outcome.response());
        Message botMessage = new Message(
                UUID.randomUUID(),
                conversation.id(),
                SenderType.BOT,
                textOutput.text(),
                null,
                inbound.requestId(),
                Instant.now()
        );
        messageRepository.save(botMessage);

        UUID executionId = UUID.randomUUID();
        String traceDetailJson = traceDetailJson(workflowVersion, session, outcome, List.of(textOutput));
        ExecutionTrace trace = new ExecutionTrace(
                executionId,
                inbound.requestId(),
                inbound.messageId(),
                conversation.id(),
                updatedSession.id(),
                outcome.nodeId(),
                outcome.eventType(),
                traceDetailJson,
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
                    outcome.actionName(),
                    ActionStatus.DONE,
                    "{\"input\":\"%s\"}".formatted(escapeJson(inbound.text())),
                    outcome.detailJson(),
                    1,
                    Instant.now(),
                    Instant.now()
                ));
        }
        idempotencyRepository.save(conversation.id(), inbound.messageId(), userMessage.id(), botMessage.id(), executionId, Instant.now());

        log.info(
                "event=mock_chat_processed request_id={} message_id={} conversation_id={} session_id={} execution_id={} node_id={} status={}",
                inbound.requestId(),
                inbound.messageId(),
                conversation.id(),
                updatedSession.id(),
                executionId,
                outcome.nodeId(),
                updatedSession.status()
        );

        return new MockChatResult(
                conversation.id(),
                updatedSession.id(),
                executionId,
                textOutput.text(),
                List.of(textOutput),
                outcome.nodeId(),
                botMessage.id(),
                false,
                STATUS_SUCCESS,
                null
        );
    }

    private Automation resolveAutomation(InboundChatMessage inbound) {
        if (inbound.automationId() == null) {
            return automationService.getActiveAutomationByAccountId(inbound.accountId());
        }
        Automation automation = automationService.getAutomation(inbound.automationId());
        if (inbound.accountId() != null
                && !inbound.accountId().isBlank()
                && !automation.accountId().equals(inbound.accountId().trim())) {
            throw new IllegalArgumentException("automation does not belong to account");
        }
        return automation;
    }

    private String traceDetailJson(
            WorkflowVersion workflowVersion,
            ConversationSession previousSession,
            WorkflowExecutionOutcome outcome,
            List<ChatOutput> outputs
    ) {
        LinkedHashMap<String, Object> detail = new LinkedHashMap<>();
        detail.put("workflowVersionId", workflowVersion.id());
        detail.put("previousNodeId", previousSession.currentNodeId());
        detail.put("currentNodeId", outcome.nodeId());
        detail.put("nodePath", outcome.nodePath());
        detail.put("eventType", outcome.eventType());
        detail.put("outputs", outputs);
        if (outcome.actionName() != null && !outcome.actionName().isBlank()) {
            detail.put("actionName", outcome.actionName());
        }
        detail.put("outcome", readOutcomeDetail(outcome.detailJson()));
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("execution trace detail is not serializable", e);
        }
    }

    private Object readOutcomeDetail(String detailJson) {
        if (detailJson == null || detailJson.isBlank()) {
            return Map.of();
        }
        try {
            JsonNode jsonNode = objectMapper.readTree(detailJson);
            return jsonNode;
        } catch (JsonProcessingException ignored) {
            return detailJson;
        }
    }

    private String actionInput(UUID conversationId, String currentText) {
        List<Message> previousMessages = messageRepository.findByConversationId(conversationId);
        if (previousMessages.isEmpty()) {
            return currentText;
        }
        String transcript = previousMessages.stream()
                .map(message -> "%s: %s".formatted(message.senderType().name(), message.content()))
                .collect(Collectors.joining("\n"));
        return "%s\n\nconversation_context:\n%s".formatted(currentText, transcript);
    }

    private MessageIntent categorizeIntent(String input) {
        String normalized = input == null ? "" : input.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return MessageIntent.UNKNOWN;
        }
        if (normalized.equals("yes") || normalized.equals("y") || normalized.equals("co")) {
            return MessageIntent.AFFIRMATION;
        }
        if (normalized.equals("no") || normalized.equals("n") || normalized.equals("khong")) {
            return MessageIntent.NEGATION;
        }
        if (normalized.equals("hello") || normalized.equals("hi") || normalized.contains("xin chao")) {
            return MessageIntent.GREETING;
        }
        if (normalized.contains("agent") || normalized.contains("nhan vien")) {
            return MessageIntent.HUMAN_AGENT_REQUEST;
        }
        if (normalized.contains("ticket")) {
            return MessageIntent.TICKET_REQUEST;
        }
        if (normalized.contains("update") || normalized.contains("cap nhat")) {
            return MessageIntent.STATUS_UPDATE_REQUEST;
        }
        if (normalized.contains("delivery")
                || normalized.contains("delay")
                || normalized.contains("shipping")
                || normalized.contains("address")
                || normalized.contains("refund")) {
            return MessageIntent.SUPPORT_CATEGORY_PROVIDED;
        }
        if (ORDER_ID_PATTERN.matcher(normalized).find()) {
            return MessageIntent.ORDER_ID_PROVIDED;
        }
        if (normalized.contains("order") || normalized.contains("don hang") || normalized.contains("status")) {
            return MessageIntent.ORDER_STATUS_REQUEST;
        }
        return MessageIntent.UNKNOWN;
    }

    private String escapeJson(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
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

    @Transactional(readOnly = true)
    public ExecutionTrace executionTrace(UUID executionId) {
        return traceRepository.findById(executionId)
                .orElseThrow(() -> new ResourceNotFoundException("execution trace not found: " + executionId));
    }

    @Transactional(readOnly = true)
    public List<ExecutionTrace> sessionTrace(UUID sessionId) {
        return traceRepository.findBySessionId(sessionId);
    }

    public record MockChatResult(
            UUID conversationId,
            UUID sessionId,
            UUID executionId,
            String response,
            List<ChatOutput> outputs,
            String currentNodeId,
            UUID responseMessageId,
            boolean duplicate,
            String status,
            String errorMessage
    ) {
    }
}
