package com.zalo.training.conversation.workflow;

import com.zalo.training.conversation.adapter.ActionAdapter;
import com.zalo.training.conversation.adapter.ActionResult;
import com.zalo.training.conversation.domain.SessionStatus;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Component
public class WorkflowExecutionEngine {

    /**
     * Executes one inbound message against the current workflow/session state.
     *
     * <p>The engine is deliberately stateless: callers provide the workflow,
     * current node id, user input, and action adapter. Persistence, locking,
     * idempotency, and tracing stay outside this class so core state-machine
     * behavior can be unit-tested without Spring or a database.</p>
     */
    public WorkflowExecutionOutcome execute(
            WorkflowDefinition workflow,
            String currentNodeId,
            String input,
            ActionAdapter actionAdapter
    ) {
        WorkflowDefinition.Node current = workflow.node(currentNodeId)
                .orElseGet(() -> startNode(workflow));
        ArrayList<String> nodePath = new ArrayList<>();
        nodePath.add(current.id());

        if (current.type() == WorkflowNodeType.START) {
            current = nextNode(workflow, current, input);
            addPathNode(nodePath, current);
            return enterNode(workflow, current, input, actionAdapter, nodePath);
        }

        if (current.type() == WorkflowNodeType.MESSAGE
                || current.type() == WorkflowNodeType.QUESTION
                || current.type() == WorkflowNodeType.CONDITION) {
            current = nextNode(workflow, current, input);
            addPathNode(nodePath, current);
        }

        return enterNode(workflow, current, input, actionAdapter, nodePath);
    }

    private WorkflowExecutionOutcome enterNode(
            WorkflowDefinition workflow,
            WorkflowDefinition.Node node,
            String input,
            ActionAdapter actionAdapter,
            ArrayList<String> nodePath
    ) {
        if (node.type() == WorkflowNodeType.ACTION) {
            String actionName = node.configString("action", "");
            ActionResult result = actionAdapter.execute(actionName, input);
            WorkflowDefinition.Node next = workflow.outgoing(node.id()).stream()
                    .filter(edge -> edge.matchType() == WorkflowMatchType.ALWAYS)
                    .findFirst()
                    .flatMap(edge -> workflow.node(edge.to()))
                    .orElse(node);
            addPathNode(nodePath, next);
            SessionStatus status = next.type() == WorkflowNodeType.END ? SessionStatus.COMPLETED : SessionStatus.ACTIVE;
            return new WorkflowExecutionOutcome(next.id(), result.response(), status, "ACTION_EXECUTED", result.responseJson(), List.copyOf(nodePath), actionName);
        }
        if (node.type() == WorkflowNodeType.HANDOFF) {
            String response = node.configString("message", "Minh se chuyen hoi thoai nay cho nhan vien ho tro.");
            return new WorkflowExecutionOutcome(node.id(), response, SessionStatus.WAITING, "HANDOFF", "{\"status\":\"waiting_agent\"}", List.copyOf(nodePath), null);
        }
        if (node.type() == WorkflowNodeType.END) {
            String response = node.configString("message", "Da ket thuc hoi thoai.");
            return new WorkflowExecutionOutcome(node.id(), response, SessionStatus.COMPLETED, "END", "{\"status\":\"completed\"}", List.copyOf(nodePath), null);
        }
        String response = node.configString("message", "");
        return new WorkflowExecutionOutcome(node.id(), response, SessionStatus.ACTIVE, node.type().name(), detailJson(node), List.copyOf(nodePath), null);
    }

    private void addPathNode(ArrayList<String> nodePath, WorkflowDefinition.Node node) {
        if (nodePath.isEmpty() || !nodePath.getLast().equals(node.id())) {
            nodePath.add(node.id());
        }
    }

    private WorkflowDefinition.Node startNode(WorkflowDefinition workflow) {
        return workflow.nodes().stream()
                .filter(node -> node.type() == WorkflowNodeType.START)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("workflow does not contain START node"));
    }

    private WorkflowDefinition.Node nextNode(WorkflowDefinition workflow, WorkflowDefinition.Node node, String input) {
        return workflow.outgoing(node.id()).stream()
                .sorted(Comparator.comparingInt(edge -> edge.matchType() == WorkflowMatchType.FALLBACK ? 1 : 0))
                .filter(edge -> matches(edge, input))
                .findFirst()
                .flatMap(edge -> workflow.node(edge.to()))
                .orElse(node);
    }

    private boolean matches(WorkflowDefinition.Edge edge, String input) {
        String normalizedInput = input == null ? "" : input.toLowerCase();
        String matchValue = edge.matchValue() == null ? "" : edge.matchValue().toLowerCase();
        return switch (edge.matchType()) {
            case ALWAYS, FALLBACK -> true;
            case KEYWORD -> !matchValue.isBlank() && normalizedInput.contains(matchValue);
            case CONDITION -> matchesCondition(matchValue, normalizedInput);
            case OPTION -> normalizedInput.equals(matchValue);
        };
    }

    private boolean matchesCondition(String matchValue, String normalizedInput) {
        if (matchValue.isBlank()) {
            return false;
        }
        try {
            return Pattern.compile(matchValue, Pattern.CASE_INSENSITIVE).matcher(normalizedInput).find();
        } catch (PatternSyntaxException ignored) {
            return normalizedInput.contains(matchValue);
        }
    }

    private String detailJson(WorkflowDefinition.Node node) {
        return "{\"node\":\"%s\",\"category\":\"%s\"}".formatted(
                escape(node.id()),
                escape(node.configString("category", node.type().name()))
        );
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
