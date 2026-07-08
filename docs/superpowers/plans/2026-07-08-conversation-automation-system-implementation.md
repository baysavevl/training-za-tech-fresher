# Conversation Automation System Implementation Plan

## Goal

Build a local Java/Spring Boot project for fresher mentoring around a Conversation Automation System. The project must be runnable, testable, documented, and useful as a 10-session training backbone.

## Scope

Core product:

- Backend Java application.
- Mock Chat API.
- Automation and workflow management APIs.
- Workflow JSON publish validation.
- Workflow execution engine.
- Session management.
- Duplicate `message_id` idempotency.
- Per-conversation concurrency guard.
- Action adapter with mock external actions.
- Structured logs and debug APIs.
- React/Vite dashboard served from the same Spring Boot artifact when built with `-Pwith-frontend`.
- Database schema for config, runtime state, history, trace, and action execution.
- Unit and integration tests.
- README, design docs, API contract, demo script, and training program.

Optional/design-only extensions:

- Async action queue and worker.
- Retry/backoff and dead-letter storage.
- Session cleanup job.
- Rate limiting.
- Advanced workflow validation.
- Additional Web UI views beyond the local dashboard.

## Implemented Modules

- `conversation-app`: REST API, workflow engine, mock chat service, repositories, schema, tests.
- `frontend`: React/Vite dashboard for workflow setup, mock chat, and debug trace.
- `intent-contract`: protobuf/gRPC contract used for RPC training.
- `intent-service`: Spring Boot skeleton for internal service training.

## Implementation Checklist

- [x] Create Maven multi-module skeleton.
- [x] Add executable H2/PostgreSQL-compatible schema.
- [x] Add basic customer/conversation/message REST APIs.
- [x] Add automation CRUD/update API.
- [x] Add workflow draft and publish API.
- [x] Add workflow model, validation, and execution engine.
- [x] Add mock chat adapter and incoming message API.
- [x] Add session state persistence.
- [x] Add duplicate message idempotency.
- [x] Add per-conversation lock.
- [x] Add mock action adapter and action execution storage.
- [x] Add execution trace storage and debug APIs.
- [x] Add structured log fields on main flow.
- [x] Add React dashboard and Maven `with-frontend` packaging profile.
- [x] Add unit tests for engine, validator, idempotency, and concurrency.
- [x] Add integration tests for REST and mock chat flow.
- [x] Add JavaDoc to main sample classes.
- [x] Add gRPC intent classifier implementation and in-process RPC tests.
- [x] Add README, architecture, database, API contract, demo script, and knowledge program.

## Verification Commands

Use Java 21+:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
mvn test
```

Focused workflow verification:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
mvn -pl conversation-app -am -Dtest=WorkflowValidatorTest,WorkflowExecutionEngineTest,MockChatFlowTest,ConversationLockManagerTest test
```

Single artifact verification:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
mvn -Pwith-frontend clean package
```

## Finalization

- No publish/deploy.
- Commit local changes after full verification passes.
