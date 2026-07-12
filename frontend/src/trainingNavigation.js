import { learningSessions, trainingTopics } from './trainingContent.js'

export function firstSessionNumberForTopic(topicId) {
  return (learningSessions.find(session => session.topicId === topicId) || learningSessions[0]).number
}

export function knowledgeSelectionForTopic(topicId, preferredSessionNumber) {
  const preferredSession = learningSessions.find(session => session.number === preferredSessionNumber)
  const sessionNumber = preferredSession?.topicId === topicId
    ? preferredSession.number
    : firstSessionNumberForTopic(topicId)

  return {
    topicId,
    sessionNumber,
    scrollTarget: 'knowledge-tab'
  }
}

export function roadmapDetailSelection(sessionNumber) {
  const session = learningSessions.find(item => item.number === sessionNumber) || learningSessions[0]

  return {
    topicId: session.topicId,
    sessionNumber: session.number,
    scrollTarget: `session-${session.number}`
  }
}

export function sessionDetailPath(sessionNumber) {
  return `/training/session/${sessionFromNumber(sessionNumber).number}`
}

export function sessionFromPath(path) {
  const match = typeof path === 'string' ? path.match(/^\/training\/session\/(\d{2})$/) : null
  return sessionFromNumber(match?.[1])
}

function sessionFromNumber(sessionNumber) {
  return learningSessions.find(item => item.number === sessionNumber) || learningSessions[0]
}

export function topicDetailPath(topicId) {
  return `/training/topic/${topicFromId(topicId).id}`
}

export function topicFromPath(path) {
  const match = typeof path === 'string' ? path.match(/^\/training\/topic\/([a-z-]+)$/) : null
  return topicFromId(match?.[1])
}

function topicFromId(topicId) {
  return trainingTopics.find(item => item.id === topicId) || trainingTopics[0]
}

export function toggleExpandedSession(expandedSessionNumbers, sessionNumber) {
  if (expandedSessionNumbers.includes(sessionNumber)) {
    return expandedSessionNumbers.filter(item => item !== sessionNumber)
  }
  return [...expandedSessionNumbers, sessionNumber]
}
