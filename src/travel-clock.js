import { pointAtDistance } from './map-routing'

// Movement is continuous; the game clock advances only at a tile boundary.
export function advanceTravelClock(journey, seconds, grid) {
  const duration = grid.secondsPerCell || 2
  const previous = Number.isFinite(journey.cellSeconds) ? journey.cellSeconds : 0
  journey.cellSeconds = Math.min(duration, previous + seconds)
  const minutes = Math.min(journey.totalMinutes, journey.elapsedMinutes + journey.cellSeconds / duration)
  journey.position = pointAtDistance(journey.route, minutes * grid.cellSize / (grid.minutesPerCell || 1))
  if (journey.cellSeconds < duration - .000001) return false
  journey.cellSeconds = 0
  journey.elapsedMinutes = Math.min(journey.totalMinutes, journey.elapsedMinutes + 1)
  return true
}
