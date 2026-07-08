# Conversation Automation System Training Design

## Context

This repository will host a Java backend training project for freshers joining a mentoring program. The project is based on four source topics from the provided FT BE PDFs:

- PC: concurrency, background thread, thread local storage, thread pool, lock, atomic/CAS, async/nonblocking, blocking queue.
- CS RPC: client-server communication, REST/HTTP, RPC, stub/skeleton, serialization, REST vs RPC trade-offs.
- TE: testing levels, smoke/regression/system testing, design for testability, dependency inversion, dependency injection.
- OB: observability with emphasis on logging, plus basic metrics and trace correlation.

The chosen business domain is a Conversation Automation System. This keeps the product concrete enough to demo while still creating natural examples for queue processing, internal service calls, testability, and logging.

## Mentoring Stance

The mentor should act as a lead software engineer, not only as a Java instructor. The training should repeatedly connect code decisions to engineering judgment used in real teams:

- What problem are we solving for the product?
- What can fail in production?
- What should be simple now, and what should remain extensible later?
- Which dependency is allowed to leak across a boundary?
- How would another engineer debug this at 2 a.m.?
- What test would prevent this bug from returning?
- What log line would make the incident obvious?

Each session should include short "lead engineer notes" that summarize rules, trade-offs, and practical lessons from backend system design and maintenance.

## Product Goal

Build a small but complete backend system that receives customer messages, stores conversations, classifies message intent, evaluates automation rules, and creates automated replies or tasks.

The product should let a mentor demo a realistic backend flow:

1. A user starts a conversation.
2. The user sends a message.
3. The API persists the message and publishes an internal event.
4. A worker consumes the event from an in-memory blocking queue.
5. The worker calls an internal intent service through gRPC.
6. The automation engine matches rules and creates an automated reply.
7. The mentor queries the conversation and shows the generated reply.
8. Logs show the same `traceId` across API, queue, worker, RPC client, and automation engine.

## Target Learners

The course is designed for backend freshers who can write basic Java but have limited production experience. After the program, learners should be able to:

- Explain the difference between local calls, HTTP calls, and RPC calls.
- Build REST APIs with Spring Boot.
- Use thread pools and blocking queues for background work.
- Recognize thread-safety issues and fix them with appropriate primitives.
- Design services through interfaces so unit tests can isolate dependencies.
- Write unit, integration, smoke, and regression tests.
- Read structured logs and use trace IDs to debug a request flow.
- Implement a small feature end-to-end without breaking existing behavior.

## Technology Stack

- Java 21.
- Spring Boot 3.5.x.
- Maven.
- Spring Web for REST API.
- Spring Validation for request validation.
- Spring Actuator for health and basic operational endpoints.
- JUnit 5, AssertJ, Mockito, Spring Boot Test, and MockMvc.
- Testcontainers with PostgreSQL for the database-focused integration path.
- gRPC Java for internal RPC between the automation app and intent service.
- Logback through Spring Boot's default logging stack.

## Architecture

The implementation should start as a Maven multi-module project:

- `conversation-app`: main Spring Boot application exposing REST APIs, database repositories, automation worker, automation engine, and observability wiring.
- `intent-contract`: protobuf definitions and generated gRPC types.
- `intent-service`: small gRPC server that classifies a message into a known intent.
- `demo-client`: command-line client or HTTP scripts that drive the demo flow.

The system intentionally avoids a frontend. Training will use curl, HTTP request files, tests, logs, and database inspection so the focus stays on backend concepts.

### Runtime Flow

```text
HTTP client
  -> conversation-app REST API
  -> PostgreSQL persistence
  -> BlockingQueue<MessageReceivedEvent>
  -> AutomationWorker thread pool
  -> IntentRpcClient
  -> intent-service gRPC server
  -> AutomationEngine
  -> PostgreSQL automated reply/action
  -> structured logs with traceId
```

### Key Components

- `ConversationController`: public HTTP API boundary.
- `ConversationService`: use-case service for creating conversations and receiving messages.
- `ConversationRepository`, `MessageRepository`, `AutomationRuleRepository`, `AutomationActionRepository`: persistence boundaries.
- `MessageEventPublisher`: interface used by application code to publish background events.
- `BlockingQueueMessageEventPublisher`: in-memory queue implementation for training.
- `AutomationWorker`: background consumer using a configurable thread pool.
- `IntentClient`: interface for message classification.
- `GrpcIntentClient`: RPC client implementation.
- `AutomationEngine`: pure business logic that evaluates rules and creates actions.
- `TraceContext`: small helper that carries `traceId` across request and background execution.

## Database Design

The project should include an executable relational schema so freshers can see how product concepts map to storage.

### Tables

`customers`

