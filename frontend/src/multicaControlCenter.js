import { withJsonHeaders } from './apiClient.js'

export const MULTICA_CONTROL_HEADER = 'X-Multica-Control'
export const MULTICA_CONTROL_HEADER_VALUE = 'local-ui'

export const concepts = [
  {
    term: 'Workspace',
    detail: 'Isolated Multica scope containing agents, projects, issues, resources, and runtimes.'
  },
  {
    term: 'Daemon',
    detail: 'Local background process that connects this machine to Multica and polls for work.'
  },
  {
    term: 'Runtime',
    detail: 'One daemon plus one available AI coding tool, such as Codex on this MacBook.'
  },
  {
    term: 'Agent',
    detail: 'Named teammate configuration bound to a runtime, with instructions and visibility.'
  },
  {
    term: 'Project',
    detail: 'Container for related issues and resources.'
  },
  {
    term: 'Resource',
    detail: 'Repo or local directory attached to a project so agents know where to work.'
  },
  {
    term: 'Issue',
    detail: 'Unit of work assigned to a member, agent, or squad.'
  },
  {
    term: 'Task / run',
    detail: 'Actual execution created after assignment, mention, chat, or automation trigger.'
  },
  {
    term: 'Queue',
    detail: 'Work waiting for an available runtime or agent concurrency slot.'
  },
  {
    term: 'Skill',
    detail: 'Reusable knowledge pack injected into agent execution.'
  },
  {
    term: 'Orchestration',
    detail: 'Routing work to agents, tracking execution state, recovering failures, and coordinating handoffs.'
  }
]

export const agentFormDefaults = {
  name: '',
  runtimeId: '',
  description: '',
  instructions: '',
  visibility: 'private'
}

export const projectFormDefaults = {
  title: '',
  description: '',
  repoUrl: ''
}

export const repoFormDefaults = {
  url: '',
  description: ''
}

export const issueFormDefaults = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  projectId: '',
  assigneeId: ''
}

export const assignFormDefaults = {
  issueId: '',
  assigneeId: ''
}

export function createEmptyControlCenterState() {
  return {
    status: null,
    runtimes: [],
    agents: [],
    projects: [],
    repos: [],
    issues: [],
    commands: [],
    error: '',
    loading: false
  }
}

export function commandData(result, collectionKey) {
  if (!result?.data) {
    return []
  }
  if (Array.isArray(result.data)) {
    return result.data
  }
  if (collectionKey && Array.isArray(result.data[collectionKey])) {
    return result.data[collectionKey]
  }
  return []
}

export function displayRuntime(runtime = {}) {
  const provider = runtime.provider || 'unknown'
  const status = runtime.status || 'unknown'
  return {
    id: runtime.id || '',
    provider,
    providerLabel: titleCase(provider),
    status,
    statusLabel: titleCase(status),
    name: runtime.name || `${titleCase(provider)} runtime`,
    daemonId: runtime.daemon_id || runtime.daemonId || '',
    lastSeenAt: runtime.last_seen_at || runtime.lastSeenAt || ''
  }
}

export function displayAgent(agent = {}) {
  const name = agent.name || 'Unnamed agent'
  return {
    id: agent.id || '',
    name,
    description: agent.description || '',
    runtimeId: agent.runtime_id || agent.runtimeId || '',
    provider: agent.provider || agent.runtime_provider || '',
    visibility: agent.visibility || agent.permission_mode || 'private',
    archived: Boolean(agent.archived || agent.archived_at)
  }
}

export function displayProject(project = {}) {
  return {
    id: project.id || '',
    title: project.title || project.name || 'Untitled project',
    status: project.status || '',
    description: project.description || ''
  }
}

export function displayRepo(repo = {}) {
  return {
    id: repo.id || repo.url || '',
    url: repo.url || repo.repository_url || '',
    description: repo.description || ''
  }
}

export function displayIssue(issue = {}) {
  return {
    id: issue.id || issue.identifier || '',
    title: issue.title || 'Untitled issue',
    status: issue.status || '',
    priority: issue.priority || '',
    assignee: issue.assignee_name || issue.assignee || '',
    projectId: issue.project_id || issue.projectId || ''
  }
}

export function validateAgentForm(form) {
  const errors = []
  if (!form.name?.trim()) {
    errors.push('Agent name is required.')
  }
  if (!form.runtimeId?.trim()) {
    errors.push('Choose an online runtime.')
  }
  if (!['private', 'workspace'].includes(form.visibility)) {
    errors.push('Visibility must be private or workspace.')
  }
  return errors
}

export function validateProjectForm(form) {
  const errors = []
  if (!form.title?.trim()) {
    errors.push('Project title is required.')
  }
  if (form.repoUrl?.trim() && !isRepoUrl(form.repoUrl)) {
    errors.push('Repo URL must be http(s), ssh, git, or git@ style.')
  }
  return errors
}

export function validateRepoForm(form) {
  if (!form.url?.trim()) {
    return ['Repo URL is required.']
  }
  return isRepoUrl(form.url) ? [] : ['Repo URL must be http(s), ssh, git, or git@ style.']
}

export function validateIssueForm(form) {
  const errors = []
  if (!form.title?.trim()) {
    errors.push('Issue title is required.')
  }
  if (form.status && !['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'].includes(form.status)) {
    errors.push('Issue status is not supported.')
  }
  return errors
}

export function validateAssignForm(form) {
  const errors = []
  if (!form.issueId?.trim()) {
    errors.push('Issue id is required.')
  }
  if (!form.assigneeId?.trim()) {
    errors.push('Choose an agent.')
  }
  return errors
}

export async function controlCenterRequest(path, options = {}) {
  const target = path.startsWith('/api/') ? path : `/api/multica${path}`
  const response = await fetch(target, withJsonHeaders({
    ...options,
    headers: {
      ...(options.headers || {}),
      [MULTICA_CONTROL_HEADER]: MULTICA_CONTROL_HEADER_VALUE
    }
  }))
  const raw = await response.text()
  const body = raw ? JSON.parse(raw) : null
  if (!response.ok || body?.ok === false) {
    const error = new Error(body?.message || `${response.status} ${response.statusText}`)
    error.body = body
    throw error
  }
  return body
}

function isRepoUrl(value) {
  const candidate = value.trim()
  if (candidate.startsWith('git@')) {
    return /^[^@\s]+@[^:\s]+:[^\s]+$/.test(candidate)
  }
  try {
    const url = new URL(candidate)
    return ['http:', 'https:', 'ssh:', 'git:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

function titleCase(value) {
  return String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'Unknown'
}
