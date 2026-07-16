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

React UI is packaged from `frontend` into Spring Boot static resources when building with `-Pwith-frontend`. It has three local entry points:

- `/`: landing page for demo navigation.
- `/ui`: Conversation Automation console for workflow setup, mock chat, history, session, and trace.
- `/training`: ZA Fresher Training portal for PC/CS RPC/TE/OB learning tracks, examples, exercises, and roadmap.

```text
frontend React/Vite source
    |
    | npm ci && npm run build
    v
frontend/dist
    |
    | Maven copy-resources
    v
conversation-app/target/classes/static
    |
    v
single Spring Boot JAR serves UI + API
```

## 3. Module Boundaries

- `api`: REST controllers and response/request DTOs.
- `application`: use-case services and business orchestration.
- `adapter`: external boundary abstractions such as channel and action adapters.
- `workflow`: workflow JSON model, validation, and stateless execution engine.
- `mockchat`: demo channel implementation and main incoming message flow.
- `persistence`: JDBC repositories with explicit SQL.
- `domain`: immutable records and enums.
- `frontend`: React landing page, automation console, and training portal for local mentoring and demos.

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
8. Load automation by automation_id or account_id and active workflow version
9. Save customer message
10. Load or create conversation session
11. Execute workflow from current_node_id
12. Save updated session with version check
13. Build channel-independent TEXT output contract
14. Save bot response message
15. Save execution trace with node path and outputs
16. Save action execution when ACTION node ran
17. Save idempotency record with original response and execution ids
18. Log structured event with execution_id
19. Return response to Mock Chat client
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

The execution engine is stateless. It receives `currentNodeId` and returns `WorkflowExecutionOutcome`, including the node path for that execution. The service layer decides persistence and trace.

## 7. Output Contract

Runtime currently produces a channel-independent output list with one supported type:

```json
[
  {
    "type": "TEXT",
    "text": "Order A123 is PACKING."
  }
]
```

`MockChatController` still returns the legacy `response` string for the local UI, but the adapter-facing contract is `outputs`. Execution trace detail also stores `outputs`, so reviewers can see exactly what was produced for one `execution_id`.

## 8. Idempotency

`message_idempotency` has primary key:

```text
(conversation_id, external_message_id)
```

When the same channel message arrives twice, the system returns the original response message without creating extra user/bot messages or moving the session again.
The duplicate response also returns the original `executionId`, so reviewers can reopen the exact trace for the first processing attempt.

Training discussion:

- Idempotency key must come from the producer side when possible.
- Idempotency check and session update must be inside the same consistency boundary.
- Duplicate handling should return a useful response, not only ignore the request.

## 9. Concurrency

The local sample uses `ConversationLockManager`:

```text
ConcurrentHashMap<conversation_id, ReentrantLock>
```

This serializes messages for the same conversation in one JVM. Different conversations can still run in parallel.

Session updates also use an optimistic `conversation_sessions.version` check. The JVM lock is the main training guard for a single local instance; the version check makes stale writes explicit and is the bridge to database-first concurrency control.

Production alternatives:

- Optimistic locking on `conversation_sessions.version`.
- `SELECT ... FOR UPDATE` on session row.
- Distributed lock by conversation id.
- Queue partitioning by conversation id.

## 10. Reliability

Implemented:

- Input validation on REST requests.
- Publish-time workflow validation.
- Fallback edge for invalid user input.
- Idempotency for duplicate message.
- Optimistic session update guard.
- Clear error response through `ApiExceptionHandler`.
- Action execution record for debug.

Extension exercises:

- Async action queue and worker.
- Retry with backoff for failed webhook/action.
- Dead-letter table for exhausted tasks.
- Session cleanup job.
- Rate limit by user/conversation/automation.

## 11. Observability

Implemented:

- Structured log in `MockChatService`:
  - `request_id`
  - `message_id`
  - `conversation_id`
  - `session_id`
  - `execution_id`
  - `node_id`
  - `status`
- Persistent `execution_traces` table with per-execution node path.
- Debug APIs for history, session, trace by conversation, trace by execution id, and trace by session id.
- React Automation console for workflow setup, mock chat input, session, history, and trace.
- React Training portal for knowledge roadmap, guideline mapping, exercises, and capstone framing.
- Spring Actuator metrics endpoint.

Rule for fresher: log phải giúp trả lời “request nào, message nào, conversation nào, session nào, đang ở node nào, kết quả gì”.

## 12. RPC Learning Hook

`intent-contract` and `intent-service` exist to discuss RPC design:

- protobuf as schema contract.
- client stub and server skeleton.
- REST for public/resource APIs.
- RPC for internal, typed, lower-latency service calls.
- in-process gRPC test for contract verification.
- standalone gRPC server on port `9091` when running `intent-service`.

The conversation product can run without a live intent service because the main demo uses deterministic workflow rules. This keeps the 90-minute demo reliable while still leaving a concrete RPC module for training.
