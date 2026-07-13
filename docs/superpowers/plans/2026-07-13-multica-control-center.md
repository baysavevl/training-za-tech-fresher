# Multica Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a local `/agents` control panel that manages real Multica agents through a safe Spring Boot bridge to the authenticated `multica` CLI.

**Architecture:** Add a Spring Boot `/api/multica/*` layer that exposes allowlisted Multica operations and never accepts arbitrary shell commands. Add React/Vite display and form logic that calls those endpoints, renders daemon/runtime/agent/project/issue state, and explains the orchestration concepts.

**Tech Stack:** Java 21, Spring Boot 3.5.9, MockMvc/JUnit 5, React 19.2, Vite 7.3, Node test runner, lucide-react.

## Global Constraints

- The browser must never execute shell commands directly.
- Backend command execution must use `ProcessBuilder` argument arrays, not shell strings.
- Only predefined `multica` commands are allowed.
- Every CLI command must have a timeout.
- Do not expose auth tokens, config file contents, environment variables, or high-value secrets.
- Redact token-like strings from command output before returning it.
- This is local developer tooling, not a production multi-user admin surface.
- Keep UI consistent with the existing light dashboard style, compact panels, 8px radius, lucide icons, and restrained color.
- Keep the existing untracked `multica/` checkout out of commits.

---

## File Structure

- `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandKind.java` defines the allowlisted command kinds.
- `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandResult.java` records exit code, redacted output, parsed JSON, and duration.
- `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandLog.java` stores the last local command results in memory.
- `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandRunner.java` runs `ProcessBuilder` with timeout and redaction.
- `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandService.java` builds validated command argument arrays for all supported operations.
- `conversation-app/src/main/java/com/zalo/training/conversation/api/MulticaController.java` exposes `/api/multica/*`.
- `conversation-app/src/main/java/com/zalo/training/conversation/api/UiForwardController.java` forwards `/agents`.
- `conversation-app/src/test/java/com/zalo/training/conversation/multica/MulticaCommandServiceTest.java` covers command building and validation.
- `conversation-app/src/test/java/com/zalo/training/conversation/api/MulticaControllerTest.java` covers controller JSON and mocked command responses.
- `conversation-app/src/test/java/com/zalo/training/conversation/api/UiForwardControllerTest.java` adds `/agents` forwarding coverage.
- `frontend/src/multicaControlCenter.js` holds fetch helpers, display mapping, form defaults, validation, and concept glossary.
- `frontend/src/multicaControlCenter.test.mjs` covers frontend mapping and validation.
- `frontend/src/main.jsx` adds `/agents` routing, navigation, and the `MulticaControlCenter` page.
- `frontend/src/styles.css` adds compact dashboard styles for the page.

---

### Task 1: Backend CLI Command Bridge

**Files:**
- Create: `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandKind.java`
- Create: `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandResult.java`
- Create: `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandLog.java`
- Create: `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandRunner.java`
- Create: `conversation-app/src/main/java/com/zalo/training/conversation/multica/MulticaCommandService.java`
- Create: `conversation-app/src/test/java/com/zalo/training/conversation/multica/MulticaCommandServiceTest.java`

**Interfaces:**
- Produces: `MulticaCommandService` methods:
  - `status()`
  - `runtimes()`
  - `agents()`
  - `createAgent(CreateAgentInput input)`
  - `projects()`
  - `createProject(CreateProjectInput input)`
  - `repos()`
  - `addRepo(AddRepoInput input)`
  - `issues()`
  - `createIssue(CreateIssueInput input)`
  - `assignIssue(String issueId, AssignIssueInput input)`
  - `restartDaemon()`
  - `commands()`
- Produces: validation error shape through `IllegalArgumentException` for invalid inputs.

- [x] **Step 1: Write failing service tests**

Create `MulticaCommandServiceTest` with tests for argument arrays and validation:

