import assert from 'node:assert/strict'
import { test } from 'node:test'

import { learningSessions, projectBrief, trainingTopics } from './trainingContent.js'

test('training topics provide complete English learning module content', () => {
  assert.equal(trainingTopics.length, 4)

  for (const topic of trainingTopics) {
    assert.match(topic.label, /^(PC 01|CS RPC 01|TE 01|OB 01)$/)
    assert.ok(topic.definition.length > 60, `${topic.label} needs a definition`)
    assert.ok(topic.explanation.length > 80, `${topic.label} needs an explanation`)
    assert.ok(topic.example.title.length > 8, `${topic.label} needs an example title`)
    assert.ok(topic.example.steps.length >= 3, `${topic.label} needs example steps`)
    assert.ok(topic.demo.consolePath === '/ui', `${topic.label} demo should link to the automation console`)
    assert.ok(topic.demo.projectHooks.length >= 3, `${topic.label} needs project hooks`)
    assert.ok(topic.chart.nodes.length >= 3, `${topic.label} needs chart nodes`)
    assert.ok(topic.lecture.sections.length >= 3, `${topic.label} needs lecture sections`)
    assert.ok(topic.lecture.reading.length >= 3, `${topic.label} needs reading references`)
    assert.ok(topic.lecture.lab.length >= 3, `${topic.label} needs lab steps`)
    assert.ok(topic.basics?.length >= 4, `${topic.label} needs foundation basics`)
    assert.ok(topic.stepByStep?.length >= 5, `${topic.label} needs mentor step-by-step guideline`)
    assert.ok(topic.productFlows?.length >= 3, `${topic.label} needs product flow mappings`)
    for (const basic of topic.basics) {
      assert.ok(basic.term.length > 3, `${topic.label} basic needs term`)
      assert.ok(basic.definition.length > 40, `${topic.label} basic ${basic.term} needs definition`)
      assert.ok(basic.guideline.length > 50, `${topic.label} basic ${basic.term} needs guideline`)
    }
    for (const step of topic.stepByStep) {
      assert.ok(step.length > 45, `${topic.label} guideline step is too short`)
    }
    for (const flow of topic.productFlows) {
      assert.ok(flow.feature.length > 12, `${topic.label} flow needs feature`)
      assert.match(flow.flow, /->/, `${topic.label} flow needs workflow path`)
      assert.ok(flow.concept.length > 30, `${topic.label} flow needs concept explanation`)
      assert.ok(flow.evidence.length > 30, `${topic.label} flow needs evidence`)
      assert.ok(flow.files.length >= 1, `${topic.label} flow needs source files`)
      assert.ok(flow.files.every(file => /^(conversation-app|intent-contract|intent-service|docs|frontend)\//.test(file)), `${topic.label} flow file should be local`)
    }
    assert.equal(topic.conceptDemo.id, topic.id, `${topic.label} demo should belong to that concept`)
    assert.ok(topic.conceptDemo.title.length > 12, `${topic.label} needs a concept demo title`)
    assert.ok(topic.conceptDemo.scenario.length > 60, `${topic.label} needs a demo scenario`)
    assert.ok(topic.conceptDemo.steps.length >= 3, `${topic.label} needs concept demo steps`)
    assert.ok(topic.conceptDemo.evidence.length >= 2, `${topic.label} needs demo evidence`)
    assert.ok(topic.conceptDemo.mentorPrompt.length > 40, `${topic.label} needs mentor prompt`)
  }

  const uniqueDemoTitles = new Set(trainingTopics.map(topic => topic.conceptDemo.title))
  assert.equal(uniqueDemoTitles.size, trainingTopics.length, 'each concept should have its own demo')
})

test('learning sessions stay aligned with the 10-session mentoring format', () => {
  assert.equal(learningSessions.length, 10)
  assert.ok(learningSessions.every(session => session.duration === '90 min'))
  assert.ok(learningSessions.every(session => session.demo.length > 20))
  assert.ok(learningSessions.every(session => session.topicId), 'each session should open a knowledge topic')
  assert.ok(learningSessions.every(session => session.lesson.length > 80), 'each session should have lecture notes')
  assert.ok(learningSessions.every(session => session.reading.length >= 2), 'each session should have reading items')
  assert.ok(learningSessions.every(session => session.lab.length >= 2), 'each session should have lab steps')
})

test('each roadmap session has a dedicated applied source walkthrough', () => {
  for (const session of learningSessions) {
    assert.ok(session.appliedExample?.problem.length > 40, `${session.number} needs an applied problem`)
    assert.ok(session.appliedExample?.projectApplication.length > 60, `${session.number} needs project application`)
    assert.ok(session.appliedExample?.mentorExplanation.length > 60, `${session.number} needs mentor explanation`)
    assert.ok(session.codeWalkthrough?.length >= 2, `${session.number} needs source walkthrough items`)

    for (const item of session.codeWalkthrough) {
      assert.match(item.source, /^(conversation-app|intent-contract|intent-service|docs)\//, `${session.number} source should be local`)
      assert.ok(item.symbol.length > 3, `${session.number} source item needs symbol`)
      assert.ok(item.snippet.length > 10, `${session.number} source item needs snippet`)
      assert.ok(item.responsibility.length > 40, `${session.number} source item needs responsibility`)
      assert.ok(item.why.length > 40, `${session.number} source item needs why`)
      assert.ok(item.explain.length > 40, `${session.number} source item needs explanation`)
    }
  }
})

test('project brief captures the complete project scope and checkpoints', () => {
  assert.equal(projectBrief.title, 'Conversation Automation System')
  assert.deepEqual(projectBrief.tabs.map(tab => tab.id), [
    'description',
    'requirements',
    'expected-output',
    'review-checkpoint',
    'demo-checkpoint'
  ])

  const description = projectBrief.tabs.find(tab => tab.id === 'description')
  assert.equal(description.groups.length, 6)
  assert.ok(description.groups.some(group => group.title === 'Khởi tạo project & Mock Chat API'))
  assert.ok(description.groups.some(group => group.title === 'Automation Execution Engine'))
  assert.ok(description.groups.some(group => group.title === 'Nâng cao (Optional)'))
  assert.ok(description.groups.every(group => group.items.length >= 3), 'each description group needs enough details')
  assert.ok(description.groups.every(group => group.coverage?.length >= 2), 'each description group needs source coverage refs')
  assert.ok(description.groups.flatMap(group => group.coverage).some(item => item.source.includes('MockChatService.java')))
  assert.ok(description.groups.flatMap(group => group.coverage).some(item => item.source.includes('schema.sql')))
  assert.ok(description.groups.flatMap(group => group.coverage).some(item => item.status === 'optional-design'))

  const requirements = projectBrief.tabs.find(tab => tab.id === 'requirements')
  assert.equal(requirements.items.length, 11)
  assert.ok(requirements.items.some(item => item.includes('Client & Server')))
  assert.ok(requirements.items.some(item => item.includes('idempotency')))
  assert.ok(requirements.items.some(item => item.includes('Observability')))

  const expectedOutput = projectBrief.tabs.find(tab => tab.id === 'expected-output')
  assert.equal(expectedOutput.items.length, 12)
  assert.ok(expectedOutput.items.some(item => item.includes('Docker Compose')))
  assert.ok(expectedOutput.items.some(item => item.includes('OpenAPI/Swagger')))
  assert.ok(expectedOutput.items.some(item => item.includes('README, architecture document')))

  const reviewCheckpoint = projectBrief.tabs.find(tab => tab.id === 'review-checkpoint')
  assert.ok(reviewCheckpoint.items.length >= 12)
  assert.ok(reviewCheckpoint.items.some(item => item.includes('workflow validation')))

  const demoCheckpoint = projectBrief.tabs.find(tab => tab.id === 'demo-checkpoint')
  assert.ok(demoCheckpoint.items.length >= 8)
  assert.ok(demoCheckpoint.items.some(item => item.includes('Replay duplicate')))
})

test('project brief contains a product concept map from runnable flows to engineering concepts', () => {
  assert.ok(projectBrief.productConceptMap?.length >= 6)
  const conceptIds = new Set(projectBrief.productConceptMap.flatMap(item => item.conceptIds))

  assert.deepEqual([...conceptIds].sort(), ['ob', 'pc', 'rpc', 'te'])
  assert.ok(projectBrief.productConceptMap.some(item => item.flow.includes('ask_followup_category')))
  for (const item of projectBrief.productConceptMap) {
    assert.ok(item.feature.length > 12, 'feature should be explicit')
    assert.match(item.flow, /->/, `${item.feature} should show flow path`)
    assert.ok(item.concepts.length >= 1, `${item.feature} should list engineering concepts`)
    assert.ok(item.evidence.length >= 2, `${item.feature} should include evidence checkpoints`)
    assert.ok(item.files.length >= 1, `${item.feature} should include source files`)
  }
})
