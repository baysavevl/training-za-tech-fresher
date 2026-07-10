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
