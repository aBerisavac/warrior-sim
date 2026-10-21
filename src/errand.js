import { hasRequiredItems } from './inventory'
import { hasQuest, questById, QUEST } from './progression'
export function canEnterSmithy(game) {
  return !game.leftHomeForErrand || hasQuest(game.completedQuests, QUEST.IRON_STOCK_BOUGHT)
    || hasRequiredItems(game.inventory, questById(QUEST.IRON_STOCK_BOUGHT).requiredItems)
}
export function robPlayer(game, random = Math.random) {
  const lost = Math.min(40 + Math.floor(Math.max(0, Math.min(.999999, random())) * 11), Math.max(0, game.coins - 1))
  game.coins -= lost
  return lost
}
