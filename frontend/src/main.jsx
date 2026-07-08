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

function App() {
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