- `id`: UUID primary key.
- `external_id`: unique customer identifier from upstream channel.
- `display_name`: customer display name.
- `created_at`: creation timestamp.

`conversations`

- `id`: UUID primary key.
- `customer_id`: foreign key to `customers`.
- `channel`: enum-like string such as `ZALO`, `WEB`, `EMAIL`.
- `status`: `OPEN`, `WAITING`, `CLOSED`.
- `created_at`: creation timestamp.
- `updated_at`: last update timestamp.

`messages`

- `id`: UUID primary key.
- `conversation_id`: foreign key to `conversations`.
- `sender_type`: `CUSTOMER`, `BOT`, `AGENT`.
- `content`: message body.
- `intent`: nullable classified intent.
- `trace_id`: request correlation ID.
- `created_at`: creation timestamp.

`automation_rules`

- `id`: UUID primary key.
- `intent`: intent the rule handles.
- `priority`: lower number runs first.
- `enabled`: boolean.
- `reply_template`: reply content template.
- `created_at`: creation timestamp.

`automation_actions`

- `id`: UUID primary key.
- `conversation_id`: foreign key to `conversations`.
- `source_message_id`: foreign key to `messages`.
- `rule_id`: nullable foreign key to `automation_rules`.
- `action_type`: `AUTO_REPLY`, `CREATE_TASK`, `NO_MATCH`.
- `status`: `PENDING`, `DONE`, `FAILED`.
- `result_message_id`: nullable foreign key to `messages`.
- `attempt_count`: retry counter.
- `idempotency_key`: unique key to prevent duplicate processing.
- `last_error`: nullable text.
- `created_at`: creation timestamp.
- `updated_at`: last update timestamp.

### Seed Data

The demo database should start with:

- Two customers.
- Two open conversations.
- Three automation rules:
  - `ORDER_STATUS_REQUEST` -> automated order status reply.
  - `HUMAN_AGENT_REQUEST` -> create handoff task message.
  - `GREETING` -> greeting reply.

## API Design

The public API should stay small enough for training:

- `POST /api/customers`: create a customer.
- `POST /api/conversations`: create a conversation for a customer and channel.
- `POST /api/conversations/{conversationId}/messages`: send a message and enqueue automation.
- `GET /api/conversations/{conversationId}`: fetch conversation detail with messages and automation actions.
- `GET /actuator/health`: smoke-testable health endpoint.

Request and response DTOs should be explicit. Controllers should not expose database entities directly.

## RPC Design

The internal RPC contract should classify text into intent:

```proto
service IntentClassifier {
  rpc ClassifyIntent(ClassifyIntentRequest) returns (ClassifyIntentResponse);
}

message ClassifyIntentRequest {
  string message_id = 1;
  string conversation_id = 2;
  string content = 3;
  string trace_id = 4;
}

message ClassifyIntentResponse {
  string intent = 1;
  double confidence = 2;
  string reason = 3;
}
```

The initial intent service can be deterministic and rule-based. That is deliberate: the goal is to teach RPC mechanics, contracts, serialization, latency, failure handling, and testing without adding machine learning complexity.

## Concurrency Learning Design

The project should contain teachable examples with production-like framing:

- `BlockingQueue` to decouple HTTP request handling from automation processing.
- Fixed-size `ExecutorService` for worker threads.
- `ThreadLocal` or MDC for trace IDs and its cleanup problem.
- Lock-based protection for a deliberately shared in-memory demo counter.
- `AtomicInteger` or `AtomicLong` as a better counter implementation.
- A small deadlock demo in a separate package or test, clearly marked as educational.
- Retry handling with attempt count and idempotency key to avoid duplicate automated replies.

The main app should use safe patterns. Unsafe examples should live in isolated lessons or tests so freshers can observe and fix them.

## Testing Strategy

Testing must be part of the product, not an afterthought.

- Unit tests:
  - `AutomationEngineTest` for rule matching.
  - `ConversationServiceTest` with mocked publisher/repository where appropriate.
  - `TraceContextTest` for trace propagation and cleanup.
- Integration tests:
  - REST API tests using `@SpringBootTest` and MockMvc.
  - Repository tests against PostgreSQL with Testcontainers.
  - gRPC client/server integration test for intent classification.
- Smoke tests:
  - health endpoint.
  - create conversation, send message, observe automated reply.
- Regression tests:
  - no duplicate action for the same idempotency key.
  - disabled rule is not applied.
  - failed RPC produces failed action or retry state without losing the message.

## Observability Design

The baseline observability product should include:

- Structured log lines with `traceId`, `conversationId`, `messageId`, `eventType`, and `status`.
- MDC propagation from HTTP requests into worker execution.
- Log points at API entry, message persisted, event enqueued, worker started, RPC request, RPC response, rule matched, action completed, and error path.
- Actuator health endpoint.
- Simple counters for received messages, processed messages, failed automations, and RPC failures.

