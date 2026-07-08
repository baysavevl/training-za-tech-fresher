import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  Bug,
  CheckCircle2,
  Copy,
  Database,
  FileJson,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Workflow
} from 'lucide-react'
import './styles.css'

const SAMPLE_WORKFLOW = {
  nodes: [
    { id: 'start', type: 'START', config: {} },
    { id: 'ask', type: 'QUESTION', config: { message: 'Ban can ho tro gi?' } },
    { id: 'lookup', type: 'ACTION', config: { action: 'ORDER_LOOKUP' } },
    { id: 'handoff', type: 'HANDOFF', config: { message: 'Minh se chuyen hoi thoai nay cho nhan vien ho tro.' } },
    { id: 'end', type: 'END', config: { message: 'Da xu ly xong' } }
  ],
  edges: [
    { from: 'start', to: 'ask', matchType: 'ALWAYS', matchValue: '' },
    { from: 'ask', to: 'lookup', matchType: 'KEYWORD', matchValue: 'don hang' },
    { from: 'ask', to: 'handoff', matchType: 'KEYWORD', matchValue: 'nhan vien' },
    { from: 'ask', to: 'end', matchType: 'FALLBACK', matchValue: '' },
    { from: 'lookup', to: 'end', matchType: 'ALWAYS', matchValue: '' }
  ]
}

const initialState = {
  automationName: 'Order support',
  automationId: '',
  workflowVersionId: '',
  userId: 'mock-user-001',
  messageId: 'msg-001',
  requestId: 'request-ui-001',
  text: 'toi muon xem don hang A123',
  conversationId: '',
  workflowJson: JSON.stringify(SAMPLE_WORKFLOW, null, 2)
}

const trainingTopics = [
  {
    id: 'pc',
    label: 'PC 01',
    title: 'Parallelism & Concurrency',
    focus: 'Thread, thread pool, lock, atomicity, idempotency, race condition.',
    concepts: ['Background thread', 'Blocking queue', 'Thread safety', 'Deadlock risk', 'CAS and atomic counter', 'Session update race'],
    projectMap: ['ConversationLockManager', 'message_idempotency', 'conversation_sessions.version', 'ConversationLockManagerTest'],
    exercise: 'Thiet ke optimistic locking cho session update bang WHERE id = ? AND version = ?.'
  },
  {
    id: 'rpc',
    label: 'CS RPC 01',
    title: 'Client/Server & RPC',
    focus: 'REST contract, RPC contract, stub/skeleton, serialization, service boundary.',
    concepts: ['Client/server responsibility', 'REST resource API', 'RPC internal call', 'protobuf schema', 'Compatibility', 'Timeout and failure boundary'],
    projectMap: ['AutomationController', 'MockChatController', 'intent_classifier.proto', 'IntentClassifierGrpcServiceTest'],
    exercise: 'Mo rong proto response voi reason code ma khong pha backward compatibility.'
  },
  {
    id: 'te',
    label: 'TE 01',
    title: 'Testing Engineering',
    focus: 'Test level, design for testability, dependency inversion, regression safety.',
    concepts: ['Unit test', 'Integration test', 'Smoke test', 'Regression test', 'Dependency injection', 'Pure domain logic'],
    projectMap: ['WorkflowExecutionEngineTest', 'WorkflowValidatorTest', 'MockChatFlowTest', 'ContextSmokeTest'],
    exercise: 'Them fallback branch moi va viet unit test truoc khi sua engine.'
  },
  {
    id: 'ob',
    label: 'OB 01',
    title: 'Observability',
    focus: 'Log, metrics, trace, correlation ID, debug API.',
    concepts: ['Structured log', 'request_id', 'message_id', 'conversation_id', 'execution trace', 'Actuator metrics'],
    projectMap: ['MockChatService log line', 'execution_traces', '/trace API', '/actuator/metrics'],
    exercise: 'Them actionName vao trace detail va verify qua debug panel.'
  }
]

