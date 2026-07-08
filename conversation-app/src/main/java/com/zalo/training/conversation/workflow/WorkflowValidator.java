package com.zalo.training.conversation.workflow;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

@Component
public class WorkflowValidator {

    /**
     * Validates structural rules before a workflow version can be published.
     *
     * <p>This covers the minimum rules needed for a safe demo: one START node,
     * unique node ids, existing edge endpoints, and required node config. More
     * advanced checks such as unreachable nodes and cycle policy are documented as
     * extension exercises.</p>
     */
    public WorkflowValidationResult validate(WorkflowDefinition workflow) {
        ArrayList<String> errors = new ArrayList<>();

        if (workflow == null || workflow.nodes() == null || workflow.nodes().isEmpty()) {
            return new WorkflowValidationResult(false, java.util.List.of("workflow must contain exactly one START node"));
        }

        long startCount = workflow.nodes().stream()
                .filter(node -> node.type() == WorkflowNodeType.START)
                .count();
        if (startCount != 1) {
                errors.add("workflow must contain exactly one START node");
        }

        Set<String> nodeIds = new HashSet<>();
        Set<String> outgoingNodeIds = new HashSet<>();
        for (WorkflowDefinition.Node node : workflow.nodes()) {
            if (node.id() == null || node.id().isBlank()) {
                errors.add("node id must not be blank");
            } else if (!nodeIds.add(node.id())) {
                errors.add("duplicate node id " + node.id());
            }
            validateNodeConfig(node, errors);
        }

        if (workflow.edges() == null) {
            errors.add("workflow edges must not be null");
        } else {
            for (WorkflowDefinition.Edge edge : workflow.edges()) {
                if (!nodeIds.contains(edge.from())) {
                    errors.add("edge %s -> %s points from a missing node".formatted(edge.from(), edge.to()));
                } else {
                    outgoingNodeIds.add(edge.from());
                }
                if (!nodeIds.contains(edge.to())) {
                    errors.add("edge %s -> %s points to a missing node".formatted(edge.from(), edge.to()));
                }
            }
            for (WorkflowDefinition.Node node : workflow.nodes()) {
                if (node.type() != WorkflowNodeType.END && !outgoingNodeIds.contains(node.id())) {
                    errors.add("%s node %s must have at least one outgoing edge".formatted(node.type(), node.id()));
                }
            }
        }

        return new WorkflowValidationResult(errors.isEmpty(), errors);
    }

    private void validateNodeConfig(WorkflowDefinition.Node node, ArrayList<String> errors) {
        if (node.type() == WorkflowNodeType.QUESTION && node.configString("message", "").isBlank()) {
            errors.add("QUESTION node %s must define config.message".formatted(node.id()));
        }
        if (node.type() == WorkflowNodeType.ACTION && node.configString("action", "").isBlank()) {
            errors.add("ACTION node %s must define config.action".formatted(node.id()));
        }
    }
}
