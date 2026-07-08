# Conversation Automation System Training Design

## Context

This repository hosts a Java backend training project for fresher mentoring. The product domain is a Conversation Automation System, chosen because it naturally exercises API design, workflow modeling, session state, concurrency, idempotency, reliability, observability, and testing.

The training material is based on four FT BE guideline groups:

- PC: parallelism, concurrency, locks, thread safety, atomicity, async concepts.
- CS RPC: client/server, REST, RPC, stub/skeleton, serialization, API contract.
- TE: unit/integration/smoke/regression testing, dependency inversion, design for testability.
- OB: logs, metrics, trace, request correlation, debug workflow.

## Product Scope

Implemented local backend:

- Spring Boot Java application.
- Mock Chat API to simulate user messages and automated responses.
- Automation APIs to create/update/enable/disable automations.
- Workflow draft and publish APIs.
- Workflow JSON with `START`, `MESSAGE`, `QUESTION`, `CONDITION`, `ACTION`, `HANDOFF`, `END`.
- Publish-time workflow validation.
- Execution engine that loads active workflow and session, routes input, invokes action adapter, updates session, and returns response.
- Message history, session state, execution trace, and action execution storage.
- Duplicate message handling by `message_id` idempotency.
- Per-conversation concurrency guard.
- Structured logs and debug APIs.
- Unit and integration tests.
- gRPC intent contract/service/test for RPC lessons.
- README, API contract, architecture, database, demo HTTP, and 10-session training program.

## Mentoring Stance

The mentor should act as a lead software engineer:

- Start with product behavior and API contract.
- Make state ownership explicit before coding.
- Treat duplicate messages and concurrent delivery as normal cases.
- Keep boundaries clean: controller, service, engine, repository, adapter.
- Prefer pure logic for unit tests and Spring only where integration behavior matters.
- Log enough identifiers to debug a real request.
- Call out which decisions are demo-local and which need a production alternative.

## Architecture Summary

Primary runtime path:

```text
Mock Chat HTTP request
  -> MockChatController
  -> MockChatChannelAdapter
  -> MockChatService
  -> ConversationLockManager
  -> MessageIdempotencyRepository
  -> AutomationService
  -> WorkflowExecutionEngine
  -> ActionAdapter
  -> message/session/trace/action repositories
  -> structured log
  -> HTTP response
```

Supporting learning modules:

- `intent-contract`: protobuf/gRPC contract for RPC lessons.
- `intent-service`: Spring Boot skeleton for internal service boundary discussion.
- legacy `AutomationEngine`: simple rule-engine step before workflow engine.

## Training Outcomes

After 10 sessions, fresher should be able to:

- Explain API contracts between Mock Chat, Channel Adapter, and Automation Service.
- Build REST endpoints with DTO validation and consistent error responses.
- Model a workflow as JSON graph data.
- Explain state machine and session management in multi-step conversations.
- Design relational tables for config, runtime state, history, trace, and action execution.
- Recognize race conditions and duplicate message risks.
- Apply idempotency and locking/transaction boundaries.
- Design adapter interfaces for channels and external actions.
- Use logs, trace rows, metrics endpoints, and debug APIs.
- Write unit tests for pure logic and integration tests for main flows.

## Deliverables

- Runnable source code in local Maven modules.
- Clear setup guide in `README.md`.
- Mock Chat Service and automation workflow APIs.
- Executable schema in `schema.sql`.
- Debug APIs for history/session/trace.
- API contract in `docs/api/api-contract.md`.
- Architecture and database docs.
- HTTP demo script.
- Training program in `docs/training/knowledge-program.md`.