const learningSessions = [
  ['01', 'Product, client/server, REST contract', 'Doc API contract, tao customer/conversation/message bang test va UI.'],
  ['02', 'Database design', 'Phan biet config table, runtime table, history table, trace table.'],
  ['03', 'Workflow JSON and publish validation', 'Node, edge, fallback, action, version, publish boundary.'],
  ['04', 'State machine execution engine', 'START -> QUESTION -> ACTION -> END va session current_node_id.'],
  ['05', 'Mock Chat Adapter', 'ChannelAdapter tach channel payload khoi engine.'],
  ['06', 'Idempotency', 'Replay duplicate message_id va giai thich response idempotent.'],
  ['07', 'Concurrency', 'Race condition khi nhieu message update cung conversation session.'],
  ['08', 'Reliability and action adapter', 'Retry/backoff/dead-letter la extension sau ACTION node.'],
  ['09', 'Observability', 'Structured log, trace table, history/session/trace debug panel.'],
  ['10', 'Testing and capstone', 'Build refund-support automation co test va review checklist.']
]

function App() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextPath) {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  if (path.startsWith('/ui')) {
    return <Dashboard navigate={navigate} />
  }

  if (path.startsWith('/training')) {
    return <TrainingPortal navigate={navigate} />
  }

  return <LandingPage navigate={navigate} />
}

