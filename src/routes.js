import townMap from './data/town-map.json'
import { createMapRoutes, pathLength, pointAtDistance, pointOnRoute } from './map-routing.js'

export const mapGrid = townMap
export const mapDecor = townMap.decor
export const { mapSize, roadSegments, placePoint, placeMarkerPoint, routeFromPoint, routeToCellFromPoint, routeBetween, travelMinutesFromPoint } = createMapRoutes(townMap)
export { pathLength, pointAtDistance, pointOnRoute }
