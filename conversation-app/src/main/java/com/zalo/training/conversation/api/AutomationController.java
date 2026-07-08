package com.zalo.training.conversation.api;

import com.zalo.training.conversation.application.AutomationService;
import com.zalo.training.conversation.domain.Automation;
import com.zalo.training.conversation.domain.WorkflowStatus;
import com.zalo.training.conversation.domain.WorkflowVersion;
import com.zalo.training.conversation.workflow.WorkflowDefinition;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/automations")
public class AutomationController {

    private final AutomationService automationService;

    public AutomationController(AutomationService automationService) {
        this.automationService = automationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AutomationResponse create(@Valid @RequestBody CreateAutomationRequest request) {
        return AutomationResponse.from(automationService.createAutomation(request.name()));
    }

    @PatchMapping("/{automationId}")
    public AutomationResponse update(@PathVariable("automationId") UUID automationId, @RequestBody UpdateAutomationRequest request) {
        return AutomationResponse.from(automationService.updateAutomation(automationId, request.name(), request.enabled()));
    }

    @PostMapping("/{automationId}/workflows")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkflowVersionResponse createWorkflow(
            @PathVariable("automationId") UUID automationId,
            @Valid @RequestBody CreateWorkflowRequest request
    ) {
        return WorkflowVersionResponse.from(automationService.createWorkflowVersion(automationId, request.definition()));
    }

    @PostMapping("/{automationId}/workflows/{workflowVersionId}/publish")
    public WorkflowVersionResponse publish(
            @PathVariable("automationId") UUID automationId,
            @PathVariable("workflowVersionId") UUID workflowVersionId
    ) {
        return WorkflowVersionResponse.from(automationService.publishWorkflowVersion(automationId, workflowVersionId));
    }

    public record CreateAutomationRequest(@NotBlank String name) {
    }

    public record UpdateAutomationRequest(String name, Boolean enabled) {
    }

    public record CreateWorkflowRequest(@NotNull WorkflowDefinition definition) {
    }

    public record AutomationResponse(
            UUID id,
            String name,
            boolean enabled,
            UUID activeWorkflowVersionId,
            Instant createdAt,
            Instant updatedAt
    ) {
        static AutomationResponse from(Automation automation) {
            return new AutomationResponse(
                    automation.id(),
                    automation.name(),
                    automation.enabled(),
                    automation.activeWorkflowVersionId(),
                    automation.createdAt(),
                    automation.updatedAt()
            );
        }
    }

    public record WorkflowVersionResponse(
            UUID id,
            UUID automationId,
            int version,
            WorkflowStatus status,
            Instant createdAt,
            Instant publishedAt
    ) {
        static WorkflowVersionResponse from(WorkflowVersion version) {
            return new WorkflowVersionResponse(
                    version.id(),
                    version.automationId(),
                    version.version(),
                    version.status(),
                    version.createdAt(),
                    version.publishedAt()
            );
        }
    }
}