function Dashboard({ navigate }) {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem('conversationAutomationUi')
    return saved ? { ...initialState, ...JSON.parse(saved) } : initialState
  })
  const [history, setHistory] = useState([])
  const [session, setSession] = useState(null)
  const [trace, setTrace] = useState([])
  const [lastResponse, setLastResponse] = useState(null)
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    localStorage.setItem('conversationAutomationUi', JSON.stringify(state))
  }, [state])

  const idsReady = useMemo(() => ({
    automation: Boolean(state.automationId),
    workflow: Boolean(state.workflowVersionId),
    conversation: Boolean(state.conversationId)
  }), [state.automationId, state.workflowVersionId, state.conversationId])

  function patch(values) {
    setState(current => ({ ...current, ...values }))
  }

  function addEvent(type, text) {
    setEvents(current => [
      { id: crypto.randomUUID(), at: new Date().toLocaleTimeString(), type, text },
      ...current
    ].slice(0, 8))
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    })
    const raw = await response.text()
    const body = raw ? JSON.parse(raw) : null
    if (!response.ok) {
      throw new Error(body?.message || `${response.status} ${response.statusText}`)
    }
    return body
  }

  async function run(label, work) {
    setBusy(true)
    try {
      const result = await work()
      addEvent('ok', label)
      return result
    } catch (error) {
      addEvent('error', error.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  async function createAutomation() {
    const result = await run('Automation created', () => request('/api/automations', {
      method: 'POST',
      body: JSON.stringify({ name: state.automationName })
    }))
    if (result) {
      patch({ automationId: result.id, workflowVersionId: '' })
      setLastResponse(result)
    }
  }

  async function createWorkflow() {
    const definition = JSON.parse(state.workflowJson)
    const result = await run('Workflow draft saved', () => request(`/api/automations/${state.automationId}/workflows`, {
      method: 'POST',
      body: JSON.stringify({ definition })
    }))
    if (result) {
      patch({ workflowVersionId: result.id })
      setLastResponse(result)
    }
  }

  async function publishWorkflow() {
    const result = await run('Workflow published', () => request(`/api/automations/${state.automationId}/workflows/${state.workflowVersionId}/publish`, {
      method: 'POST'
    }))
    if (result) {
      setLastResponse(result)
    }
  }

  async function sendMessage(duplicate = false) {
    const messageId = duplicate ? state.messageId : state.messageId.trim()
    const result = await run(duplicate ? 'Duplicate message replayed' : 'Message processed', () => request('/api/mock-chat/messages', {
      method: 'POST',
      headers: { 'X-Request-Id': duplicate ? `${state.requestId}-dup` : state.requestId },
      body: JSON.stringify({
        userId: state.userId,
        conversationId: state.conversationId || null,
        messageId,
        automationId: state.automationId,
        text: state.text
      })
    }))
    if (result) {
      patch({ conversationId: result.conversationId })
      setLastResponse(result)
      await refreshDebug(result.conversationId)
    }
  }

  async function refreshDebug(conversationId = state.conversationId) {
    if (!conversationId) {
      addEvent('error', 'conversationId is empty')
      return
    }
    await run('Debug data refreshed', async () => {
      const [historyResult, sessionResult, traceResult] = await Promise.all([
        request(`/api/mock-chat/conversations/${conversationId}/history`),
        request(`/api/mock-chat/conversations/${conversationId}/session`),
        request(`/api/mock-chat/conversations/${conversationId}/trace`)
      ])
      setHistory(historyResult.items || [])
      setSession(sessionResult)
      setTrace(traceResult.items || [])
      return traceResult
    })
  }

  function resetDemo() {
    setState(initialState)
    setHistory([])
    setSession(null)
    setTrace([])
    setLastResponse(null)
    setEvents([])
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Workflow size={24} aria-hidden="true" />
          <div>
            <h1>Automation Console</h1>
            <p>Local training runtime</p>
          </div>
        </div>

        <Status label="Automation" active={idsReady.automation} value={shortId(state.automationId)} />
        <Status label="Workflow" active={idsReady.workflow} value={shortId(state.workflowVersionId)} />
        <Status label="Conversation" active={idsReady.conversation} value={shortId(state.conversationId)} />

        <div className="side-actions">
          <button type="button" className="ghost" onClick={() => navigate('/')} disabled={busy}>
            <Workflow size={16} aria-hidden="true" /> Landing
          </button>
          <button type="button" className="ghost" onClick={() => refreshDebug()} disabled={!idsReady.conversation || busy}>
            <RefreshCw size={16} aria-hidden="true" /> Refresh debug
          </button>
          <button type="button" className="ghost danger" onClick={resetDemo} disabled={busy}>
            <RotateCcw size={16} aria-hidden="true" /> Reset local state
          </button>
        </div>

        <EventList events={events} />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">One source deploy</p>
            <h2>React UI + Java API</h2>
          </div>
          <div className="health-pill">
            <Activity size={16} aria-hidden="true" />
            Spring Boot static UI
          </div>
        </header>

        <div className="grid">
          <section className="panel setup-panel">
            <PanelTitle icon={<Database size={18} />} title="Workflow setup" />
            <div className="field-row">
              <label>
                Automation name
                <input value={state.automationName} onChange={event => patch({ automationName: event.target.value })} />
              </label>
              <button type="button" onClick={createAutomation} disabled={busy}>
                <Play size={16} aria-hidden="true" /> Create
              </button>
            </div>

            <label className="json-field">
              Workflow JSON
              <textarea value={state.workflowJson} onChange={event => patch({ workflowJson: event.target.value })} spellCheck="false" />
            </label>

            <div className="button-row">
              <button type="button" onClick={() => patch({ workflowJson: JSON.stringify(SAMPLE_WORKFLOW, null, 2) })} disabled={busy}>
                <FileJson size={16} aria-hidden="true" /> Load sample
              </button>
              <button type="button" onClick={createWorkflow} disabled={!idsReady.automation || busy}>
                <Copy size={16} aria-hidden="true" /> Save draft
              </button>
              <button type="button" className="primary" onClick={publishWorkflow} disabled={!idsReady.workflow || busy}>
                <CheckCircle2 size={16} aria-hidden="true" /> Publish
              </button>
            </div>
          </section>

          <section className="panel chat-panel">
            <PanelTitle icon={<MessageSquare size={18} />} title="Mock chat" />
            <div className="field-grid">
              <label>
                User ID
                <input value={state.userId} onChange={event => patch({ userId: event.target.value })} />
              </label>
              <label>
                Message ID
                <input value={state.messageId} onChange={event => patch({ messageId: event.target.value })} />
              </label>
              <label>
                Request ID
                <input value={state.requestId} onChange={event => patch({ requestId: event.target.value })} />
              </label>
            </div>
            <label>
              Message text
              <textarea className="message-box" value={state.text} onChange={event => patch({ text: event.target.value })} />
            </label>
            <div className="button-row">
              <button type="button" className="primary" onClick={() => sendMessage(false)} disabled={!idsReady.automation || busy}>
                <Send size={16} aria-hidden="true" /> Send
              </button>
              <button type="button" onClick={() => sendMessage(true)} disabled={!idsReady.conversation || busy}>
                <Copy size={16} aria-hidden="true" /> Replay duplicate
              </button>
            </div>
            <JsonBlock title="Last response" data={lastResponse} />
          </section>

          <section className="panel debug-panel">
            <PanelTitle icon={<Bug size={18} />} title="Debug trace" />
            <SessionView session={session} />
            <TraceView trace={trace} />
          </section>

          <section className="panel history-panel">
            <PanelTitle icon={<MessageSquare size={18} />} title="History" />
            <HistoryView history={history} />
          </section>
        </div>
      </section>
    </main>
  )
}

function LandingPage({ navigate }) {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <div className="brand compact">
          <Workflow size={24} aria-hidden="true" />
          <div>
            <h1>Conversation Automation</h1>
            <p>ZA fresher training workspace</p>
          </div>
        </div>
        <div className="nav-actions">
          <button type="button" onClick={() => navigate('/training')}>
            <FileJson size={16} aria-hidden="true" /> Training
          </button>
          <button type="button" className="primary" onClick={() => navigate('/ui')}>
            <Play size={16} aria-hidden="true" /> Demo console
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">Fresher backend mentoring project</p>
          <h2>Train API, workflow, state, concurrency, and observability through one running product.</h2>
          <p>
            One workspace contains the runnable Conversation Automation project and the ZA Fresher
            Training program built from PC, CS RPC, TE, and OB guidelines.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary" onClick={() => navigate('/ui')}>
              <Play size={16} aria-hidden="true" /> Open automation demo
            </button>
            <button type="button" onClick={() => navigate('/training')}>
              <FileJson size={16} aria-hidden="true" /> View training program
            </button>
            <a className="text-link" href="/actuator/health">Health endpoint</a>
          </div>
        </div>

        <div className="flow-board" aria-label="Runtime flow">
          <FlowNode label="Mock Chat" detail="Incoming message" icon={<MessageSquare size={18} />} />
          <FlowConnector />
          <FlowNode label="Workflow" detail="START to END graph" icon={<Workflow size={18} />} />
          <FlowConnector />
          <FlowNode label="Session" detail="State machine update" icon={<Database size={18} />} />
          <FlowConnector />
          <FlowNode label="Trace" detail="Debug every node" icon={<Bug size={18} />} />
        </div>
      </section>

      <section className="entry-grid">
        <article className="entry-card">
          <Activity size={20} aria-hidden="true" />
          <h3>Project Automation UI</h3>
          <p>Create workflow drafts, publish versions, send mock chat, replay duplicate messages, and inspect trace.</p>
          <button type="button" onClick={() => navigate('/ui')}>Open console</button>
        </article>
        <article className="entry-card">
          <FileJson size={20} aria-hidden="true" />
          <h3>ZA Fresher Training</h3>
          <p>Study route, topic explanations, project examples, exercises, and capstone checkpoints.</p>
          <button type="button" onClick={() => navigate('/training')}>Open training</button>
        </article>
        <article className="entry-card">
          <RefreshCw size={20} aria-hidden="true" />
          <h3>Single deploy artifact</h3>
          <p>React assets are packaged into the Spring Boot JAR with Maven profile <code>with-frontend</code>.</p>
          <button type="button" onClick={() => navigate('/training#sessions')}>View roadmap</button>
        </article>
      </section>
    </main>
  )
}

function FlowNode({ icon, label, detail }) {
  return (
    <div className="flow-node">
      {icon}
      <strong>{label}</strong>
      <span>{detail}</span>
    </div>
  )
}

function FlowConnector() {
  return <div className="flow-connector" aria-hidden="true" />
}

function TrainingPortal({ navigate }) {
  return (
    <main className="training-page">
      <nav className="landing-nav">
        <div className="brand compact">
          <FileJson size={24} aria-hidden="true" />
          <div>
            <h1>ZA Fresher Training</h1>
            <p>Backend foundation through one project</p>
          </div>
        </div>
        <div className="nav-actions">
          <button type="button" onClick={() => navigate('/')}>
            <Workflow size={16} aria-hidden="true" /> Landing
          </button>
          <button type="button" className="primary" onClick={() => navigate('/ui')}>
            <Play size={16} aria-hidden="true" /> Demo console
          </button>
        </div>
      </nav>

      <section className="training-hero">
        <p className="eyebrow">Lead engineer mentoring track</p>
        <h2>Tu kien thuc nen den cach thiet ke, debug va review mot backend workflow system.</h2>
        <p>
          Chuong trinh nay dung Conversation Automation System lam project trung tam. Moi topic
          deu co concept, dien giai, vi du trong source code, bai tap va checkpoint review.
        </p>
      </section>

      <section className="topic-grid" aria-label="Foundation topics">
        {trainingTopics.map(topic => (
          <article className="topic-card" key={topic.id} id={topic.id}>
            <span className="topic-label">{topic.label}</span>
            <h3>{topic.title}</h3>
            <p>{topic.focus}</p>
            <div className="topic-columns">
              <TopicList title="Concepts" items={topic.concepts} />
              <TopicList title="Project examples" items={topic.projectMap} />
            </div>
            <div className="exercise">
              <strong>Exercise</strong>
              <span>{topic.exercise}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="roadmap" id="sessions">
        <div className="section-heading">
          <p className="eyebrow">10 sessions x 90 minutes</p>
          <h3>Learning roadmap</h3>
        </div>
        <div className="session-list">
          {learningSessions.map(([number, title, detail]) => (
            <article className="session-item" key={number}>
              <span>{number}</span>
              <div>
                <h4>{title}</h4>
                <p>{detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="study-grid">
        <article>
          <h3>Mentor checklist</h3>
          <ul>
            <li>Bat dau bang product behavior va API contract.</li>
            <li>Hoi state nam o dau, ai update, duplicate message ra sao.</li>
            <li>Yeu cau test cho pure logic truoc khi dung framework.</li>
            <li>Review log field theo request/message/conversation/session/node.</li>
          </ul>
        </article>
        <article>
          <h3>Fresher self-study</h3>
          <ul>
            <li>Doc controller DTO de hieu request/response contract.</li>
            <li>Doc schema va ve lai relationship cua config/runtime/debug tables.</li>
            <li>Chay unit test engine, sau do thay workflow JSON de quan sat fallback.</li>
            <li>Replay duplicate message tren UI va kiem tra history khong tang.</li>
          </ul>
        </article>
        <article>
          <h3>Capstone</h3>
          <ul>
            <li>Build refund-support automation co QUESTION, CONDITION, ACTION, HANDOFF, END.</li>
            <li>Them validation cho unreachable node hoac duplicate fallback.</li>
            <li>Them it nhat mot unit test va mot integration test.</li>
            <li>Trinh bay trace debug cua flow chinh va flow fallback.</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

function TopicList({ title, items }) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}

function PanelTitle({ icon, title }) {
  return (
    <div className="panel-title">
      {icon}
      <h3>{title}</h3>
    </div>
  )
}

function Status({ label, active, value }) {
  return (
    <div className={`status-row ${active ? 'active' : ''}`}>
      <span>{label}</span>
      <strong>{active ? value : 'empty'}</strong>
    </div>
  )
}

function EventList({ events }) {
  return (
    <div className="events">
      <h3>Run log</h3>
      {events.length === 0 ? <p className="empty">No local events</p> : events.map(event => (
        <div className={`event ${event.type}`} key={event.id}>
          <span>{event.at}</span>
          <p>{event.text}</p>
        </div>
      ))}
    </div>
  )
}

function SessionView({ session }) {
  if (!session) {
    return <p className="empty">No session loaded</p>
  }
  return (
    <dl className="session-grid">
      <div><dt>Status</dt><dd>{session.status}</dd></div>
      <div><dt>Node</dt><dd>{session.currentNodeId}</dd></div>
      <div><dt>Version</dt><dd>{session.version}</dd></div>
      <div><dt>Session</dt><dd>{shortId(session.id)}</dd></div>
    </dl>
  )
}

function TraceView({ trace }) {
  if (!trace.length) {
    return <p className="empty">No trace rows</p>
  }
  return (
    <div className="trace-list">
      {trace.map(item => (
        <div className="trace-item" key={item.id}>
          <div>
            <strong>{item.eventType}</strong>
            <span>{item.nodeId}</span>
          </div>
          <code>{item.requestId} / {item.messageId}</code>
        </div>
      ))}
    </div>
  )
}

function HistoryView({ history }) {
  if (!history.length) {
    return <p className="empty">No messages loaded</p>
  }
  return (
    <div className="message-list">
      {history.map(message => (
        <article className={`message ${message.senderType.toLowerCase()}`} key={message.id}>
          <header>
            <strong>{message.senderType}</strong>
            <span>{shortId(message.id)}</span>
          </header>
          <p>{message.content}</p>
          <code>{message.traceId}</code>
        </article>
      ))}
    </div>
  )
}

function JsonBlock({ title, data }) {
  return (
    <div className="json-block">
      <h4>{title}</h4>
      <pre>{data ? JSON.stringify(data, null, 2) : 'null'}</pre>
    </div>
  )
}

function shortId(value) {
  if (!value) {
    return ''
  }
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

createRoot(document.getElementById('root')).render(<App />)
