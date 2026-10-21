import questIds from './data/quests.json'
import unlocks from './data/unlocks.json'

export const QUEST = Object.freeze({
  FATHER_CALLED: 'father_called',
  FATHER_MET: 'father_met',
  IRON_ERRAND_ACCEPTED: 'iron_errand_accepted',
  BANDIT_AMBUSH_SURVIVED: 'bandit_ambush_survived',
  TAVERN_WORK_OFFERED: 'tavern_work_offered',
  IRON_STOCK_BOUGHT: 'iron_stock_bought',
  DAGGER_FORGED: 'dagger_forged',
  DRAFTED: 'drafted',
})

export const knownQuests = new Set(questIds.map((quest) => quest.id))
export const questById = (id) => questIds.find((quest) => quest.id === id)

export function activeQuests(completedQuests) {
  return questIds.filter((quest) => quest.visible !== false && !hasQuest(completedQuests, quest.id) && quest.requires.every((id) => hasQuest(completedQuests, id)))
    .sort((a, b) => a.priority - b.priority)
}

export function primaryQuest(completedQuests) {
  return activeQuests(completedQuests)[0] || [...questIds].filter((quest) => quest.visible !== false && hasQuest(completedQuests, quest.id)).sort((a, b) => b.priority - a.priority)[0] || null
}

export function hasQuest(completedQuests, questId) {
  return Array.isArray(completedQuests) && completedQuests.includes(questId)
}

export function isUnlocked(completedQuests, group, id) {
  const requirements = unlocks[group]?.[id]
  return Array.isArray(requirements) && requirements.every((questId) => hasQuest(completedQuests, questId))
}

export function stageFromQuests(completedQuests) {
  return [...questIds].filter((quest) => quest.stageOnComplete && hasQuest(completedQuests, quest.id))
    .sort((a, b) => b.priority - a.priority)[0]?.stageOnComplete || 'intro'
}

const legacyStageQuests = {
  fatherCall: [QUEST.FATHER_CALLED],
  fatherTalk: [QUEST.FATHER_CALLED, QUEST.FATHER_MET],
  errand: [QUEST.FATHER_CALLED, QUEST.FATHER_MET, QUEST.IRON_ERRAND_ACCEPTED],
  robbed: [QUEST.FATHER_CALLED, QUEST.FATHER_MET, QUEST.IRON_ERRAND_ACCEPTED, QUEST.BANDIT_AMBUSH_SURVIVED],
  materials: [QUEST.FATHER_CALLED, QUEST.FATHER_MET, QUEST.IRON_ERRAND_ACCEPTED, QUEST.BANDIT_AMBUSH_SURVIVED, QUEST.IRON_STOCK_BOUGHT],
  sleep: [QUEST.FATHER_CALLED, QUEST.FATHER_MET, QUEST.IRON_ERRAND_ACCEPTED, QUEST.BANDIT_AMBUSH_SURVIVED, QUEST.IRON_STOCK_BOUGHT, QUEST.DAGGER_FORGED],
  drafted: [QUEST.FATHER_CALLED, QUEST.FATHER_MET, QUEST.IRON_ERRAND_ACCEPTED, QUEST.BANDIT_AMBUSH_SURVIVED, QUEST.IRON_STOCK_BOUGHT, QUEST.DAGGER_FORGED, QUEST.DRAFTED],
}

export function migrateCompletedQuests(saved) {
  const source = Array.isArray(saved.completedQuests) ? saved.completedQuests : legacyStageQuests[saved.stage] || []
  return [...new Set(source.filter((id) => knownQuests.has(id)))]
}
