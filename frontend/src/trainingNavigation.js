import { learningSessions } from './trainingContent.js'

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
