import events from './data/travel-events.json'
import { hasQuest } from './progression'

export function eventForTravelTick(travel, completedQuests, random = Math.random) {
  const bandits = events.scriptedBandits
  if (travel.destinationId === bandits.destinationId && hasQuest(completedQuests, bandits.questRequired)
    && !hasQuest(completedQuests, bandits.questCompleted)
    && (travel.secondsElapsed === bandits.triggerSecond || travel.elapsedMinutes >= travel.totalMinutes)) return 'bandits'
  return random() < events.roadTravelerChance ? 'roadTraveler' : null
}