```java
@Test
void buildsCreateIssueCommandWithProjectAndAssignee() {
    RecordingRunner runner = new RecordingRunner(successJson("{}"));
    MulticaCommandService service = new MulticaCommandService(runner, new MulticaCommandLog());

    service.createIssue(new MulticaCommandService.CreateIssueInput(
            "Fix login validation",
            "Patch validation edge cases",
            "todo",
            "high",
            "project-123",
            "agent-456"
    ));

    assertThat(runner.lastArgs()).containsExactly(
            "multica", "issue", "create",
            "--title", "Fix login validation",
            "--description", "Patch validation edge cases",
            "--status", "todo",
            "--priority", "high",
            "--project", "project-123",
            "--assignee-id", "agent-456",
            "--output", "json"
    );
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `export JAVA_HOME=$(/usr/libexec/java_home -v 24); mvn -pl conversation-app -Dtest=MulticaCommandServiceTest test`

Expected: compilation fails because `MulticaCommandService` does not exist.

- [x] **Step 3: Implement command model, runner, log, and service**

Implement an allowlisted service that only builds fixed argument arrays. Runner uses `ProcessBuilder`, waits up to `10s`, redacts token-like strings, parses JSON only when the command expects JSON, and logs the result.

Important methods:

```java
private MulticaCommandResult json(MulticaCommandKind kind, List<String> args) {
    return execute(kind, withOutputJson(args), true);
}

