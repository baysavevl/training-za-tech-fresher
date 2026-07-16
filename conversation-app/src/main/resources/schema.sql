DROP TABLE IF EXISTS automation_actions CASCADE;
DROP TABLE IF EXISTS automation_rules CASCADE;
DROP TABLE IF EXISTS action_executions CASCADE;
DROP TABLE IF EXISTS execution_traces CASCADE;
DROP TABLE IF EXISTS message_idempotency CASCADE;
DROP TABLE IF EXISTS conversation_sessions CASCADE;
DROP TABLE IF EXISTS workflow_versions CASCADE;
DROP TABLE IF EXISTS automations CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

CREATE TABLE customers (
    id UUID PRIMARY KEY,
    external_id VARCHAR(128) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id),
    channel VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    sender_type VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    intent VARCHAR(64),
    trace_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE automations (
    id UUID PRIMARY KEY,
    account_id VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    active_workflow_version_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE workflow_versions (
    id UUID PRIMARY KEY,
    automation_id UUID NOT NULL REFERENCES automations(id),
    version INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    definition_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (automation_id, version)
);

ALTER TABLE automations
    ADD CONSTRAINT fk_automations_active_workflow
    FOREIGN KEY (active_workflow_version_id) REFERENCES workflow_versions(id);

CREATE TABLE conversation_sessions (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL UNIQUE REFERENCES conversations(id),
    automation_id UUID NOT NULL REFERENCES automations(id),
    workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id),
    current_node_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE message_idempotency (
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    external_message_id VARCHAR(128) NOT NULL,
    request_message_id UUID NOT NULL REFERENCES messages(id),
    response_message_id UUID REFERENCES messages(id),
    execution_trace_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (conversation_id, external_message_id)
);

CREATE TABLE execution_traces (
    id UUID PRIMARY KEY,
    request_id VARCHAR(128) NOT NULL,
    external_message_id VARCHAR(128) NOT NULL,
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id),
    node_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    detail_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

ALTER TABLE message_idempotency
    ADD CONSTRAINT fk_idempotency_execution_trace
    FOREIGN KEY (execution_trace_id) REFERENCES execution_traces(id);

CREATE TABLE action_executions (
    id UUID PRIMARY KEY,
    trace_id UUID REFERENCES execution_traces(id),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id),
    node_id VARCHAR(128) NOT NULL,
    action_name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    request_json TEXT NOT NULL,
    response_json TEXT,
    attempt_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE automation_rules (
    id UUID PRIMARY KEY,
    intent VARCHAR(64) NOT NULL,
    priority INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    reply_template TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE automation_actions (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    source_message_id UUID NOT NULL REFERENCES messages(id),
    rule_id UUID REFERENCES automation_rules(id),
    action_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    result_message_id UUID REFERENCES messages(id),
    attempt_count INTEGER NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_workflow_versions_automation_id ON workflow_versions(automation_id);
CREATE INDEX idx_sessions_conversation_id ON conversation_sessions(conversation_id);
CREATE INDEX idx_traces_conversation_id ON execution_traces(conversation_id);
CREATE INDEX idx_actions_conversation_id ON automation_actions(conversation_id);
