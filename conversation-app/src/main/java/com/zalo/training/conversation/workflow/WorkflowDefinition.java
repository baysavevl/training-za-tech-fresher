package com.zalo.training.conversation.workflow;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * JSON-serializable workflow model used by automation configuration APIs.
 *
 * <p>A workflow is a directed graph of nodes and edges. Nodes describe what the
 * engine should do, while edges describe when the engine can move to the next
 * node. Keeping this record small makes the JSON contract easy to inspect in
 * requests, database rows, tests, and demo scripts.</p>
 */
public record WorkflowDefinition(
        List<Node> nodes,
        List<Edge> edges
) {
    public Optional<Node> node(String id) {
        return nodes.stream().filter(node -> node.id().equals(id)).findFirst();
    }

    public List<Edge> outgoing(String nodeId) {
        if (edges == null) {
            return List.of();
        }
        return edges.stream().filter(edge -> edge.from().equals(nodeId)).toList();
    }

    /**
     * One workflow state. The node type defines the behavior and config contains
     * node-specific settings such as a message template or action name.
     */
    public record Node(String id, WorkflowNodeType type, Map<String, Object> config) {
        public String configString(String key, String defaultValue) {
            Object value = config == null ? null : config.get(key);
            return value == null ? defaultValue : value.toString();
        }
    }

    /**
     * Directed transition rule. The match type decides how user input is compared
     * with matchValue before the engine follows this edge.
     */
    public record Edge(String from, String to, WorkflowMatchType matchType, String matchValue) {
    }
}