private List<String> withOutputJson(List<String> args) {
    ArrayList<String> next = new ArrayList<>(args);
    next.add("--output");
    next.add("json");
    return next;
}
```

- [x] **Step 4: Run service tests**

Run: `export JAVA_HOME=$(/usr/libexec/java_home -v 24); mvn -pl conversation-app -Dtest=MulticaCommandServiceTest test`

Expected: tests pass.

---

### Task 2: Backend REST API

**Files:**
- Create: `conversation-app/src/main/java/com/zalo/training/conversation/api/MulticaController.java`
- Create: `conversation-app/src/test/java/com/zalo/training/conversation/api/MulticaControllerTest.java`
- Modify: `conversation-app/src/main/java/com/zalo/training/conversation/api/UiForwardController.java`
- Modify: `conversation-app/src/test/java/com/zalo/training/conversation/api/UiForwardControllerTest.java`

**Interfaces:**
- Consumes: `MulticaCommandService` from Task 1.
- Produces endpoints:
  - `GET /api/multica/status`
  - `GET /api/multica/runtimes`
  - `GET /api/multica/agents`
  - `POST /api/multica/agents`
  - `GET /api/multica/projects`
  - `POST /api/multica/projects`
  - `GET /api/multica/repos`
  - `POST /api/multica/repos`
  - `GET /api/multica/issues`
  - `POST /api/multica/issues`
  - `POST /api/multica/issues/{id}/assign`
  - `POST /api/multica/daemon/restart`
  - `GET /api/multica/commands`

- [x] **Step 1: Write failing controller tests**

Use `@WebMvcTest(MulticaController.class)` with `@MockBean MulticaCommandService`. Cover at least:

```java
@Test
void returnsRuntimesCommandResult() throws Exception {
    given(service.runtimes()).willReturn(MulticaCommandResult.successJson(
            MulticaCommandKind.RUNTIME_LIST,
            List.of("multica", "runtime", "list", "--output", "json"),
            "[{\"id\":\"runtime-1\",\"provider\":\"codex\",\"status\":\"online\"}]",
            objectMapper,
            Duration.ofMillis(25)
    ));

    mockMvc.perform(get("/api/multica/runtimes"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true))
            .andExpect(jsonPath("$.data[0].provider").value("codex"));
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `export JAVA_HOME=$(/usr/libexec/java_home -v 24); mvn -pl conversation-app -Dtest=MulticaControllerTest,UiForwardControllerTest test`

Expected: compilation fails because `MulticaController` does not exist and `/agents` is not forwarded.

- [x] **Step 3: Implement controller and forwarding**

Add `@RestController @RequestMapping("/api/multica")`, delegate each endpoint to `MulticaCommandService`, and return `MulticaCommandResult` directly. Add `/agents` and `/agents/**` to `UiForwardController`.

- [x] **Step 4: Run controller tests**

Run: `export JAVA_HOME=$(/usr/libexec/java_home -v 24); mvn -pl conversation-app -Dtest=MulticaControllerTest,UiForwardControllerTest test`

Expected: tests pass.

---

### Task 3: Frontend Client and Display Models

**Files:**
- Create: `frontend/src/multicaControlCenter.js`
- Create: `frontend/src/multicaControlCenter.test.mjs`

**Interfaces:**
- Produces:
  - `createEmptyControlCenterState()`
  - `concepts`
  - `agentFormDefaults`
  - `projectFormDefaults`
  - `issueFormDefaults`
  - `displayRuntime(runtime)`
  - `displayAgent(agent)`
  - `displayIssue(issue)`
  - `validateProjectForm(form)`
  - `validateIssueForm(form)`
  - `controlCenterRequest(path, options)`

- [x] **Step 1: Write failing frontend tests**

Create tests for runtime display and form validation:

```js
test('displayRuntime normalizes provider and status labels', () => {
  assert.deepEqual(displayRuntime({
    id: 'runtime-1',
    provider: 'codex',
    status: 'online',
    name: 'Codex (MacBook)',
    daemon_id: 'daemon-1',
    last_seen_at: '2026-07-13T10:00:00+07:00'
  }), {
    id: 'runtime-1',
    provider: 'codex',
    providerLabel: 'Codex',
    status: 'online',
    statusLabel: 'Online',
    name: 'Codex (MacBook)',
    daemonId: 'daemon-1',
    lastSeenAt: '2026-07-13T10:00:00+07:00'
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- multicaControlCenter.test.mjs`

Expected: fails because `multicaControlCenter.js` does not exist.

- [x] **Step 3: Implement helper module**

Implement display mappers with defensive defaults and validation that returns string arrays. `controlCenterRequest` should parse JSON, preserve backend error bodies, and throw `Error` with `error.body`.

- [x] **Step 4: Run frontend helper tests**

Run: `cd frontend && npm test -- multicaControlCenter.test.mjs`

Expected: tests pass.

---

### Task 4: Frontend Multica Control Center Page

**Files:**
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: helpers from `frontend/src/multicaControlCenter.js`.
- Produces: `/agents` page in the React router.

- [x] **Step 1: Add page component and route**

Add route handling:

```jsx
if (path.startsWith('/agents')) {
  return <MulticaControlCenter navigate={navigate} />
}
```

Add a `MulticaControlCenter` component that loads status, runtimes, agents, projects, repos, issues, and commands on mount and after successful mutations.

- [x] **Step 2: Add forms and actions**

Add compact forms for:

- create agent with name, runtime, instructions, visibility
- create project with title and repo URL
- add workspace repo URL
- create issue with title, description, project, status, priority, assignee
- assign existing issue to selected agent
- restart daemon

- [x] **Step 3: Add styles**

Add CSS classes prefixed with `agent-` or `control-` for dense cards, status chips, command log, and concept glossary. Do not modify the existing dashboard layout in ways that affect `/ui` or `/training`.

- [x] **Step 4: Run frontend build**

Run: `cd frontend && npm run build`

Expected: Vite build succeeds.

---

### Task 5: End-to-End Verification

**Files:**
- No new source files.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified local behavior.

- [x] **Step 1: Run backend tests**

Run: `export JAVA_HOME=$(/usr/libexec/java_home -v 24); mvn test`

Expected: all Maven tests pass.

- [x] **Step 2: Run frontend tests**

Run: `cd frontend && npm test`

Expected: all Node tests pass.

- [x] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`

Expected: build succeeds.

- [x] **Step 4: Manual local verification**

With local Multica running, open `http://localhost:8080/agents` or Vite `http://localhost:5173/agents`. Confirm daemon status, runtimes, agents, projects, repos, issues, and command log render. Create a harmless test issue and assign it only if an existing test agent is available.

---

## Self-Review

- Spec coverage: backend bridge, frontend dashboard, command safety, command log, core concepts, errors, testing, and company-use constraints are covered.
- Placeholder scan: no `TBD`, `TODO`, or vague "handle edge cases" steps remain.
- Type consistency: service methods, input record names, endpoint paths, and frontend helper names are defined before use.