The first observability focus is logging, matching the source PDF. Metrics and health are included only as small supporting examples.

## Engineering Rules to Teach

These rules should be reinforced across the 10 sessions.

### Product and Requirement Rules

- Do not start from code. Start from user flow, failure cases, and measurable success criteria.
- Keep the first version small enough to demo end-to-end.
- A feature is not done when it compiles; it is done when it can be operated, tested, and explained.
- Domain language matters. Use names like `Conversation`, `Message`, `AutomationRule`, and `AutomationAction` consistently.

### API and Contract Rules

- Public APIs should be stable, explicit, validated, and easy to debug.
- Internal contracts can optimize for performance but must still be versioned and tested.
- Never expose database entities directly as API responses.
- Make error responses predictable. A bad request, missing resource, and internal failure should not look the same.

### Code Design Rules

- Put business logic in services or pure domain components, not controllers.
- Depend on interfaces at boundaries that may change or need mocking.
- Avoid static global mutable state.
- Prefer constructor injection so dependencies are visible and testable.
- Keep side effects at the edges: database, network, queue, clock, and logging.
- Make idempotency explicit for retryable operations.

### Concurrency Rules

- Shared mutable state is a design smell until proven necessary.
- Choose the simplest safe concurrency primitive: immutable data, queue, lock, atomic, or thread confinement.
- Always define ownership of data across threads.
- A retry system without idempotency can create duplicate business effects.
- Clean up thread-local context after worker execution.

### Database Rules

- Model the product first, then design tables.
- Use database constraints for invariants that must never be violated.
- Store enough state to recover from failures.
- Keep audit fields such as `created_at` and `updated_at`.
- Do not hide important business state only in logs.

### Testing Rules

- Unit tests protect business decisions.
- Integration tests protect wiring and contracts.
- Smoke tests protect deployability.
- Regression tests protect bugs that already happened or could easily return.
- Test behavior, not private implementation details.

### Observability Rules

- Every important flow needs a correlation ID.
- Logs should answer what happened, to which entity, by which component, and with what result.
- Log errors with context, not just stack traces.
- Metrics tell that something is wrong; logs explain what happened.
- If a background job can fail silently, the system is not operable.

## Ten-Year Engineering Lessons to Embed

The mentor should repeatedly surface practical lessons that freshers usually only learn after maintaining systems:

- Simple architecture with clear boundaries beats clever abstraction.
- A small synchronous flow is easier to reason about; add async only when it solves a real problem.
- Async processing changes the product contract: clients may receive `accepted`, not `completed`.
- Data consistency is a product decision, not only a database decision.
- Distributed calls fail in more ways than local calls: timeout, partial response, slow dependency, schema mismatch.
- Good logs reduce incident time more than heroic debugging skill.
- Tests are documentation for future maintainers.
- Most production bugs happen at boundaries: API input, database transaction, network call, queue retry, concurrency.
- Performance tuning starts with measurement, not guesses.
- Maintainability is a feature. Code will be read far more often than it is written.

## Demo Script

The mentor should be able to run one complete demo:

1. Start PostgreSQL, `intent-service`, and `conversation-app`.
2. Call health endpoint.
3. Create customer `customer-001`.
4. Create conversation for channel `ZALO`.
5. Send message `Cho toi kiem tra don hang #A123`.
6. Show API returns accepted state with `traceId`.
7. Tail logs and follow the same `traceId`.
8. Query conversation detail.
9. Show original customer message, classified intent, automation action, and bot reply.
10. Run test suite and show which tests protect the flow.

The repo should include copy-pasteable HTTP requests and a README walkthrough.

## Training Program

The course has 10 sessions, each 90 minutes.

### Session 1: Product and Backend System Overview

- Product: what a conversation automation system does.
- Concepts: client, server, API, domain model, database row, request-response.
- Lead engineer notes: start from user flow; define done as demoable, testable, and observable.
- Demo: create customer, create conversation, send message without automation.
- Lab: add a validation rule to reject blank message content.

### Session 2: Java Threads and Background Work

- Concepts: process vs thread, background thread, request thread, worker thread.
- Project example: message event is processed after HTTP returns.
- Lead engineer notes: async changes semantics; returning fast is useful only if the background path is reliable.
- Demo: single worker consumes events.
- Lab: add logs showing thread names and trace IDs.

### Session 3: Queue, Thread Pool, Retry, Idempotency

- Concepts: blocking queue, producer-consumer, thread pool sizing, retry, duplicate prevention.
- Project example: `MessageReceivedEvent` queue and automation action idempotency key.
- Lead engineer notes: retry without idempotency creates duplicate business effects.
- Demo: process multiple messages concurrently.
- Lab: implement or extend retry logic for transient intent-service failure.

