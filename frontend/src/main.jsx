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
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Workflow,
  X
} from 'lucide-react'
import { withJsonHeaders } from './apiClient.js'
import { DEMO_STATE_VERSION, SAMPLE_WORKFLOW, hydrateDemoState, initialDemoState } from './demoState.js'
import { knowledgeSelectionForTopic, roadmapDetailSelection, toggleExpandedSession } from './trainingNavigation.js'
import { sourceReferencesFor } from './trainingSources.js'
import { learningSessions, projectBrief, studyCards, trainingTopics } from './trainingContent.js'
import './styles.css'

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
    return hydrateDemoState(saved)
  })
  const [history, setHistory] = useState([])
  const [session, setSession] = useState(null)
  const [trace, setTrace] = useState([])
  const [lastResponse, setLastResponse] = useState(null)
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    localStorage.setItem('conversationAutomationUi', JSON.stringify({ ...state, _version: DEMO_STATE_VERSION }))
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
    const response = await fetch(path, withJsonHeaders(options))
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
      setLastResponse(result)
    }
    return result
  }

  async function publishWorkflow() {
    const result = await run('Workflow published', () => request(`/api/automations/${state.automationId}/workflows/${state.workflowVersionId}/publish`, {
      method: 'POST'
    }))
    if (result) {
      setLastResponse(result)
    }
    return result
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
    return result
  }

  async function quickSetup(sendAfterPublish = false) {
    const result = await run(sendAfterPublish ? 'Sample workflow published and message sent' : 'Sample workflow published', async () => {
      const definition = JSON.parse(state.workflowJson)
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
      const message = await request('/api/mock-chat/messages', {
        method: 'POST',
        headers: { 'X-Request-Id': state.requestId },
        body: JSON.stringify({
          userId: state.userId,
          conversationId: state.conversationId || null,
          messageId: state.messageId,
          automationId: automation.id,
          text: state.text
        })
      })
      return { automation, workflow, published, message }
    })

    if (result) {
      patch({
        automationId: result.automation.id,
        workflowVersionId: result.workflow.id,
        conversationId: result.message?.conversationId || state.conversationId
      })
      setLastResponse(result.message || result.published)
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

  function resetDemo() {
    setState(initialDemoState)
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

        <section className="run-card">
          <div>
            <p className="eyebrow">Guided demo</p>
            <h3>Create, publish, then send without guessing button order.</h3>
            <p>
              Use quick setup when mentoring live. It creates the automation, saves the sample
              workflow draft, publishes it, and can optionally send the first chat message.
            </p>
          </div>
          <div className="run-actions">
            <button type="button" onClick={() => quickSetup(false)} disabled={busy}>
              <CheckCircle2 size={16} aria-hidden="true" /> Set up + publish
            </button>
            <button type="button" className="primary" onClick={() => quickSetup(true)} disabled={busy}>
              <Send size={16} aria-hidden="true" /> Run full demo
            </button>
          </div>
        </section>

        <div className="grid">
          <section className="panel setup-panel">
            <PanelTitle icon={<Database size={18} />} title="Workflow setup" />
            <div className="step-help">
              <strong>Manual order</strong>
              <span>Create automation, save draft, publish, then send message.</span>
            </div>
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
                ? 'Save draft is locked until an automation exists. Use Create or Set up + publish.'
                : !idsReady.workflow
                  ? 'Publish is locked until the workflow draft is saved.'
                  : 'Workflow draft is ready to publish.'}
            </p>
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
            <p className="button-note">
              {!idsReady.automation
                ? 'Send is locked until an automation exists. Use Run full demo for the fastest path.'
                : !idsReady.workflow
                  ? 'Publish the workflow before sending a message.'
                  : 'Send is ready. Replay duplicate unlocks after the first conversation exists.'}
            </p>
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
  const [expandedSessionNumbers, setExpandedSessionNumbers] = useState([learningSessions[0].number])
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
    const selection = roadmapDetailSelection(sessionNumber)
    setExpandedSessionNumbers(current => toggleExpandedSession(current, selection.sessionNumber))
    setActiveSessionNumber(selection.sessionNumber)
    scrollToSection(selection.scrollTarget)
  }

  async function openSource(path) {
    setSourceLoading(true)
    setSourceError('')
    try {
      const response = await fetch(`/api/training/sources?path=${encodeURIComponent(path)}`, withJsonHeaders())
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.message || `${response.status} ${response.statusText}`)
      }
      setSourceFile(body)
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

      <ProjectBrief activeTabId={activeBriefTabId} onChangeTab={setActiveBriefTabId} />

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
          <TopicModule topic={topic} navigate={navigate} onOpenKnowledge={openKnowledge} key={topic.id} />
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
              className={`session-item ${expandedSessionNumbers.includes(session.number) ? 'expanded' : ''}`}
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
                <button type="button" onClick={() => openRoadmapDetail(session.number)}>
                  {expandedSessionNumbers.includes(session.number) ? 'Hide detail' : 'Open detail'}
                </button>
              </div>
              {expandedSessionNumbers.includes(session.number) ? (
                <SessionDetail session={session} onOpenConcept={openKnowledge} onOpenSource={openSource} />
              ) : null}
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

function ProjectBrief({ activeTabId, onChangeTab }) {
  const activeTab = projectBrief.tabs.find(tab => tab.id === activeTabId) || projectBrief.tabs[0]

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
              onClick={() => onChangeTab(tab.id)}
              key={tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="brief-panel">
        <h4>{activeTab.label}</h4>
        <ol>
          {activeTab.items.map(item => <li key={item}>{item}</li>)}
        </ol>
      </div>
    </section>
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

      <div className="related-sessions">
        <strong>Related roadmap sessions</strong>
        <div>
          {relatedSessions.map(item => (
            <button type="button" onClick={() => onOpenSessionDetail(item.number)} key={item.number}>
              {item.number} · {item.title}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function TopicModule({ topic, navigate, onOpenKnowledge }) {
  const demo = topic.conceptDemo

  return (
    <article className="topic-module" id={topic.id}>
      <header className="topic-header">
        <span className="topic-label">{topic.label}</span>
        <div>
          <h3>{topic.title}</h3>
          <p>{topic.summary}</p>
        </div>
        <button type="button" onClick={() => onOpenKnowledge(topic.id)}>Open detail</button>
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
          <button type="button" onClick={() => onOpenKnowledge(topic.id)}>
            <Play size={16} aria-hidden="true" /> Open lab detail
          </button>
        </section>
      </div>

      <div className="topic-lab">
        <LearningChart chart={topic.chart} />
        <TopicList title="Project hooks" items={topic.demo.projectHooks} />
      </div>
    </article>
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
