import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  Bug,
  CheckCircle2,
  Copy,
  Database,
  FileJson,
  FileText,
  MessageSquare,
  Plus,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Workflow,
  X
} from 'lucide-react'
import { readTrainingSource, requestJson } from './apiClient.js'
import {
  DEMO_STATE_VERSION,
  SAMPLE_WORKFLOW,
  advanceManualMessageFields,
  createAutoDemoMessageFields,
  createManualMessageFields,
  createAutoDemoScript,
  createFriendlyDemoGuide,
  createJourneyGuide,
  createProjectFlowLanes,
  duplicateReplayFields,
  hydrateDemoState,
  initialDemoState,
  normalizeHistoryItems,
  summarizeHistory,
  updateOperationResponses
} from './demoState.js'
import { shouldUseStaticDemoBackend } from './staticDemoBackend.js'
import {
  knowledgeSelectionForTopic,
  sessionDetailPath,
  sessionFromPath,
  topicDetailPath,
  topicFromPath
} from './trainingNavigation.js'
import { sourceReferencesFor } from './trainingSources.js'
import { learningSessions, projectBrief, studyCards, trainingTopics } from './trainingContent.js'
import './styles.css'

const CONSOLE_VIEW_STORAGE_KEY = 'automationConsoleViewV2'

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
    if (path.startsWith('/training/topic/')) {
      return <TopicDetailPage topic={topicFromPath(path)} navigate={navigate} />
    }
    if (path.startsWith('/training/session/')) {
      return <SessionDetailPage session={sessionFromPath(path)} navigate={navigate} />
    }
    return <TrainingPortal navigate={navigate} />
  }

  return <LandingPage navigate={navigate} />
}

