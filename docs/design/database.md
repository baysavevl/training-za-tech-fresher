# Database Design

Executable schema lives in `conversation-app/src/main/resources/schema.sql`.

## 1. Core Tables

### `customers`

Represents a chat user.

- `id`: internal UUID.
- `external_id`: channel user id, unique.
- `display_name`: demo display name.
- `created_at`: audit timestamp.

### `conversations`

Represents one chat thread.

- `customer_id`: owner.
- `channel`: `ZALO`, `WEB`, etc.
- `status`: `OPEN`, `CLOSED`.

### `messages`

Stores both customer messages and bot responses.

- `conversation_id`: thread.
- `sender_type`: `CUSTOMER` or `BOT`.
- `content`: raw text.
- `intent`: optional old rule-engine field.
- `trace_id`: request/correlation id.

Training point: message history is immutable append-only data in normal chat systems. Do not update user message content during workflow execution.

## 2. Automation Configuration

### `automations`

Top-level automation config.

- `enabled`: runtime switch.
- `active_workflow_version_id`: exact workflow version used for new execution.

### `workflow_versions`

Stores workflow JSON snapshots.

- `automation_id`: parent automation.
- `version`: increasing integer per automation.
- `status`: `DRAFT` or `PUBLISHED`.
- `definition_json`: full workflow graph.
- `published_at`: null while draft.

Training point: runtime must not read mutable drafts. Publish creates a stable version boundary.

## 3. Runtime State

### `conversation_sessions`

Stores workflow state per conversation.

- `conversation_id`: unique, one active session record per conversation in this sample.
- `automation_id`: automation being executed.
- `workflow_version_id`: version used by this session.
- `current_node_id`: current state-machine node.
- `status`: session status.
- `version`: incremented when state changes.

Training point: session is mutable state and therefore the place where race conditions usually happen.

## 4. Idempotency

### `message_idempotency`

Prevents duplicate channel messages from being processed twice.

Primary key:

```text
(conversation_id, external_message_id)
```

Columns:

- `request_message_id`: original customer message row.
- `response_message_id`: original bot response row.
- `created_at`: first processing time.

Training point: if duplicate request arrives, return the same response instead of moving the workflow again.

## 5. Debug and Observability

### `execution_traces`

One row per processed inbound message.

- `request_id`: correlation id.
- `external_message_id`: channel message id.
- `conversation_id`: chat thread.
- `session_id`: session state row.
- `node_id`: resulting workflow node.
- `event_type`: `ACTION_EXECUTED`, `END`, `HANDOFF`, etc.
- `detail_json`: compact debug detail.

### `action_executions`

Records external action calls.

- `trace_id`: trace row.
- `action_name`: action or adapter name.
- `status`: `PENDING`, `DONE`, `FAILED`.
- `request_json`: action input.
- `response_json`: action result.
- `attempt_count`: retry counter.

Training point: trace explains “what happened”; action execution explains “what dependency was called”.

## 6. Legacy Rule Engine Tables

`automation_rules` and `automation_actions` are kept as an introductory step before moving to workflow automation:

- Rule engine: simple intent to reply/action mapping.
- Workflow engine: graph/state-machine based automation.

Mentoring order: teach simple rule matching first, then show why multi-step conversation requires session and workflow.

## 7. Indexes and Constraints

Important constraints:

- `customers.external_id` unique.
- `workflow_versions(automation_id, version)` unique.
- `conversation_sessions.conversation_id` unique.
- `message_idempotency(conversation_id, external_message_id)` primary key.
- `automation_actions.idempotency_key` unique.

Important indexes:

- `idx_messages_conversation_id`
- `idx_workflow_versions_automation_id`
- `idx_sessions_conversation_id`
- `idx_traces_conversation_id`

Rule for fresher: design indexes based on query paths, not based on every column that looks important.
