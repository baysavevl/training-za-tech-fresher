package com.zalo.training.conversation.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zalo.training.conversation.domain.Automation;
import com.zalo.training.conversation.domain.WorkflowStatus;
import com.zalo.training.conversation.domain.WorkflowVersion;
import com.zalo.training.conversation.persistence.AutomationRepository;
import com.zalo.training.conversation.persistence.WorkflowVersionRepository;
import com.zalo.training.conversation.workflow.WorkflowDefinition;
import com.zalo.training.conversation.workflow.WorkflowValidationResult;
import com.zalo.training.conversation.workflow.WorkflowValidator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class AutomationService {

    public static final String DEFAULT_ACCOUNT_ID = "training-account";

    private final AutomationRepository automationRepository;
    private final WorkflowVersionRepository workflowVersionRepository;
    private final WorkflowValidator workflowValidator;
    private final ObjectMapper objectMapper;

    public AutomationService(
            AutomationRepository automationRepository,
            WorkflowVersionRepository workflowVersionRepository,
            WorkflowValidator workflowValidator,
            ObjectMapper objectMapper
    ) {
        this.automationRepository = automationRepository;
        this.workflowVersionRepository = workflowVersionRepository;
        this.workflowValidator = workflowValidator;
        this.objectMapper = objectMapper;
    }

    /**
     * Creates an enabled automation without an active workflow.
     *
     * <p>The active workflow is assigned only through publish so draft edits never
     * change runtime behavior until validation has passed.</p>
     */
    @Transactional
    public Automation createAutomation(String name, String accountId) {
        Instant now = Instant.now();
        Automation automation = new Automation(UUID.randomUUID(), normalizeAccountId(accountId), name, true, null, now, now);
        automationRepository.save(automation);
        return automation;
    }

    @Transactional
    public Automation updateAutomation(UUID automationId, String name, Boolean enabled) {
        Automation current = automationRepository.findById(automationId)
                .orElseThrow(() -> new ResourceNotFoundException("automation not found: " + automationId));
        Automation updated = new Automation(
                current.id(),
                current.accountId(),
                name == null || name.isBlank() ? current.name() : name,
                enabled == null ? current.enabled() : enabled,
                current.activeWorkflowVersionId(),
                current.createdAt(),
                Instant.now()
        );
        automationRepository.update(updated);
        return updated;
    }

    @Transactional
    public WorkflowVersion createWorkflowVersion(UUID automationId, WorkflowDefinition definition) {
        automationRepository.findById(automationId)
                .orElseThrow(() -> new ResourceNotFoundException("automation not found: " + automationId));
        try {
            WorkflowVersion version = new WorkflowVersion(
                    UUID.randomUUID(),
                    automationId,
                    workflowVersionRepository.nextVersion(automationId),
                    WorkflowStatus.DRAFT,
                    objectMapper.writeValueAsString(definition),
                    Instant.now(),
                    null
            );
            workflowVersionRepository.save(version);
            return version;
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("workflow definition is not serializable", e);
        }
    }

    @Transactional
    public WorkflowVersion publishWorkflowVersion(UUID automationId, UUID workflowVersionId) {
        Automation automation = automationRepository.findById(automationId)
                .orElseThrow(() -> new ResourceNotFoundException("automation not found: " + automationId));
        WorkflowVersion version = workflowVersionRepository.findById(workflowVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("workflow version not found: " + workflowVersionId));
        if (!version.automationId().equals(automationId)) {
            throw new IllegalArgumentException("workflow version does not belong to automation");
        }
        WorkflowValidationResult validation = workflowValidator.validate(readDefinition(version));
        if (!validation.valid()) {
            throw new IllegalArgumentException("workflow invalid: " + String.join(", ", validation.errors()));
        }
        WorkflowVersion published = new WorkflowVersion(
                version.id(),
                version.automationId(),
                version.version(),
                WorkflowStatus.PUBLISHED,
                version.definitionJson(),
                version.createdAt(),
                Instant.now()
        );
        workflowVersionRepository.publish(published);
        automationRepository.update(new Automation(
                automation.id(),
                automation.accountId(),
                automation.name(),
                automation.enabled(),
                published.id(),
                automation.createdAt(),
                Instant.now()
        ));
        return published;
    }

    public WorkflowDefinition readDefinition(WorkflowVersion version) {
        try {
            return objectMapper.readValue(version.definitionJson(), WorkflowDefinition.class);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("workflow definition is invalid JSON", e);
        }
    }

    public Automation getAutomation(UUID automationId) {
        return automationRepository.findById(automationId)
                .orElseThrow(() -> new ResourceNotFoundException("automation not found: " + automationId));
    }

    public Automation getActiveAutomationByAccountId(String accountId) {
        String normalizedAccountId = normalizeAccountId(accountId);
        return automationRepository.findActiveByAccountId(normalizedAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("active automation not found for account: " + normalizedAccountId));
    }

    public WorkflowVersion getWorkflowVersion(UUID workflowVersionId) {
        return workflowVersionRepository.findById(workflowVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("workflow version not found: " + workflowVersionId));
    }

    private String normalizeAccountId(String accountId) {
        return accountId == null || accountId.isBlank() ? DEFAULT_ACCOUNT_ID : accountId.trim();
    }
}
