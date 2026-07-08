# Fresher Backend Mentoring Program

Target: fresher Java backend, 10 sessions, mỗi session 90 phút.

Product used throughout the program: Conversation Automation System.

## 1. Training Philosophy

Vai trò mentor: lead software engineer hướng dẫn fresher đi từ code chạy được đến tư duy production.

Rules xuyên suốt:

- Luôn bắt đầu từ problem statement và API contract.
- Không nhảy vào code khi chưa rõ data model và runtime flow.
- Tách boundary: controller, service, engine, repository, adapter.
- Test core logic trước khi phụ thuộc database/framework.
- Mọi state mutable phải được hỏi: ai update, khi nào, có duplicate không, có concurrent không.
- Log phải giúp debug request thật, không chỉ ghi “success” hoặc “failed”.
- Demo local được đơn giản hóa, nhưng phải nói rõ phần nào chưa đủ production.

## 2. Guideline Mapping

### PC 01: Parallelism & Concurrency

Kiến thức cần cover:

- Process, thread, background thread.
- Thread pool và blocking queue.
- Thread safety, shared mutable state.
- Lock, read/write race, deadlock risk.
- Atomic operation, CAS concept.
- Async vs blocking.
- Idempotency khi message bị gửi trùng.

Project mapping:

- `ConversationLockManager`: per-conversation lock.
- `conversation_sessions.version`: session state update counter.
- `message_idempotency`: duplicate message protection.
- `ConversationLockManagerTest`: test critical section.
- Optional exercise: queue/worker for async `ACTION` node.

### CS RPC 01: Client/Server and RPC

Kiến thức cần cover:

- Client/server responsibility.
- API contract and request/response model.
- REST for resource-oriented public APIs.
- RPC for internal typed service calls.
- Stub/skeleton, protobuf schema, serialization.
- Backward compatible contract changes.

Project mapping:

- REST controllers in `conversation-app`.
- `docs/api/api-contract.md`.
- `intent-contract/src/main/proto/intent_classifier.proto`.
- `intent-service`: skeleton for internal classifier service.
- Discussion: Mock Chat -> Channel Adapter -> Automation Service boundary.

### TE 01: Testing Engineering

Kiến thức cần cover:

- Unit test, integration test, smoke test.
- Cost of bugs by discovery stage.
- Design for testability.
- Dependency inversion and dependency injection.
- Avoid hidden global state and static-heavy business logic.

Project mapping:

- `WorkflowExecutionEngineTest`: unit test, no Spring.
- `WorkflowValidatorTest`: unit test for publish validation.
- `ConversationApiTest`: integration/API test with MockMvc.
- `MockChatFlowTest`: end-to-end backend flow.
- `ContextSmokeTest`: application context smoke test.

### OB 01: Observability

Kiến thức cần cover:

- Log, metrics, trace.
- Correlation/request id.
- Structured log vs free text log.
- Debug API vs production monitoring.
- What to log in workflow execution.

Project mapping:

- `MockChatService` structured log fields.
- `execution_traces` table.
- `/api/mock-chat/conversations/{conversationId}/trace`.
- `/actuator/metrics`.
- Training exercise: add timer/counter around action execution.

## 3. Session Plan

### Session 1: Product, Client/Server, and REST Contract

Outcome:

- Fresher hiểu bài toán Conversation Automation System.
- Biết vẽ boundary giữa Mock Chat, Channel Adapter, Automation Service.
- Biết đọc/viết API contract trước khi code.

90-minute flow:

- 15 phút: product walkthrough and user journey.
- 20 phút: client/server responsibilities.
- 25 phút: REST contract review in `docs/api/api-contract.md`.
- 20 phút: run `ConversationApiTest`.
- 10 phút: Q&A and recap.

Code touchpoints:

- `ConversationController`
- `MockChatController`
- Request/response records in controllers.

Exercise:

- Add one validation rule to a request DTO and write failing MockMvc test first.

### Session 2: Domain and Database Design

Outcome:

- Fresher biết chuyển requirement thành schema.
- Hiểu table nào là config, table nào là runtime state, table nào là log/debug.

90-minute flow:

- 15 phút: read product requirements.
- 25 phút: walk through `docs/design/database.md`.
- 20 phút: inspect `schema.sql`.
- 20 phút: discuss constraints/indexes/idempotency key.
- 10 phút: recap design tradeoffs.

Code touchpoints:

- `schema.sql`
- `Customer`, `Conversation`, `Message`
- `ConversationSession`, `ExecutionTrace`, `ActionExecution`

Exercise:

- Add a query endpoint or repository method using an existing index.

### Session 3: Workflow JSON and Publish Validation

Outcome:

- Fresher hiểu workflow as graph: node, edge, config, validation.
- Biết vì sao draft và published version phải tách nhau.

90-minute flow:

- 15 phút: compare rule engine vs workflow engine.
- 25 phút: `WorkflowDefinition` model.
- 25 phút: `WorkflowValidator` validation rules.
- 15 phút: run invalid workflow publish case.
- 10 phút: recap.

Code touchpoints:

- `WorkflowDefinition`
- `WorkflowNodeType`
- `WorkflowMatchType`
- `WorkflowValidator`
- `AutomationService.publishWorkflowVersion`

Exercise:

- Add validation for duplicate `FALLBACK` edge from the same node.

### Session 4: State Machine and Execution Engine

Outcome:

- Fresher hiểu state machine trong hội thoại nhiều bước.
- Biết tách stateless engine khỏi persistence.

90-minute flow:

