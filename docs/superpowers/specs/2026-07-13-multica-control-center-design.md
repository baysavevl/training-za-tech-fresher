# Multica Control Center Design

## Context

This repository is a Java/Spring Boot and React/Vite training project for conversation automation. The user also has a local Multica self-host/dev instance configured separately, with a running Multica CLI and daemon that detect local coding-agent runtimes such as Codex, Claude Code, Cursor Agent, and OpenClaw.

The requested tool is a local control panel for managing and orchestrating those real Multica agents. It should not replace Multica. It should make the important operating concepts visible inside this training repo and provide a narrow, safe bridge for common Multica CLI workflows.

## Product Goal

Add a **Multica Control Center** page at `/agents`.

The page lets a developer:

- See whether the local Multica daemon is running.
- See available runtimes and which providers are online.
- List agents configured in the active workspace.
- List projects, repos, issues, and recent task runs.
- Create a project and attach a GitHub repo.
- Create an issue and assign it to an agent.
- Restart the daemon when the local runtime is stale.
- Inspect command results and failures without switching to a terminal.

This is local developer tooling. It is not a production multi-user admin surface.

## Core Concepts

The UI should explicitly teach these concepts:

- **Workspace**: isolated Multica scope containing agents, issues, projects, resources, and runtimes.
- **Daemon**: local background process that connects a machine to Multica and polls for work.
- **Runtime**: one daemon plus one available AI coding tool, such as Codex on this MacBook.
- **Agent**: named teammate configuration bound to a runtime, with instructions, model, environment, and visibility.
- **Project**: container for related issues and resources.
- **Resource**: repository or local directory attached to a project so agents know where to work.
- **Issue**: unit of work assigned to a member, agent, or squad.
- **Task/run**: actual execution created after assignment, mention, chat, or automation trigger.
- **Queue**: work waiting for an available runtime or agent concurrency slot.
- **Skill**: reusable knowledge pack injected into agent execution.
- **Orchestration**: routing work to agents, tracking execution state, recovering failures, and coordinating handoffs.

## Architecture

Use the existing application shape:

```text
React / Vite page
  -> Spring Boot REST controller
  -> Multica CLI bridge service
  -> local `multica` executable
  -> local/self-host Multica server and daemon
```

The browser must never execute shell commands directly. The Spring Boot backend owns all interaction with the CLI.

## Backend Scope

Add a Spring Boot controller under `/api/multica`.

Initial endpoints:

```text
GET  /api/multica/status
GET  /api/multica/runtimes
GET  /api/multica/agents
POST /api/multica/agents
GET  /api/multica/projects
POST /api/multica/projects
POST /api/multica/repos
GET  /api/multica/issues
POST /api/multica/issues
POST /api/multica/issues/{id}/assign
POST /api/multica/daemon/restart
GET  /api/multica/commands
```

The backend should expose structured responses, even when the CLI command fails:

```json
{
  "ok": false,
  "command": "multica issue list --output json",
  "exitCode": 1,
  "durationMs": 412,
  "stdout": "",
  "stderr": "not authenticated",
  "message": "Multica CLI command failed"
}
```

Commands that support JSON should be called with `--output json` and parsed into typed response records where practical. Commands without JSON output can return normalized text plus status metadata.

## CLI Bridge Safety

The bridge must be allowlisted. The frontend can request actions, not arbitrary commands.

Rules:

- Use `ProcessBuilder` with argument arrays, not shell strings.
- Keep an explicit command enum or command builder for each supported operation.
- Validate request fields before building commands.
- Apply a timeout to every command.
- Do not expose environment variables, auth tokens, or local config file contents.
- Redact token-like values from stdout/stderr before returning them.
- Keep a small in-memory command log with command kind, duration, status, and redacted output.
- Do not support arbitrary `multica` passthrough in the first version.

## Frontend Scope

Add routing for `/agents` in `frontend/src/main.jsx` and Spring forwarding in `UiForwardController`.

The page should be a dense developer dashboard, not a marketing page.

Sections:

- **Status band**: backend URL, app URL, daemon status, active workspace.
- **Runtimes**: provider, status, runtime name, daemon id, last seen.
- **Agents**: name, provider/runtime, visibility, archived state, actions.
- **Projects & repos**: project list, create project form, add repo form.
- **Issues**: create issue form, assign issue to agent, status list.
- **Command log**: recent operations with success/failure, duration, and redacted output.
- **Concept guide**: compact glossary of workspace, daemon, runtime, agent, project, issue, task, queue, skill, orchestration.

The UI should reuse the existing design language: light dashboard, compact panels, 8px radius, lucide icons, and restrained color.

## Data Flow

Read-only refresh:

```text
Page load
  -> GET /api/multica/status
  -> GET /api/multica/runtimes
  -> GET /api/multica/agents
  -> GET /api/multica/projects
  -> GET /api/multica/issues
  -> render dashboard
```

Create-and-assign workflow:

```text
Developer creates project with repo
  -> POST /api/multica/projects
  -> backend runs `multica project create --title ... --repo ... --output json`
  -> UI refreshes projects

Developer creates issue
  -> POST /api/multica/issues
  -> backend runs `multica issue create ... --output json`
  -> UI refreshes issues

Developer assigns issue to agent
  -> POST /api/multica/issues/{id}/assign
  -> backend runs `multica issue assign <id> --to-id <agentId>`
  -> daemon picks up generated task
```

## Error Handling

The UI should distinguish:

- Multica server not reachable.
- CLI not installed.
- CLI not authenticated.
- Daemon stopped.
- Runtime offline.
- Validation error in user input.
- Command timeout.
- Command failed with non-zero exit.

Each error should show a short action hint, for example:

- "Run `multica setup self-host --port 18080 --frontend-port 13000`."
- "Run `multica daemon start`."
- "Start Docker and the Multica dev server."

## Testing

Backend tests:

- Command builder produces expected argument arrays.
- Command builder rejects invalid URLs, IDs, and blank titles.
- CLI runner handles success, non-zero exit, timeout, and missing executable.
- Controller returns stable JSON for validation errors.

Frontend tests:

- Map status, runtime, agent, project, and issue responses into display models.
- Validate create issue/project form state.
- Render error states for offline daemon and failed commands.

Manual verification:

- Start local Multica.
- Open `/agents`.
- Confirm daemon/runtimes display.
- Create a test project with a repo.
- Create a test issue.
- Assign it to a local agent.
- Confirm command log and daemon status update.

## Out of Scope

- Production authentication and authorization for the control center.
- Editing high-value secrets or agent environment variables.
- Arbitrary CLI command execution.
- Direct browser access to Multica tokens.
- Full GitHub App setup automation.
- Running coding agents without Multica.
- Multi-tenant company-wide deployment.

## Company Use Guidance

This tool can help evaluate Multica against company projects, but the first version should stay local.

Before using it with company repositories:

- Run Multica behind VPN or inside a trusted network.
- Use real authentication instead of a fixed dev verification code.
- Use least-privilege credentials for agents.
- Avoid storing high-value production secrets in agent custom env.
- Prefer test repos first.
- Commit or stash local changes before assigning tasks to agents against a local directory.
- Add Multica-generated files such as `.multica/`, `AGENTS.md`, and `CLAUDE.md` to project ignore rules when appropriate.

## Success Criteria

The first version is successful when a developer can open `/agents`, understand the active Multica setup, create a project, create an issue, assign it to a real local agent, and see enough status and command output to debug the path without leaving the training app.
