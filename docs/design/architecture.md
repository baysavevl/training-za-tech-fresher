# Architecture: Conversation Automation System

## 1. Product Scope

Hệ thống mô phỏng một automation service cho kênh chat:

- Admin tạo automation và workflow JSON.
- Workflow được publish thành version active.
- User gửi message qua Mock Chat API.
- Channel Adapter normalize payload.
- Automation Engine xử lý workflow theo session hiện tại.
- Hệ thống lưu message history, session state, execution trace và action execution.

Project cố tình nhỏ nhưng chạm nhiều kiến thức backend quan trọng: API contract, state machine, database design, transaction, locking, idempotency, adapter boundary, logging, testing và RPC concept.

## 2. Components

```text
Mock Chat Client
    |
    | REST /api/mock-chat/messages
    v
MockChatController
    |
    v
MockChatChannelAdapter ----> InboundChatMessage
    |
    v
MockChatService
    |-- CustomerRepository
    |-- ConversationRepository
    |-- MessageRepository
    |-- MessageIdempotencyRepository
    |-- ConversationSessionRepository
    |-- ExecutionTraceRepository
    |-- ActionExecutionRepository
    |-- AutomationService
    |-- ConversationLockManager
    |
    v
WorkflowExecutionEngine ----> ActionAdapter ----> Mock external action
```

## 3. Module Boundaries

- `api`: REST controllers and response/request DTOs.
- `application`: use-case services and business orchestration.
- `adapter`: external boundary abstractions such as channel and action adapters.
- `workflow`: workflow JSON model, validation, and stateless execution engine.
- `mockchat`: demo channel implementation and main incoming message flow.
- `persistence`: JDBC repositories with explicit SQL.
- `domain`: immutable records and enums.

Rule for fresher: controller không chứa business logic, repository không quyết định workflow, engine không biết HTTP/database.

## 4. Runtime Flow

```text
1. Receive inbound request
2. Create request_id if missing
3. Convert channel payload to InboundChatMessage
4. Find or create customer
5. Find or create conversation
6. Lock by conversation_id
7. Check idempotency by conversation_id + external message_id
8. Load automation and active workflow version
9. Save customer message
10. Load or create conversation session
11. Execute workflow from current_node_id
12. Save updated session
13. Save bot response message
14. Save execution trace
15. Save action execution when ACTION node ran
16. Save idempotency record
17. Log structured event
18. Return response to Mock Chat client
```

## 5. Workflow Model

Supported nodes:

- `START`: entry point, exactly one per workflow.
- `MESSAGE`: send fixed message.
- `QUESTION`: send question and route next input by option/keyword/fallback.
- `CONDITION`: route by condition-like match rule.
- `ACTION`: call `ActionAdapter`, then continue to next node.
- `HANDOFF`: mark session waiting for human support.
- `END`: complete session.

Supported edge match types:

- `ALWAYS`: always follow this edge.
- `KEYWORD`: input contains `matchValue`.
- `OPTION`: input equals `matchValue`.
- `CONDITION`: simple keyword-like condition in this sample.
- `FALLBACK`: default route when previous routes do not match.

## 6. State Machine

Session state lives in `conversation_sessions`:

- `conversation_id`: one session per conversation.
- `automation_id`: automation being executed.
- `workflow_version_id`: exact published version.
- `current_node_id`: current workflow node.
- `status`: `ACTIVE`, `WAITING`, `COMPLETED`, `FAILED`.
- `version`: incremented on every state update.

The execution engine is stateless. It receives `currentNodeId` and returns `WorkflowExecutionOutcome`. The service layer decides persistence and trace.

## 7. Idempotency

`message_idempotency` has primary key:

```text
(conversation_id, external_message_id)
```

When the same channel message arrives twice, the system returns the original response message without creating extra user/bot messages or moving the session again.

Training discussion:

- Idempotency key must come from the producer side when possible.
- Idempotency check and session update must be inside the same consistency boundary.
- Duplicate handling should return a useful response, not only ignore the request.

## 8. Concurrency

The local sample uses `ConversationLockManager`:

```text
ConcurrentHashMap<conversation_id, ReentrantLock>
```

This serializes messages for the same conversation in one JVM. Different conversations can still run in parallel.

Production alternatives:

- Optimistic locking on `conversation_sessions.version`.
- `SELECT ... FOR UPDATE` on session row.
- Distributed lock by conversation id.
- Queue partitioning by conversation id.

## 9. Reliability

Implemented:

- Input validation on REST requests.
- Publish-time workflow validation.
- Fallback edge for invalid user input.
- Idempotency for duplicate message.
- Clear error response through `ApiExceptionHandler`.
- Action execution record for debug.

Extension exercises:

- Async action queue and worker.
- Retry with backoff for failed webhook/action.
- Dead-letter table for exhausted tasks.
- Session cleanup job.
- Rate limit by user/conversation/automation.

## 10. Observability

Implemented:

- Structured log in `MockChatService`:
  - `request_id`
  - `message_id`
  - `conversation_id`
  - `session_id`
  - `node_id`
  - `status`
- Persistent `execution_traces` table.
- Debug APIs for history, session, and trace.
- Spring Actuator metrics endpoint.

Rule for fresher: log phải giúp trả lời “request nào, message nào, conversation nào, session nào, đang ở node nào, kết quả gì”.

## 11. RPC Learning Hook

`intent-contract` and `intent-service` exist to discuss RPC design:

- protobuf as schema contract.
- client stub and server skeleton.
- REST for public/resource APIs.
- RPC for internal, typed, lower-latency service calls.
- in-process gRPC test for contract verification.
- standalone gRPC server on port `9091` when running `intent-service`.

The conversation product can run without a live intent service because the main demo uses deterministic workflow rules. This keeps the 90-minute demo reliable while still leaving a concrete RPC module for training.