### Session 4: Thread Safety, Lock, Atomic, Deadlock

- Concepts: race condition, critical section, lock, read-write lock, atomic, CAS, deadlock.
- Project example: unsafe processing counter vs atomic counter.
- Lead engineer notes: shared mutable state requires ownership rules; avoid it when possible.
- Demo: reproduce a race condition in a test and fix it.
- Lab: replace lock-based counter with atomic counter and explain trade-offs.

### Session 5: REST API and Client-Server Design

- Concepts: resource-oriented API, DTO, validation, status code, error response.
- Project example: conversation and message APIs.
- Lead engineer notes: an API is a contract; make invalid states hard to express.
- Demo: use HTTP requests to drive the product.
- Lab: add an endpoint to close a conversation with tests.

### Session 6: RPC and Internal Service Calls

- Concepts: local call vs remote call, RPC, stub, skeleton, serialization, REST vs RPC.
- Project example: `IntentClassifier` gRPC service.
- Lead engineer notes: every network boundary needs timeout, error handling, and contract tests.
- Demo: classify message through gRPC and compare with a local implementation.
- Lab: add a new intent classification rule in the RPC service.

### Session 7: Design for Testability

- Concepts: tight coupling, dependency inversion, dependency injection, interface boundary, mock.
- Project example: `IntentClient`, `MessageEventPublisher`, repositories, automation engine.
- Lead engineer notes: testability is designed before tests are written.
- Demo: test automation without real database or network.
- Lab: refactor a deliberately tightly-coupled example into testable code.

### Session 8: Unit, Integration, Smoke, Regression Testing

- Concepts: unit test, integration test, system test, smoke test, regression test, test pyramid.
- Project example: JUnit, Mockito, MockMvc, Testcontainers.
- Lead engineer notes: choose test level by risk and cost; slow tests must earn their keep.
- Demo: run a fast unit test and a slower database integration test.
- Lab: write a regression test for disabled automation rule.

### Session 9: Observability with Logs

- Concepts: log level, structured log, trace ID, MDC, health, metrics.
- Project example: trace one message across REST, queue, worker, RPC, and DB write.
- Lead engineer notes: logs are part of the product because operators are users too.
- Demo: debug a failed automation using logs.
- Lab: add a missing log point with useful fields.

### Session 10: Capstone Demo and Review

- Concepts: end-to-end ownership, product demo, code review checklist, operational thinking.
- Capstone: each fresher adds one automation behavior with DB seed, API/RPC change if needed, tests, logs, and demo request.
- Lead engineer notes: review the full change, not only the diff; check behavior, design, tests, logs, and rollback risk.
- Review: discuss correctness, readability, testability, and observability.

## Fresher Review Rubric

Each capstone submission should be reviewed as a real engineering change:

- Product correctness: the feature solves the stated conversation automation scenario.
- API quality: request/response shape is explicit, validated, and backward-compatible.
- Data design: schema changes are justified and preserve invariants.
- Concurrency safety: retries, worker behavior, and shared state are safe.
- RPC handling: remote calls have clear contracts, timeout behavior, and error handling.
- Test coverage: unit, integration, or regression tests match the risk of the change.
- Observability: logs include trace ID and enough entity context to debug failures.
- Maintainability: names are clear, boundaries are respected, and implementation is no more complex than needed.

## Learning Artifacts

The repository should contain:

- Source code for all modules.
- `README.md` with setup and demo instructions.
- `docs/training/` with session notes.
- `docs/design/architecture.md` with system diagram and flow.
- `docs/design/database.md` with schema explanation.
- `docs/demo/http/` with runnable HTTP request files.
- `docs/exercises/` with labs and expected outcomes.
- Tests that double as executable examples.

## Scope Boundaries

In scope:

- Backend-only training product.
- PostgreSQL schema and Testcontainers-backed integration tests.
- REST API, gRPC internal service, queue/worker automation flow.
- Logging-first observability.
- Educational concurrency examples.
- Ten-session training curriculum.

Out of scope:

- Frontend UI.
- Real Zalo integration.
- Real ML/NLP intent detection.
- Production authentication and authorization.
- Distributed message broker such as Kafka or RabbitMQ.
- Kubernetes deployment.

These can become follow-up modules after the fresher foundation is complete.

## Success Criteria

The project is successful when:

- A mentor can run the system locally and demo the full conversation automation flow.
- The database schema and seed data are understandable to freshers.
- Each of the 10 sessions maps to concrete source code, tests, and exercises.
- The project demonstrates concurrency safely while isolating intentionally unsafe examples.
- REST and RPC are both present and easy to compare.
- The test suite includes unit, integration, smoke, and regression examples.
- Logs are good enough to trace one message from HTTP request to automated reply.