- 20 phút: state machine concept with START -> QUESTION -> ACTION -> END.
- 25 phút: inspect `WorkflowExecutionEngine`.
- 20 phút: inspect `WorkflowExecutionEngineTest`.
- 15 phút: run fallback case.
- 10 phút: recap.

Code touchpoints:

- `WorkflowExecutionEngine`
- `WorkflowExecutionOutcome`
- `ConversationSession`

Exercise:

- Add `OPTION` edge test for a menu-like question.

### Session 5: Mock Chat Adapter and Runtime Orchestration

Outcome:

- Fresher hiểu adapter pattern và orchestration service.
- Biết đọc một runtime flow dài nhưng có trách nhiệm rõ.

90-minute flow:

- 15 phút: why adapter boundary exists.
- 20 phút: inspect `ChannelAdapter` and `MockChatChannelAdapter`.
- 30 phút: walk through `MockChatService.handleIncoming`.
- 15 phút: run HTTP demo steps 1-5.
- 10 phút: recap.

Code touchpoints:

- `ChannelAdapter`
- `InboundChatMessage`
- `MockChatService`
- `MockActionAdapter`

Exercise:

- Add a new mock action `CREATE_TICKET` and corresponding workflow.

### Session 6: Idempotency and Duplicate Message Handling

Outcome:

- Fresher hiểu duplicate delivery là normal case trong distributed systems.
- Biết thiết kế idempotency key và response behavior.

90-minute flow:

- 20 phút: duplicate message scenarios.
- 20 phút: inspect `message_idempotency` schema.
- 20 phút: inspect duplicate branch in `MockChatService`.
- 20 phút: run duplicate step in HTTP demo and `MockChatFlowTest`.
- 10 phút: recap.

Code touchpoints:

- `MessageIdempotencyRepository`
- `MockChatFlowTest`
- `message_idempotency`

Exercise:

- Change duplicate response to include original session id and update test.

### Session 7: Concurrency and Session Consistency

Outcome:

- Fresher hiểu race condition khi nhiều message update cùng session.
- Biết local lock khác gì production lock.

90-minute flow:

- 20 phút: thread, thread pool, shared state.
- 20 phút: race condition around `current_node_id`.
- 20 phút: inspect `ConversationLockManager`.
- 20 phút: run `ConversationLockManagerTest`.
- 10 phút: production alternatives.

Code touchpoints:

- `ConversationLockManager`
- `ConversationSessionRepository`
- `conversation_sessions.version`

Exercise:

- Draft an optimistic locking SQL update using `WHERE id = ? AND version = ?`.

### Session 8: Reliability, Actions, Retry, and Failed Tasks

Outcome:

- Fresher hiểu action/webhook failure không được làm hỏng toàn bộ conversation.
- Biết model retry/backoff/dead-letter ở mức thiết kế.

90-minute flow:

- 20 phút: action failure scenarios.
- 20 phút: inspect `ActionAdapter` and `MockActionAdapter`.
- 20 phút: inspect `action_executions`.
- 20 phút: design async worker and retry table extension.
- 10 phút: recap.

Code touchpoints:

- `ActionAdapter`
- `ActionResult`
- `ActionExecutionRepository`
- `ActionExecution`

Exercise:

- Add `FAILED` action execution when action name is unknown.

### Session 9: Observability and Debugging

Outcome:

- Fresher biết log thế nào để debug được real incident.
- Hiểu khác nhau giữa log, metrics, trace.

90-minute flow:

- 15 phút: observability concepts.
- 20 phút: inspect structured log in `MockChatService`.
- 20 phút: inspect `execution_traces`.
- 20 phút: run debug APIs: history, session, trace.
- 15 phút: discuss metrics outline.

Code touchpoints:

- `ExecutionTraceRepository`
- `/api/mock-chat/conversations/{conversationId}/trace`
- `/actuator/metrics`

Exercise:

- Add `actionName` to trace detail for action nodes.

### Session 10: Testing Strategy, Review, and Capstone

Outcome:

- Fresher biết chọn test level phù hợp.
- Biết review code theo behavior, data consistency, and observability.

90-minute flow:

- 20 phút: unit vs integration vs smoke vs regression.
- 20 phút: inspect all tests.
- 20 phút: run full `mvn test`.
- 20 phút: code review checklist.
- 10 phút: capstone briefing.

Code touchpoints:

- `WorkflowExecutionEngineTest`
- `WorkflowValidatorTest`
- `ConversationApiTest`
- `MockChatFlowTest`
- `ContextSmokeTest`

Capstone:

- Build a refund-support automation:
  - Workflow includes `QUESTION`, `CONDITION`, `ACTION`, `HANDOFF`, `END`.
  - Invalid input uses fallback.
  - Duplicate message is idempotent.
  - Trace API shows each processed step.
  - Add at least one unit test and one integration test.

## 4. Code Review Checklist for Fresher

- API contract is explicit and validated.
- Errors return useful message without leaking internals.
- Domain/state names match product language.
- Workflow publish validates bad structure before runtime.
- Session state update is guarded from race conditions.
- Duplicate input is safe to retry.
- External action is behind an adapter.
- Repository SQL is explicit and indexed query paths are known.
- Unit tests cover pure logic.
- Integration tests cover the main user flow.
- Logs contain request/message/conversation/session/node identifiers.
- Documentation explains how to run and how to debug.

## 5. Suggested Homework

- Add a `HANDOFF` workflow branch and test session status `WAITING`.
- Add advanced validation for unreachable nodes.
- Add async action queue with retry/backoff.
- Add a cleanup job for completed sessions older than a threshold.
- Add a rate limiter by `conversationId`.
- Add OpenAPI generation after the API stabilizes.