function Dashboard({ navigate }) {
  const isStaticDemoRuntime = shouldUseStaticDemoBackend(window.location.hostname, import.meta.env)
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem('conversationAutomationUi')
    return hydrateDemoState(saved)
  })
  const [history, setHistory] = useState([])
  const [session, setSession] = useState(null)
  const [trace, setTrace] = useState([])
  const [responses, setResponses] = useState({ chat: null, workflow: null })
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(CONSOLE_VIEW_STORAGE_KEY) || 'journey')

  useEffect(() => {
    localStorage.setItem('conversationAutomationUi', JSON.stringify({ ...state, _version: DEMO_STATE_VERSION }))
  }, [state])

  useEffect(() => {
    localStorage.setItem(CONSOLE_VIEW_STORAGE_KEY, viewMode)
  }, [viewMode])

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
    return requestJson(path, options)
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
      setResponses(current => updateOperationResponses(current, 'workflow', result))
    }
    return result
  }

  async function createWorkflow() {
    const definition = JSON.parse(state.workflowJson)
    const result = await run('Workflow draft saved', () => request(`/api/automations/${state.automationId}/workflows`, {
      method: 'POST',
      body: JSON.stringify({ definition })
    }))
    if (result) {
      patch({ workflowVersionId: result.id })
      setResponses(current => updateOperationResponses(current, 'workflow', result))
    }
    return result
  }

  async function publishWorkflow() {
    const result = await run('Workflow published', () => request(`/api/automations/${state.automationId}/workflows/${state.workflowVersionId}/publish`, {
      method: 'POST'
    }))
    if (result) {
      setResponses(current => updateOperationResponses(current, 'workflow', result))
    }
    return result
  }

  async function sendMessage(duplicate = false) {
    const duplicateFields = duplicate ? duplicateReplayFields(state) : null
    const fallbackFields = createManualMessageFields(state.manualSequence || 1)
    const messageId = duplicate ? duplicateFields.messageId : (state.messageId.trim() || fallbackFields.messageId)
    const requestId = duplicate ? duplicateFields.requestId : (state.requestId.trim() || fallbackFields.requestId)
    const result = await run(duplicate ? 'Duplicate message replayed' : 'Message processed', () => request('/api/mock-chat/messages', {
      method: 'POST',
      headers: { 'X-Request-Id': requestId },
      body: JSON.stringify({
        userId: state.userId,
        conversationId: state.conversationId || null,
        messageId,
        automationId: state.automationId,
        text: state.text
      })
    }))
    if (result) {
      patch({
        conversationId: result.conversationId,
        ...(!duplicate && !result.duplicate
          ? advanceManualMessageFields(state, { sentMessageId: messageId, sentRequestId: requestId })
          : {})
      })
      setResponses(current => updateOperationResponses(current, 'chat', result))
      await refreshDebug(result.conversationId)
    }
    return result
  }

  async function quickSetup(sendAfterPublish = false) {
    const result = await run(sendAfterPublish ? 'Auto demo completed' : 'Sample workflow published', async () => {
      const definition = JSON.parse(state.workflowJson)
      const autoDemoScript = sendAfterPublish ? createAutoDemoScript() : []
      const automation = state.automationId
        ? { id: state.automationId }
        : await request('/api/automations', {
          method: 'POST',
          body: JSON.stringify({ name: state.automationName })
        })
      const workflow = await request(`/api/automations/${automation.id}/workflows`, {
        method: 'POST',
        body: JSON.stringify({ definition })
      })
      const published = await request(`/api/automations/${automation.id}/workflows/${workflow.id}/publish`, {
        method: 'POST'
      })
      if (!sendAfterPublish) {
        return { automation, workflow, published }
      }
      let conversationId = null
      let message = null
      for (const step of autoDemoScript) {
        message = await request('/api/mock-chat/messages', {
          method: 'POST',
          headers: { 'X-Request-Id': step.requestId },
          body: JSON.stringify({
            userId: state.userId,
            conversationId,
            messageId: step.messageId,
            automationId: automation.id,
            text: step.text
          })
        })
        conversationId = message.conversationId
      }
      return { automation, workflow, published, message, autoDemoScript }
    })

    if (result) {
      const lastStep = result.autoDemoScript?.at(-1)
      patch({
        automationId: result.automation.id,
        workflowVersionId: result.workflow.id,
        ...(lastStep ? {
          messageId: lastStep.messageId,
          requestId: lastStep.requestId,
          lastSentMessageId: lastStep.messageId,
          lastSentRequestId: lastStep.requestId,
          text: lastStep.text
        } : {}),
        conversationId: result.message?.conversationId || state.conversationId
      })
      setResponses(current => {
        const withWorkflow = updateOperationResponses(current, 'workflow', result.published)
        return result.message
          ? updateOperationResponses(withWorkflow, 'chat', result.message)
          : withWorkflow
      })
      if (result.message?.conversationId) {
        await refreshDebug(result.message.conversationId)
      }
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

  useEffect(() => {
    if (!state.conversationId || history.length || session || trace.length || events.length) {
      return
    }
    refreshDebug(state.conversationId)
  }, [state.conversationId])

  function resetDemo() {
    setState(initialDemoState)
    setHistory([])
    setSession(null)
    setTrace([])
    setResponses({ chat: null, workflow: null })
    setEvents([])
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Workflow size={24} aria-hidden="true" />
          <div>
            <h1>Automation Console</h1>
            <p>{isStaticDemoRuntime ? 'Vercel static demo runtime' : 'Local Java training runtime'}</p>
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
            <h2>{isStaticDemoRuntime ? 'React UI + browser demo backend' : 'React UI + Java API'}</h2>
          </div>
          <div className="topbar-actions">
            <div className="view-switch" role="tablist" aria-label="Console view">
              <button type="button" className={viewMode === 'journey' ? 'active' : ''} onClick={() => setViewMode('journey')} aria-selected={viewMode === 'journey'}>
                <Play size={15} aria-hidden="true" /> Start here
              </button>
              <button type="button" className={viewMode === 'simple' ? 'active' : ''} onClick={() => setViewMode('simple')} aria-selected={viewMode === 'simple'}>
                <MessageSquare size={15} aria-hidden="true" /> Simple view
              </button>
              <button type="button" className={viewMode === 'technical' ? 'active' : ''} onClick={() => setViewMode('technical')} aria-selected={viewMode === 'technical'}>
                <Bug size={15} aria-hidden="true" /> Technical view
              </button>
            </div>
            <div className="health-pill">
              <Activity size={16} aria-hidden="true" />
              {isStaticDemoRuntime ? 'Vercel static demo' : 'Spring Boot Java API'}
            </div>
          </div>
        </header>

        {viewMode === 'journey' ? (
          <JourneyGuide
            busy={busy}
            history={history}
            idsReady={idsReady}
            onRunDemo={() => quickSetup(true)}
            onShowSimple={() => setViewMode('simple')}
            onShowTechnical={() => setViewMode('technical')}
            responses={responses}
            session={session}
            trace={trace}
          />
        ) : viewMode === 'simple' ? (
          <FriendlyConsole
            busy={busy}
            history={history}
            idsReady={idsReady}
            onPrepare={() => quickSetup(false)}
            onRunDemo={() => quickSetup(true)}
            onShowTechnical={() => setViewMode('technical')}
            responses={responses}
            session={session}
            trace={trace}
          />
        ) : (
          <>
        <section className="run-card">
          <div className="run-summary">
            <p className="eyebrow">Guided demo</p>
            <h3>Auto demo runs the full product flow.</h3>
            <p>
              Click Run auto demo once. It creates the automation, publishes the sample workflow,
              sends a five-message conversation, categorizes the follow-up need, then refreshes history, trace, and session state.
              {isStaticDemoRuntime
                ? ' On Vercel the same API contract is simulated in the browser so the training demo can run without a Java server.'
                : ' Local mode calls the Spring Boot API directly.'}
              {' '}
              Manual controls below are only for teaching each API call separately.
            </p>
          </div>
          <div className="run-actions">
            <button type="button" onClick={() => quickSetup(false)} disabled={busy}>
              <CheckCircle2 size={16} aria-hidden="true" /> Prepare only
            </button>
            <button type="button" className="primary" onClick={() => quickSetup(true)} disabled={busy}>
              <Send size={16} aria-hidden="true" /> Run auto demo
            </button>
          </div>
          <DemoProgress idsReady={idsReady} debugReady={history.length > 0 || trace.length > 0} />
          <ProjectFlowMap />
          <AutomationConceptMap />
        </section>

        <div className="grid">
          <section className="panel chat-panel">
            <PanelTitle icon={<MessageSquare size={18} />} title="Mock chat" />
            <ConversationState chatResponse={responses.chat} idsReady={idsReady} />
            <div className="field-grid">
              <label>
                User ID
                <input value={state.userId} onChange={event => patch({ userId: event.target.value })} />
              </label>
              <label>
                Next message ID
                <input value={state.messageId} onChange={event => patch({ messageId: event.target.value })} />
              </label>
              <label>
                Next request ID
                <input value={state.requestId} onChange={event => patch({ requestId: event.target.value })} />
              </label>
            </div>
            <label>
              Message text
              <textarea className="message-box" value={state.text} onChange={event => patch({ text: event.target.value })} />
            </label>
            <div className="button-row">
              <button type="button" className="primary" onClick={() => sendMessage(false)} disabled={!idsReady.automation || !idsReady.workflow || busy}>
                <Send size={16} aria-hidden="true" /> Send
              </button>
              <button type="button" onClick={() => sendMessage(true)} disabled={!idsReady.conversation || busy}>
                <Copy size={16} aria-hidden="true" /> Replay duplicate
              </button>
            </div>
            <p className="button-note">
              {!idsReady.automation
                ? 'Send is locked until an automation exists. Use Run auto demo for the fastest path.'
                : !idsReady.workflow
                  ? 'Publish the workflow before sending a message.'
                  : 'Send uses the visible next message ID and prepares a new one after success. Replay duplicate reuses the last sent message ID to prove idempotency.'}
            </p>
            <JsonBlock title="Last chat response" data={responses.chat} />
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

          <details className="panel setup-panel advanced-panel">
            <summary>
              <span className="summary-icon"><Database size={18} aria-hidden="true" /></span>
              <span>
                <strong>Advanced workflow controls</strong>
                <small>Create, save, and publish the workflow one API call at a time.</small>
              </span>
            </summary>
            <div className="advanced-content">
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
              <p className="button-note">
                {!idsReady.automation
                  ? 'Save draft is locked until an automation exists. Use Create or Prepare only.'
                  : !idsReady.workflow
                    ? 'Publish is locked until the workflow draft is saved.'
                    : 'Workflow draft is ready to publish.'}
              </p>
              <JsonBlock title="Last workflow operation" data={responses.workflow} />
            </div>
          </details>
        </div>
          </>
        )}
      </section>
    </main>
  )
}

function JourneyGuide({ busy, history, idsReady, onRunDemo, onShowSimple, onShowTechnical, responses, session, trace }) {
  const guide = createJourneyGuide(123456)
  const rows = normalizeHistoryItems(history)
  const summary = summarizeHistory(history)
  const hasTranscript = rows.length > 0
  const latestBotReply = responses.chat?.response || [...rows].reverse().find(row => row.senderType === 'BOT')?.content || ''
  const traceText = JSON.stringify(trace)
  const outcomeState = {
    'Order checked': /ORDER_STATUS/.test(traceText) || rows.some(row => /A123|PACKING|SHIPPING/i.test(row.content)),
    'Status updated': /ORDER_STATUS_UPDATE/.test(traceText) || rows.some(row => /SHIPPING/i.test(row.content)),
    'Ticket created': /TICKET_CREATION/.test(traceText) || session?.currentNodeId === 'end',
    'Retry safe': Boolean(responses.chat?.duplicate) || hasTranscript
  }
  const statusItems = [
    {
      label: 'Bot prepared',
      active: idsReady.automation,
      detail: idsReady.automation ? 'Ready to answer customers' : 'Created when the demo starts'
    },
    {
      label: 'Rules loaded',
      active: idsReady.workflow,
      detail: idsReady.workflow ? 'Order support path is published' : 'Published automatically'
    },
    {
      label: 'Demo chat',
      active: idsReady.conversation,
      detail: idsReady.conversation ? `${summary.total || 1} saved messages` : 'No conversation yet'
    },
    {
      label: 'Outcome',
      active: session?.status === 'COMPLETED' || session?.currentNodeId === 'end',
      detail: session?.status === 'COMPLETED' ? 'Support case finished' : 'Waiting for demo run'
    }
  ]
  const scrollToChecklist = () => {
    document.getElementById('journey-integration-checklist')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const pathActions = {
    'Run the demo': onRunDemo,
    'Open Technical view': onShowTechnical,
    'Use the checklist': scrollToChecklist
  }

  return (
    <div className="journey-guide">
      <section className="journey-hero">
        <div className="journey-hero-copy">
          <p className="eyebrow">New user journey</p>
          <h3>{guide.title}</h3>
          <p>{guide.subtitle}</p>
          <strong>{guide.promise}</strong>
          <div className="journey-actions">
            <button type="button" className="primary" onClick={onRunDemo} disabled={busy}>
              <Send size={16} aria-hidden="true" /> Run the demo
            </button>
            <button type="button" onClick={onShowSimple}>
              <MessageSquare size={16} aria-hidden="true" /> Simple view
            </button>
            <button type="button" onClick={onShowTechnical}>
              <Bug size={16} aria-hidden="true" /> Technical view
            </button>
          </div>
        </div>

        <div className="journey-progress" aria-label="Current demo progress">
          {statusItems.map(item => (
            <div className={item.active ? 'ready' : ''} key={item.label}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{item.label}</span>
              <strong>{item.detail}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="journey-steps" aria-label="Project journey steps">
        {guide.steps.map((step, index) => (
          <article key={step.title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h4>{step.title}</h4>
              <p>{step.goal}</p>
              <strong>{step.action}</strong>
              <small>{step.result}</small>
            </div>
          </article>
        ))}
      </section>

      <div className="journey-main">
        <section className="journey-result-panel">
          <header>
            <div>
              <p className="eyebrow">After you run it</p>
              <h4>{hasTranscript ? 'What the demo produced' : 'What you should expect'}</h4>
            </div>
            <span>{hasTranscript ? `${summary.customer} customer turns` : 'Not run yet'}</span>
          </header>
          <div className="journey-outcomes">
            {Object.entries(outcomeState).map(([label, active]) => (
              <div className={active ? 'ready' : ''} key={label}>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="journey-latest-reply">
            <strong>Latest bot reply</strong>
            <p>{latestBotReply || 'Run the demo to create the first customer result.'}</p>
          </div>
        </section>

        <section className="journey-script-panel">
          <header>
            <p className="eyebrow">Demo conversation</p>
            <h4>The app sends these customer messages</h4>
          </header>
          <ol>
            {guide.demoInputs.map((input, index) => (
              <li key={`${input}-${index}`}>
                <span>{index + 1}</span>
                <strong>{input}</strong>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="journey-path-panel">
        <header>
          <p className="eyebrow">Choose your path</p>
          <h4>Use the same project for demo, learning, or integration</h4>
        </header>
        <div className="journey-paths">
          {guide.paths.map(path => (
            <article key={path.label}>
              <Workflow size={18} aria-hidden="true" />
              <h5>{path.label}</h5>
              <p>{path.detail}</p>
              <button type="button" onClick={pathActions[path.action] || undefined} disabled={busy && path.action === 'Run the demo'}>
                {path.action}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="journey-integration-panel" id="journey-integration-checklist">
        <header>
          <p className="eyebrow">Company integration checklist</p>
          <h4>What to replace when this becomes a real company project</h4>
        </header>
        <div className="journey-checklist">
          {guide.integrationChecklist.map(item => (
            <article key={item.area}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <h5>{item.area}</h5>
                <p>{item.change}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function FriendlyConsole({ busy, history, idsReady, onPrepare, onRunDemo, onShowTechnical, responses, session, trace }) {
  const guide = createFriendlyDemoGuide(123456)
  const rows = normalizeHistoryItems(history)
  const summary = summarizeHistory(history)
  const hasTranscript = rows.length > 0
  const latestBotReply = responses.chat?.response || [...rows].reverse().find(row => row.senderType === 'BOT')?.content || ''
  const traceText = JSON.stringify(trace)
  const outcomeState = {
    'Order checked': /ORDER_STATUS/.test(traceText) || rows.some(row => /A123|PACKING|SHIPPING/i.test(row.content)),
    'Status updated': /ORDER_STATUS_UPDATE/.test(traceText) || rows.some(row => /SHIPPING/i.test(row.content)),
    'Ticket created': /TICKET_CREATION/.test(traceText) || session?.currentNodeId === 'end',
    'Duplicate safe': Boolean(responses.chat?.duplicate)
  }

  return (
    <div className="friendly-console">
      <section className="friendly-hero">
        <div>
          <p className="eyebrow">Simple view</p>
          <h3>{guide.title}</h3>
          <p>{guide.subtitle}</p>
          <div className="friendly-actions">
            <button type="button" className="primary" onClick={onRunDemo} disabled={busy}>
              <Send size={16} aria-hidden="true" /> Run the demo
            </button>
            <button type="button" onClick={onPrepare} disabled={busy}>
              <CheckCircle2 size={16} aria-hidden="true" /> Prepare bot only
            </button>
            <button type="button" className="ghost" onClick={onShowTechnical}>
              <Bug size={16} aria-hidden="true" /> Technical view
            </button>
          </div>
        </div>
        <div className="friendly-status-board" aria-label="Demo status">
          <FriendlyStatus label="Bot" active={idsReady.automation} readyText="Ready" waitingText="Not prepared" />
          <FriendlyStatus label="Rules" active={idsReady.workflow} readyText="Published" waitingText="Waiting" />
          <FriendlyStatus label="Chat" active={idsReady.conversation} readyText="Started" waitingText="No chat yet" />
          <FriendlyStatus label="Result" active={hasTranscript} readyText={`${summary.total} messages`} waitingText="Run demo" />
        </div>
      </section>

      <section className="friendly-step-strip" aria-label="Friendly demo steps">
        {guide.steps.map((step, index) => (
          <article key={step.title}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="friendly-layout">
        <section className="friendly-section friendly-conversation">
          <header>
            <div>
              <p className="eyebrow">Customer story</p>
              <h4>{hasTranscript ? 'What happened in the chat' : 'What the demo will send'}</h4>
            </div>
            <span>{hasTranscript ? `${summary.customer} customer turns` : 'Preview'}</span>
          </header>
          {hasTranscript ? <FriendlyTranscript rows={rows} /> : <FriendlySampleChat turns={guide.sampleChat} />}
        </section>

        <section className="friendly-section friendly-result">
          <header>
            <div>
              <p className="eyebrow">Result</p>
              <h4>{session?.status === 'COMPLETED' ? 'The support case is finished' : 'Run the demo to see the result'}</h4>
            </div>
            <span>{session?.status || 'Waiting'}</span>
          </header>
          <div className="friendly-outcomes">
            {guide.outcomes.map(outcome => (
              <div className={outcomeState[outcome.label] ? 'ready' : ''} key={outcome.label}>
                <CheckCircle2 size={16} aria-hidden="true" />
                <div>
                  <strong>{outcome.label}</strong>
                  <small>{outcome.value}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="friendly-latest-reply">
            <strong>Latest bot reply</strong>
            <p>{latestBotReply || 'No reply yet. Run the demo to create the first support case.'}</p>
          </div>
        </section>
      </div>

      <section className="friendly-section friendly-explainer">
        <header>
          <div>
            <p className="eyebrow">Plain English</p>
            <h4>What the screen means</h4>
          </div>
          <button type="button" onClick={onShowTechnical}>
            <Bug size={16} aria-hidden="true" /> See technical details
          </button>
        </header>
        <dl>
          {guide.explainers.map(item => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

function FriendlyStatus({ active, label, readyText, waitingText }) {
  return (
    <div className={active ? 'ready' : ''}>
      <CheckCircle2 size={16} aria-hidden="true" />
      <span>{label}</span>
      <strong>{active ? readyText : waitingText}</strong>
    </div>
  )
}

function FriendlySampleChat({ turns }) {
  return (
    <div className="friendly-sample-chat">
      {turns.map(turn => (
        <div className="friendly-turn customer" key={turn.text}>
          <strong>{turn.speaker}</strong>
          <p>{turn.text}</p>
          <small>{turn.note}</small>
        </div>
      ))}
    </div>
  )
}

function FriendlyTranscript({ rows }) {
  return (
    <div className="friendly-transcript">
      {rows.map(row => (
        <article className={`friendly-turn ${row.senderType === 'CUSTOMER' ? 'customer' : 'bot'}`} key={row.id}>
          <strong>{row.senderType === 'CUSTOMER' ? 'Customer' : 'Bot'}</strong>
          <p>{row.content}</p>
          {row.intent ? <small>{row.intent}</small> : null}
        </article>
      ))}
    </div>
  )
}

function ConversationState({ chatResponse, idsReady }) {
  let title = 'Start with auto demo'
  let detail = 'Run auto demo creates the workflow, sends the five-message script, and fills the debug panels.'
  let tone = 'waiting'

  if (chatResponse?.duplicate) {
    title = 'Duplicate replay confirmed'
    detail = 'The same message ID reused the previous response and did not add history rows.'
    tone = 'done'
  } else if (chatResponse?.currentNodeId === 'end') {
    title = 'Automation completed'
    detail = 'The bot collected the order id, updated status, categorized the follow-up need, created a ticket, and ended the session.'
    tone = 'done'
  } else if (chatResponse) {
    title = 'Conversation response ready'
    detail = 'Use Replay duplicate next to demonstrate idempotency.'
    tone = 'ready'
  } else if (idsReady.workflow) {
    title = 'Workflow ready'
    detail = 'Send a message manually or run auto demo to start a fresh conversation.'
    tone = 'ready'
  }

  return (
    <div className={`conversation-state ${tone}`}>
      <CheckCircle2 size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  )
}

function ProjectFlowMap() {
  const lanes = createProjectFlowLanes(123456)

  return (
    <div className="project-flow-map" aria-label="End-to-end project flow">
      <div className="project-flow-header">
        <div>
          <p className="eyebrow">Project flow</p>
          <h4>From setup to company integration</h4>
        </div>
        <span>{SAMPLE_WORKFLOW.nodes.length} nodes · {SAMPLE_WORKFLOW.edges.length} edges</span>
      </div>
      <div className="project-flow-lanes">
        {lanes.map((lane, index) => (
          <article className="project-flow-lane" key={lane.id}>
            <header>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{lane.title}</strong>
                <small>{lane.description}</small>
              </div>
            </header>
            <ol>
              {lane.checkpoints.map((checkpoint) => (
                <li key={`${lane.id}-${checkpoint.label}`}>
                  <div>
                    <strong>{checkpoint.label}</strong>
                    <code>{checkpoint.surface}</code>
                  </div>
                  <small>{checkpoint.evidence}</small>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
      <DemoScriptPreview />
    </div>
  )
}

function DemoScriptPreview() {
  return (
    <div className="script-preview" aria-label="Multi-turn automation script">
      {createAutoDemoScript(123456).map((step, index) => (
        <div className="script-step" key={step.messageId}>
          <span>{String(index + 1).padStart(2, '0')} · {step.expect}</span>
          <strong>{step.text}</strong>
          <small>{step.feature}</small>
          <em>{step.flow}</em>
        </div>
      ))}
    </div>
  )
}

function AutomationConceptMap() {
  return (
    <div className="automation-concept-map" aria-label="Product flow to engineering concept map">
      <div>
        <p className="eyebrow">Product flow map</p>
        <h4>Which feature proves which engineering concept</h4>
      </div>
      <div className="concept-map-grid">
        {projectBrief.productConceptMap.map(item => (
          <article key={item.feature}>
            <header>
              <strong>{item.feature}</strong>
              <code>{item.flow}</code>
            </header>
            <p>{item.concepts.join(' · ')}</p>
            <ul>
              {item.evidence.map(evidence => <li key={evidence}>{evidence}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </div>
  )
}

function DemoProgress({ idsReady, debugReady }) {
  const steps = [
    {
      label: 'Automation',
      detail: idsReady.automation ? 'Ready' : 'Auto creates it',
      active: idsReady.automation
    },
    {
      label: 'Workflow',
      detail: idsReady.workflow ? 'Published version ready' : 'Auto saves and publishes',
      active: idsReady.workflow
    },
    {
      label: 'Message',
      detail: idsReady.conversation ? 'Multi-turn conversation exists' : 'Auto sends five messages',
      active: idsReady.conversation
    },
    {
      label: 'Debug',
      detail: debugReady ? 'History and trace loaded' : 'Auto refreshes after send',
      active: debugReady
    }
  ]

  return (
    <div className="demo-progress" aria-label="Auto demo progress">
      {steps.map(step => (
        <div className={`demo-step ${step.active ? 'done' : ''}`} key={step.label}>
          <CheckCircle2 size={16} aria-hidden="true" />
          <div>
            <strong>{step.label}</strong>
            <span>{step.detail}</span>
          </div>
        </div>
      ))}
    </div>
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
            <p>Backend fresher training workspace</p>
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
          <p className="eyebrow">Java backend mentoring system</p>
          <h2>Learn backend fundamentals through a runnable chat automation product.</h2>
          <p>
            One source tree contains the Java API, React console, workflow engine, mock chat channel,
            observability panels, and a structured ZA Fresher Training program.
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
          <FlowNode label="Automation" detail="Workflow graph" icon={<Workflow size={18} />} />
          <FlowConnector />
          <FlowNode label="Session" detail="State machine" icon={<Database size={18} />} />
          <FlowConnector />
          <FlowNode label="Trace" detail="Debug signals" icon={<Bug size={18} />} />
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
  const [activeTopicId, setActiveTopicId] = useState(trainingTopics[0].id)
  const [activeSessionNumber, setActiveSessionNumber] = useState(learningSessions[0].number)
  const [activeBriefTabId, setActiveBriefTabId] = useState(projectBrief.tabs[0].id)
  const [sourceFile, setSourceFile] = useState(null)
  const [sourceError, setSourceError] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const activeTopic = trainingTopics.find(topic => topic.id === activeTopicId) || trainingTopics[0]

  function scrollToSection(targetId) {
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  function openKnowledge(topicId, preferredSessionNumber = activeSessionNumber) {
    const selection = knowledgeSelectionForTopic(topicId, preferredSessionNumber)
    setActiveTopicId(selection.topicId)
    setActiveSessionNumber(selection.sessionNumber)
    scrollToSection(selection.scrollTarget)
  }

  function openRoadmapDetail(sessionNumber) {
    const session = learningSessions.find(item => item.number === sessionNumber) || learningSessions[0]
    setActiveTopicId(session.topicId)
    setActiveSessionNumber(session.number)
  }

  async function openSource(path) {
    setSourceLoading(true)
    setSourceError('')
    try {
      setSourceFile(await readTrainingSource(path))
      scrollToSection('source-viewer')
    } catch (error) {
      setSourceError(error.message)
      setSourceFile(null)
      scrollToSection('source-viewer')
    } finally {
      setSourceLoading(false)
    }
  }

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
        <h2>From foundation knowledge to designing, debugging, and reviewing a backend workflow system.</h2>
        <p>
          Every module connects a core backend concept to a concrete part of the Conversation
          Automation project: definition, explanation, example, demo path, project hooks, and a visual chart.
        </p>
        <div className="training-actions">
          {trainingTopics.map(topic => (
            <button type="button" onClick={() => openKnowledge(topic.id)} key={topic.id}>{topic.label}</button>
          ))}
        </div>
      </section>

      <ProjectBrief activeTabId={activeBriefTabId} onChangeTab={setActiveBriefTabId} onOpenSource={openSource} />

      <KnowledgeDetail
        topic={activeTopic}
        onOpenTopic={openKnowledge}
        onOpenSessionDetail={openRoadmapDetail}
        onOpenSource={openSource}
        navigate={navigate}
      />

      <SourceViewer
        source={sourceFile}
        loading={sourceLoading}
        error={sourceError}
        onClose={() => {
          setSourceFile(null)
          setSourceError('')
        }}
      />

      <section className="topic-stack" aria-label="Foundation topics">
        {trainingTopics.map(topic => (
          <TopicModule topic={topic} key={topic.id} />
        ))}
      </section>

      <section className="roadmap" id="sessions">
        <div className="section-heading">
          <p className="eyebrow">10 sessions x 90 minutes</p>
          <h3>Learning roadmap</h3>
        </div>
        <div className="session-list">
          {learningSessions.map(session => (
            <article
              className="session-item"
              id={`session-${session.number}`}
              key={session.number}
            >
              <div className="session-summary">
                <span className="session-number">{session.number}</span>
                <div>
                  <h4>{session.title}</h4>
                  <p>{session.demo}</p>
                </div>
                <small>{session.duration}</small>
                <a
                  className="button-link"
                  href={sessionDetailPath(session.number)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => openRoadmapDetail(session.number)}
                >
                  Open detail
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="study-grid">
        {studyCards.map(card => (
          <article key={card.title}>
            <h3>{card.title}</h3>
            <ul>
              {card.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </section>
    </main>
  )
}

function SessionDetailPage({ session, navigate }) {
  const topic = trainingTopics.find(item => item.id === session.topicId) || trainingTopics[0]
  const [sourceFile, setSourceFile] = useState(null)
  const [sourceError, setSourceError] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)

  function scrollToSection(targetId) {
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  async function openSource(path) {
    setSourceLoading(true)
    setSourceError('')
    try {
      setSourceFile(await readTrainingSource(path))
      scrollToSection('source-viewer')
    } catch (error) {
      setSourceError(error.message)
      setSourceFile(null)
      scrollToSection('source-viewer')
    } finally {
      setSourceLoading(false)
    }
  }

  return (
    <main className="training-page session-page">
      <nav className="landing-nav">
        <div className="brand compact">
          <FileJson size={24} aria-hidden="true" />
          <div>
            <h1>Session {session.number}</h1>
            <p>{topic.label} · {topic.title}</p>
          </div>
        </div>
        <div className="nav-actions">
          <button type="button" onClick={() => navigate('/training')}>
            <Workflow size={16} aria-hidden="true" /> Training
          </button>
          <button type="button" className="primary" onClick={() => navigate('/ui')}>
            <Play size={16} aria-hidden="true" /> Demo console
          </button>
        </div>
      </nav>

      <section className="session-hero">
        <div>
          <p className="eyebrow">{session.duration} mentoring session</p>
          <h2>{session.number}. {session.title}</h2>
          <p>{session.lesson}</p>
        </div>
        <div className="session-hero-facts">
          <span>{topic.label}</span>
          <strong>{topic.title}</strong>
          <small>{session.demo}</small>
        </div>
      </section>

      <section className="session-detail-layout">
        <article className="session-card">
          <p className="eyebrow">Concept</p>
          <h3>Definition and explanation</h3>
          <p>{topic.definition}</p>
          <p>{topic.explanation}</p>
        </article>
        <article className="session-card">
          <p className="eyebrow">Example</p>
          <h3>{topic.example.title}</h3>
          <ol>
            {topic.example.steps.map(step => <li key={step}>{step}</li>)}
          </ol>
        </article>
        <article className="session-card applied-card">
          <p className="eyebrow">Applied to this project</p>
          <h3>How this concept shows up in the automation system</h3>
          <dl>
            <div>
              <dt>Problem</dt>
              <dd>{session.appliedExample.problem}</dd>
            </div>
            <div>
              <dt>Project application</dt>
              <dd>{session.appliedExample.projectApplication}</dd>
            </div>
            <div>
              <dt>How to explain</dt>
              <dd>{session.appliedExample.mentorExplanation}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="code-walkthrough" aria-label="Code walkthrough">
        <div className="section-heading">
          <p className="eyebrow">Code walkthrough</p>
          <h3>Files, snippets, responsibilities, and mentor explanation</h3>
        </div>
        <div className="code-card-grid">
          {session.codeWalkthrough.map(item => (
            <article className="code-card" key={`${item.source}-${item.symbol}`}>
              <header>
                <code>{item.source}</code>
                <button type="button" onClick={() => openSource(item.source)}>
                  <FileText size={14} aria-hidden="true" /> View source
                </button>
              </header>
              <h4>{item.symbol}</h4>
              <pre><code>{item.snippet}</code></pre>
              <dl>
                <div>
                  <dt>Function</dt>
                  <dd>{item.responsibility}</dd>
                </div>
                <div>
                  <dt>Why this design</dt>
                  <dd>{item.why}</dd>
                </div>
                <div>
                  <dt>How to explain</dt>
                  <dd>{item.explain}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="session-lab-grid">
        <article className="session-card">
          <p className="eyebrow">Lab</p>
          <h3>Run this session</h3>
          <ol>
            {session.lab.map(item => <li key={item}>{item}</li>)}
          </ol>
          <button type="button" className="primary" onClick={() => navigate('/ui')}>
            <Play size={16} aria-hidden="true" /> Open demo console
          </button>
        </article>
        <article className="session-card">
          <p className="eyebrow">Concept demo</p>
          <h3>{topic.conceptDemo.title}</h3>
          <p>{topic.conceptDemo.scenario}</p>
          <ul>
            {topic.conceptDemo.evidence.map(item => <li key={item}>{item}</li>)}
          </ul>
        </article>
        <article className="session-card">
          <p className="eyebrow">Reading</p>
          <h3>Source references</h3>
          <SourceReferenceList items={session.reading} onOpenSource={openSource} />
        </article>
      </section>

      <SourceViewer
        source={sourceFile}
        loading={sourceLoading}
        error={sourceError}
        onClose={() => {
          setSourceFile(null)
          setSourceError('')
        }}
      />
    </main>
  )
}

function TopicDetailPage({ topic, navigate }) {
  const relatedSessions = learningSessions.filter(item => item.topicId === topic.id)
  const demo = topic.conceptDemo
  const [sourceFile, setSourceFile] = useState(null)
  const [sourceError, setSourceError] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)

  const indicators = [
    {
      label: 'Guideline',
      value: topic.label,
      description: 'The source guideline bucket this concept belongs to.'
    },
    {
      label: 'Why it matters',
      value: 'Project behavior',
      description: topic.summary
    },
    {
      label: 'Demo',
      value: demo.title,
      description: demo.scenario
    },
    {
      label: 'Evidence',
      value: `${demo.evidence.length} checkpoints`,
      description: 'What the mentor asks freshers to verify in the running automation project.'
    }
  ]

  function scrollToSection(targetId) {
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  async function openSource(path) {
    setSourceLoading(true)
    setSourceError('')
    try {
      setSourceFile(await readTrainingSource(path))
      scrollToSection('source-viewer')
    } catch (error) {
      setSourceError(error.message)
      setSourceFile(null)
      scrollToSection('source-viewer')
    } finally {
      setSourceLoading(false)
    }
  }

  return (
    <main className="training-page topic-detail-page">
      <nav className="landing-nav">
        <div className="brand compact">
          <FileJson size={24} aria-hidden="true" />
          <div>
            <h1>{topic.label}</h1>
            <p>Dedicated concept detail</p>
          </div>
        </div>
        <div className="nav-actions">
          <button type="button" onClick={() => navigate('/training')}>
            <Workflow size={16} aria-hidden="true" /> Training
          </button>
          <button type="button" className="primary" onClick={() => navigate('/ui')}>
            <Play size={16} aria-hidden="true" /> Demo console
          </button>
        </div>
      </nav>

      <section className="topic-detail-hero">
        <div>
          <p className="eyebrow">Knowledge detail</p>
          <h2>{topic.title}</h2>
          <p>{topic.summary}</p>
        </div>
        <aside className="topic-detail-summary" aria-label="Topic route indicator">
          <span>{topic.label}</span>
          <strong>Separate tab detail</strong>
          <small>
            This page keeps the training roadmap stable while the mentor drills into one concept,
            one demo, and the exact source files behind it.
          </small>
        </aside>
      </section>

      <section className="topic-indicator-grid" aria-label="Concept indicators and descriptions">
        {indicators.map(item => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <section className="topic-detail-grid" aria-label="Concept explanation">
        <article className="topic-detail-card definition">
          <p className="eyebrow">Definition</p>
          <h3>What freshers must remember</h3>
          <p>{topic.definition}</p>
        </article>
        <article className="topic-detail-card">
          <p className="eyebrow">Explanation</p>
          <h3>How it behaves in backend systems</h3>
          <p>{topic.explanation}</p>
        </article>
        <article className="topic-detail-card">
          <p className="eyebrow">Example</p>
          <h3>{topic.example.title}</h3>
          <ol>
            {topic.example.steps.map(step => <li key={step}>{step}</li>)}
          </ol>
        </article>
        <article className="topic-detail-card demo-panel">
          <p className="eyebrow">Concept demo</p>
          <h3>{demo.title}</h3>
          <p>{demo.scenario}</p>
          <ol>
            {demo.steps.map(step => <li key={step}>{step}</li>)}
          </ol>
          <button type="button" className="primary" onClick={() => navigate('/ui')}>
            <Play size={16} aria-hidden="true" /> Run demo console
          </button>
        </article>
      </section>

      <section className="concept-foundation-layout" aria-label="Foundation concepts and mentoring guideline">
        <FoundationBasics basics={topic.basics} />
        <GuidelineSteps steps={topic.stepByStep} />
      </section>

      <ProductFlowList
        title="Product flows that prove this concept"
        flows={topic.productFlows}
        onOpenSource={openSource}
      />

      <section className="topic-lecture-layout" aria-label="Lecture plan and project hooks">
        <article className="topic-detail-card">
          <p className="eyebrow">Lecture notes</p>
          <h3>How to teach this concept</h3>
          <ol>
            {topic.lecture.sections.map(section => <li key={section}>{section}</li>)}
          </ol>
        </article>
        <article className="topic-detail-card">
          <p className="eyebrow">Project hooks</p>
          <h3>Where this appears in Conversation Automation</h3>
          <ul>
            {topic.demo.projectHooks.map(item => <li key={item}>{item}</li>)}
          </ul>
        </article>
        <article className="topic-detail-card">
          <p className="eyebrow">Demo evidence</p>
          <h3>What to verify during mentoring</h3>
          <ul>
            {demo.evidence.map(item => <li key={item}>{item}</li>)}
          </ul>
          <div className="mentor-prompt">
            <span>Mentor prompt</span>
            <p>{demo.mentorPrompt}</p>
          </div>
        </article>
      </section>

      <section className="topic-detail-lab" aria-label="Visual chart and lab steps">
        <LearningChart chart={topic.chart} />
        <article className="topic-detail-card">
          <p className="eyebrow">Lab steps</p>
          <h3>Run this concept as a small standalone exercise</h3>
          <ol>
            {topic.lecture.lab.map(item => <li key={item}>{item}</li>)}
          </ol>
        </article>
      </section>

      <section className="topic-source-panel" aria-label="Source references">
        <div className="section-heading">
          <p className="eyebrow">Source walkthrough</p>
          <h3>Files, docs, schemas, and tests to open during the lesson</h3>
        </div>
        <SourceReferenceList
          items={[...topic.lecture.reading, ...topic.demo.projectHooks]}
          onOpenSource={openSource}
        />
      </section>

      <section className="related-sessions topic-related-sessions">
        <strong>Related 90-minute sessions</strong>
        <div>
          {relatedSessions.map(item => (
            <a
              className="button-link"
              href={sessionDetailPath(item.number)}
              target="_blank"
              rel="noreferrer"
              key={item.number}
            >
              {item.number} · {item.title}
            </a>
          ))}
        </div>
      </section>

      <SourceViewer
        source={sourceFile}
        loading={sourceLoading}
        error={sourceError}
        onClose={() => {
          setSourceFile(null)
          setSourceError('')
        }}
      />
    </main>
  )
}

function ProjectBrief({ activeTabId, onChangeTab, onOpenSource }) {
  const activeTab = projectBrief.tabs.find(tab => tab.id === activeTabId) || projectBrief.tabs[0]
  const hasGroups = Array.isArray(activeTab.groups)
  const itemCount = hasGroups
    ? activeTab.groups.reduce((total, group) => total + group.items.length, 0)
    : activeTab.items.length
  const countLabel = hasGroups
    ? `${activeTab.groups.length} sections / ${itemCount} items`
    : `${itemCount} checkpoints`

  return (
    <section className="project-brief" id="project-brief">
      <div className="brief-heading">
        <div>
          <p className="eyebrow">Project brief</p>
          <h3>{projectBrief.title}</h3>
          <p>{projectBrief.subtitle}</p>
        </div>
        <div className="brief-tabs" role="tablist" aria-label="Project brief tabs">
          {projectBrief.tabs.map(tab => (
            <button
              type="button"
              className={tab.id === activeTab.id ? 'active' : ''}
              role="tab"
              aria-selected={tab.id === activeTab.id}
              onClick={() => onChangeTab(tab.id)}
              key={tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`brief-panel brief-panel-${activeTab.id}`}>
        <div className="brief-panel-header">
          <div>
            <p className="eyebrow">Project check</p>
            <h4>{activeTab.label}</h4>
            <p>{activeTab.summary}</p>
          </div>
          <span>{countLabel}</span>
        </div>

        {hasGroups ? (
          <div className="brief-group-grid">
            {activeTab.groups.map(group => (
              <article className="brief-group" key={group.title}>
                <h5>{group.title}</h5>
                <ul>
                  {group.items.map(item => <li key={item}>{item}</li>)}
                </ul>
                {group.coverage ? <SourceCoverageList items={group.coverage} onOpenSource={onOpenSource} /> : null}
              </article>
            ))}
          </div>
        ) : (
          <ol className="brief-checklist">
            {activeTab.items.map((item, index) => (
              <li key={item}>
                <span className="brief-check-index">{String(index + 1).padStart(2, '0')}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <ProductConceptMatrix items={projectBrief.productConceptMap} onOpenSource={onOpenSource} />
    </section>
  )
}

function SourceCoverageList({ items, onOpenSource }) {
  return (
    <div className="coverage-list" aria-label="Source coverage">
      <span>Source coverage</span>
      {items.map(item => (
        <button type="button" onClick={() => onOpenSource(item.source)} key={`${item.source}-${item.label}`}>
          <FileText size={14} aria-hidden="true" />
          <span>{item.label}</span>
          <small>{item.status}</small>
        </button>
      ))}
    </div>
  )
}

function KnowledgeDetail({ topic, onOpenTopic, onOpenSessionDetail, onOpenSource, navigate }) {
  const relatedSessions = learningSessions.filter(item => item.topicId === topic.id)
  const demo = topic.conceptDemo

  return (
    <section className="knowledge-tab" id="knowledge-tab">
      <div className="section-heading">
        <p className="eyebrow">Concept lab</p>
        <h3>{topic.label}: {topic.title}</h3>
      </div>

      <div className="topic-tabs" role="tablist" aria-label="Training knowledge topics">
        {trainingTopics.map(item => (
          <button
            type="button"
            className={item.id === topic.id ? 'active' : ''}
            onClick={() => onOpenTopic(item.id)}
            key={item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="knowledge-detail-grid">
        <article className="lecture-card">
          <h4>Lecture notes</h4>
          <ol>
            {topic.lecture.sections.map(section => <li key={section}>{section}</li>)}
          </ol>
        </article>
        <article className="lecture-card">
          <h4>Reading and code references</h4>
          <SourceReferenceList items={topic.lecture.reading} onOpenSource={onOpenSource} />
        </article>
        <article className="lecture-card">
          <h4>{demo.title}</h4>
          <p>{demo.scenario}</p>
          <ol>
            {demo.steps.map(step => <li key={step}>{step}</li>)}
          </ol>
        </article>
        <article className="lecture-card featured concept-evidence">
          <h4>Demo evidence</h4>
          <ul>
            {demo.evidence.map(item => <li key={item}>{item}</li>)}
          </ul>
          <div className="mentor-prompt">
            <span>Mentor prompt</span>
            <p>{demo.mentorPrompt}</p>
          </div>
          <button type="button" className="primary" onClick={() => navigate('/ui')}>
            <Play size={16} aria-hidden="true" /> Run this demo
          </button>
        </article>
      </div>

      <div className="knowledge-guideline-row">
        <GuidelineSteps steps={topic.stepByStep.slice(0, 5)} compact />
        <ProductFlowList
          title="Applied product flows"
          flows={topic.productFlows}
          onOpenSource={onOpenSource}
          compact
        />
      </div>

      <div className="related-sessions">
        <strong>Related roadmap sessions</strong>
        <div>
          {relatedSessions.map(item => (
            <a
              className="button-link"
              href={sessionDetailPath(item.number)}
              target="_blank"
              rel="noreferrer"
              onClick={() => onOpenSessionDetail(item.number)}
              key={item.number}
            >
              {item.number} · {item.title}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function TopicModule({ topic }) {
  const demo = topic.conceptDemo
  const detailPath = topicDetailPath(topic.id)

  return (
    <article className="topic-module" id={topic.id}>
      <header className="topic-header">
        <span className="topic-label">{topic.label}</span>
        <div>
          <h3>{topic.title}</h3>
          <p>{topic.summary}</p>
        </div>
        <a className="button-link" href={detailPath} target="_blank" rel="noreferrer">Open detail</a>
      </header>

      <div className="knowledge-grid">
        <section className="knowledge-card definition">
          <h4>Definition</h4>
          <p>{topic.definition}</p>
        </section>
        <section className="knowledge-card">
          <h4>Explanation</h4>
          <p>{topic.explanation}</p>
        </section>
        <section className="knowledge-card example-card">
          <h4>Example</h4>
          <strong>{topic.example.title}</strong>
          <ol>
            {topic.example.steps.map(step => <li key={step}>{step}</li>)}
          </ol>
        </section>
        <section className="knowledge-card demo-card">
          <h4>Concept demo</h4>
          <strong>{demo.title}</strong>
          <p>{demo.scenario}</p>
          <a className="button-link" href={detailPath} target="_blank" rel="noreferrer">
            <Play size={16} aria-hidden="true" /> Open lab detail
          </a>
        </section>
      </div>

      <div className="topic-lab">
        <LearningChart chart={topic.chart} />
        <TopicList title="Project hooks" items={topic.demo.projectHooks} />
      </div>
      <ProductFlowList title="Product flow mapping" flows={topic.productFlows} compact />
    </article>
  )
}

function FoundationBasics({ basics }) {
  return (
    <article className="foundation-card">
      <p className="eyebrow">Foundation basics</p>
      <h3>Terms freshers must explain before touching code</h3>
      <div className="basic-term-grid">
        {basics.map(item => (
          <section key={item.term}>
            <strong>{item.term}</strong>
            <p>{item.definition}</p>
            <small>{item.guideline}</small>
          </section>
        ))}
      </div>
    </article>
  )
}

function GuidelineSteps({ steps, compact = false }) {
  return (
    <article className={`guideline-card ${compact ? 'compact' : ''}`}>
      <p className="eyebrow">Step-by-step guideline</p>
      <h3>How the mentor should teach it</h3>
      <ol>
        {steps.map(step => <li key={step}>{step}</li>)}
      </ol>
    </article>
  )
}

function ProductFlowList({ title, flows, onOpenSource, compact = false }) {
  return (
    <section className={`product-flow-list ${compact ? 'compact' : ''}`} aria-label={title}>
      <div className="section-heading">
        <p className="eyebrow">Product concept map</p>
        <h3>{title}</h3>
      </div>
      <div className="product-flow-grid">
        {flows.map(flow => (
          <article key={`${flow.feature}-${flow.flow}`}>
            <header>
              <strong>{flow.feature}</strong>
              <code>{flow.flow}</code>
            </header>
            <p>{flow.concept}</p>
            <small>{flow.evidence}</small>
            {onOpenSource ? <SourceReferenceList items={flow.files} onOpenSource={onOpenSource} compact /> : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function ProductConceptMatrix({ items, onOpenSource }) {
  return (
    <section className="project-concept-matrix" aria-label="Project feature to engineering concept matrix">
      <div className="section-heading">
        <p className="eyebrow">Product concept map</p>
        <h4>Feature, flow, evidence, and source coverage</h4>
      </div>
      <div className="concept-matrix-grid">
        {items.map(item => (
          <article key={item.feature}>
            <header>
              <strong>{item.feature}</strong>
              <code>{item.flow}</code>
            </header>
            <p>{item.concepts.join(' · ')}</p>
            <ul>
              {item.evidence.map(evidence => <li key={evidence}>{evidence}</li>)}
            </ul>
            <SourceReferenceList items={item.files} onOpenSource={onOpenSource} compact />
          </article>
        ))}
      </div>
    </section>
  )
}

function SessionDetail({ session, onOpenConcept, onOpenSource }) {
  const topic = trainingTopics.find(item => item.id === session.topicId) || trainingTopics[0]

  return (
    <div className="session-detail">
      <div className="session-detail-main">
        <p className="eyebrow">{topic.label} session detail</p>
        <h4>{session.number}. {session.title}</h4>
        <p>{session.lesson}</p>
      </div>
      <div className="mini-list">
        <span>Reading</span>
        <SourceReferenceList items={session.reading} onOpenSource={onOpenSource} compact />
      </div>
      <div className="mini-list">
        <span>Lab</span>
        {session.lab.map(item => <code key={item}>{item}</code>)}
      </div>
      <button type="button" onClick={() => onOpenConcept(session.topicId, session.number)}>
        <Play size={16} aria-hidden="true" /> Open concept lab
      </button>
    </div>
  )
}

function SourceReferenceList({ items, onOpenSource, compact = false }) {
  return (
    <div className={`source-list ${compact ? 'compact' : ''}`}>
      {items.map(item => {
        const references = sourceReferencesFor(item)
        return (
          <div className="source-item" key={item}>
            <code>{item}</code>
            {references.length > 0 ? (
              <div className="source-actions">
                {references.map(reference => (
                  <button type="button" onClick={() => onOpenSource(reference.path)} key={reference.path}>
                    <FileText size={14} aria-hidden="true" /> View {reference.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function SourceViewer({ source, loading, error, onClose }) {
  if (!source && !loading && !error) {
    return null
  }

  return (
    <section className="source-viewer" id="source-viewer">
      <header>
        <div>
          <p className="eyebrow">Source viewer</p>
          <h3>{source?.path || 'Loading source'}</h3>
          {source?.language ? <span>{source.language}</span> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Close source viewer">
          <X size={16} aria-hidden="true" /> Close
        </button>
      </header>
      {loading ? <p className="empty">Loading source...</p> : null}
      {error ? <p className="source-error">{error}</p> : null}
      {source ? <pre><code>{source.content}</code></pre> : null}
    </section>
  )
}

function LearningChart({ chart }) {
  return (
    <section className="chart-card" aria-label={chart.title}>
      <h4>{chart.title}</h4>
      <div className="chart-flow">
        {chart.nodes.map((node, index) => (
          <React.Fragment key={node.label}>
            <div className={`chart-node ${node.tone}`}>
              <strong>{node.label}</strong>
              <span>{node.detail}</span>
            </div>
            {index < chart.nodes.length - 1 ? <div className="chart-arrow" aria-hidden="true" /> : null}
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}

function TopicList({ title, items }) {
  return (
    <div className="hook-list">
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
      {trace.map(item => {
        const detail = parseTraceDetail(item.detailJson)
        return (
          <div className="trace-item" key={item.id}>
            <div>
              <strong>{item.eventType}</strong>
              <span>{item.nodeId}</span>
            </div>
            {detail.category ? (
              <div className="trace-meta">
                <span className="intent-badge">{detail.category}</span>
                {detail.orderId ? <small>order {detail.orderId}</small> : null}
                {detail.status ? <small>{detail.status}</small> : null}
                {detail.supportCategory ? <small>{detail.supportCategory}</small> : null}
              </div>
            ) : null}
            <code>{item.requestId} / {item.messageId}</code>
          </div>
        )
      })}
    </div>
  )
}

function parseTraceDetail(detailJson) {
  try {
    return JSON.parse(detailJson || '{}')
  } catch {
    return {}
  }
}

function HistoryView({ history }) {
  const rows = normalizeHistoryItems(history)
  const summary = summarizeHistory(history)

  if (!rows.length) {
    return <p className="empty">No messages loaded</p>
  }
  return (
    <div className="history-view">
      <div className="history-summary" aria-label="History summary">
        <div><strong>{summary.total}</strong><span>Total rows</span></div>
        <div><strong>{summary.customer}</strong><span>Customer</span></div>
        <div><strong>{summary.bot}</strong><span>Bot</span></div>
        <div><strong>{summary.intents.length}</strong><span>Intents</span></div>
      </div>
      {summary.intents.length ? (
        <div className="history-intents" aria-label="Detected intents">
          {summary.intents.map(intent => <span className="intent-badge" key={intent}>{intent}</span>)}
        </div>
      ) : null}
      <div className="history-scroll" aria-label={`Conversation history with ${summary.total} rows`}>
        <div className="message-list">
          {rows.map(message => (
            <article className={`message ${message.senderType.toLowerCase()}`} key={message.id}>
              <header>
                <strong>{String(message.displayIndex).padStart(2, '0')} · {message.senderType}</strong>
                <span>{shortId(message.id)}</span>
              </header>
              {message.intent ? <span className="intent-badge">{message.intent}</span> : null}
              <p>{message.content}</p>
              {message.traceId ? <code>{message.traceId}</code> : null}
            </article>
          ))}
        </div>
      </div>
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
