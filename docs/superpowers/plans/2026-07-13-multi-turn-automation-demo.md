# Multi-Turn Automation Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current one-shot mock chat demo into a multi-turn automation that asks follow-up questions, keeps session state, categorizes user input, updates order status, and creates a support ticket.

**Architecture:** Keep the existing Spring Boot + React structure. Extend the workflow engine semantics so `START` enters the first prompt without consuming the same input for routing, then let prompt nodes route later user input. Use existing `messages.intent`, `execution_traces.detail_json`, and `action_executions` rather than adding new tables.

**Tech Stack:** Java 24, Spring Boot 3.5, H2/JDBC, JUnit/MockMvc, React/Vite, Node test runner.

## Global Constraints

- Do not add external services or production queues.
- Preserve existing REST API paths.
- Demonstrate automation through `Run auto demo` with multiple sequential messages.
- Keep manual Advanced workflow controls available for teaching each API call separately.
- Add tests before implementation.

---

### Task 1: Workflow Engine Multi-Turn Semantics

**Files:**
- Modify: `conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngineTest.java`
- Modify: `conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngine.java`

**Interfaces:**
- Consumes: `WorkflowExecutionEngine.execute(WorkflowDefinition, String, String, ActionAdapter)`
- Produces: `START` enters the first prompt only; prompt nodes route future input; action detail JSON carries category data.

- [ ] **Step 1: Write failing tests**
  - Add tests for first prompt, order-id follow-up, status update action, ticket action, and fallback retry.

- [ ] **Step 2: Run focused test**
  - Run: `JAVA_HOME=$(/usr/libexec/java_home -v 24) mvn -pl conversation-app -Dtest=WorkflowExecutionEngineTest test`
  - Expected: fail because current engine consumes the first input through the question node immediately.

- [ ] **Step 3: Implement minimal engine changes**
  - Stop evaluating prompt edges immediately after entering from `START`.
  - Allow `MESSAGE`, `QUESTION`, and `CONDITION` nodes to route later input.
  - Evaluate `CONDITION` as case-insensitive regex.

- [ ] **Step 4: Run focused test again**
  - Expected: pass.

### Task 2: Mock Chat Orchestration and Categorization

**Files:**
- Modify: `conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java`
- Modify: `conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java`
- Modify: `conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java`
- Modify: `conversation-app/src/main/java/com/zalo/training/conversation/domain/MessageIntent.java`
- Modify: `conversation-app/src/main/java/com/zalo/training/conversation/adapter/MockActionAdapter.java`

**Interfaces:**
- Produces: history API returns message intent; action adapter extracts order id from current input plus prior conversation context; trace detail JSON exposes category/status.

- [ ] **Step 1: Write failing integration test**
  - Add a test that sends `hello`, `order`, `A123`, `update`, `yes` in the same conversation.
  - Assert history has 10 rows, session completes at `end`, trace has order/ticket categories, and history includes intents.

- [ ] **Step 2: Run focused integration test**
  - Run: `JAVA_HOME=$(/usr/libexec/java_home -v 24) mvn -pl conversation-app -Dtest=MockChatFlowTest test`
  - Expected: fail before service/API/action changes.

- [ ] **Step 3: Implement categorization**
  - Add intents for `TICKET_REQUEST`, `ORDER_ID_PROVIDED`, `STATUS_UPDATE_REQUEST`, `AFFIRMATION`, and `NEGATION`.
  - Save intent on customer messages.
  - Return intent in history API.
  - Pass conversation context to the workflow engine so follow-up actions can reuse `A123`.

- [ ] **Step 4: Run focused integration test again**
  - Expected: pass.

### Task 3: React Demo Script and Explanation

**Files:**
- Modify: `frontend/src/demoState.test.mjs`
- Modify: `frontend/src/demoState.js`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces: `createAutoDemoScript(seed)` returns a deterministic multi-message script; `Run auto demo` sends all steps sequentially; UI shows the script and category/follow-up intent in history/trace.

- [ ] **Step 1: Write failing frontend tests**
  - Assert the sample workflow has multi-turn nodes and `createAutoDemoScript(123456)` returns five unique messages.

- [ ] **Step 2: Run frontend tests**
  - Run: `npm test -- demoState`
  - Expected: fail before helper/sample workflow changes.

- [ ] **Step 3: Implement UI behavior**
  - Update sample workflow.
  - Send scripted messages sequentially.
  - Show a compact scenario preview and intent badges.

- [ ] **Step 4: Run frontend tests**
  - Expected: pass.

### Task 4: Verification, Browser Check, Commit

**Files:**
- No source files beyond Tasks 1-3.

**Interfaces:**
- Produces: runnable local demo on `http://localhost:8080/ui`.

- [ ] **Step 1: Run full frontend tests and build**
  - `npm test`
  - `npm run build`

- [ ] **Step 2: Run backend package**
  - `JAVA_HOME=$(/usr/libexec/java_home -v 24) mvn -Pwith-frontend package`

- [ ] **Step 3: Restart server and browser verify**
  - Start `conversation-app/target/conversation-app-0.1.0-SNAPSHOT.jar`.
  - Verify `Run auto demo` creates a multi-turn history and no horizontal overflow.

- [ ] **Step 4: Commit**
  - Stage only touched files.
  - Run a staged diff safety scan.
  - Commit with `feat(ui): add multi-turn automation demo`.
