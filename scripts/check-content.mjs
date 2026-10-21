import assert from 'node:assert/strict'
import { validateTownMap } from '../src/map-validation.js'
import { gateCells } from '../src/town-grid.js'

import { readFileSync } from 'node:fs'



const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))

const places = readJson('../src/data/places.json')

const catalog = readJson('../src/data/actions.json')

const forgeStations = readJson('../src/data/forge-stations.json')

const en = readJson('../src/i18n/en.json')

const quests = readJson('../src/data/quests.json')

const unlocks = readJson('../src/data/unlocks.json')

const townMap = readJson('../src/data/town-map.json')

const travelEvents = readJson('../src/data/travel-events.json')

const lookup = (key) => key.split('.').reduce((value, part) => value?.[part], en)



const questIds = new Set(quests.map((quest) => quest.id))

assert.equal(questIds.size, quests.length, 'Duplicate quest ID')

for (const quest of quests) {

  assert(Array.isArray(quest.requires), 'Missing quest prerequisites: ' + quest.id)

  for (const required of quest.requires) assert(questIds.has(required), 'Unknown prerequisite: ' + quest.id + ' -> ' + required)

  assert.equal(typeof quest.priority, 'number', 'Missing quest priority: ' + quest.id)

  for (const key of ['titleKey', 'descriptionKey', 'completedTitleKey', 'completedDescriptionKey']) {

    if (quest[key]) assert.equal(typeof lookup(quest[key]), 'string', 'Missing quest text: ' + quest.id + '.' + key)

  }

  assert(Array.isArray(quest.objectives), 'Missing quest objectives: ' + quest.id)

  for (const objective of quest.objectives) {

    assert.equal(typeof lookup(objective.textKey), 'string', 'Missing objective text: ' + quest.id)

    if (objective.placeId) assert(places.some((place) => place.id === objective.placeId), 'Unknown quest destination: ' + objective.placeId)

    if (objective.actionId) assert(places.find((place) => place.id === objective.placeId)?.actions.includes(objective.actionId), 'Unknown quest action: ' + quest.id + '.' + objective.actionId)

  }

  if (quest.cloud) for (const [key, value] of Object.entries(quest.cloud)) {

    if (key.endsWith('Key')) assert.equal(typeof lookup(value), 'string', 'Missing cloud text: ' + quest.id + '.' + key)

  }

}

assert(questIds.has(travelEvents.scriptedBandits.questRequired), 'Unknown bandit prerequisite')

assert(questIds.has(travelEvents.scriptedBandits.questCompleted), 'Unknown bandit completion')

assert(travelEvents.roadTravelerChance >= 0 && travelEvents.roadTravelerChance <= 1, 'Invalid road event chance')

assert.equal(townMap.columns, 30, 'Town must be 20 cells wide')

assert.equal(townMap.rows, 30, 'Town must be 20 cells tall')

assert(townMap.terrain.length === 30 && townMap.terrain.every((row) => row.length === 30), 'Town grid must be 30x30')

assert.deepEqual(validateTownMap(townMap), [], 'Town map editor validation failed')
const validTiles = new Set(Object.keys(townMap.legend))

for (const row of townMap.terrain) for (const tile of row) assert(validTiles.has(tile), 'Unknown town tile: ' + tile)

const tileAt = (x, y) => townMap.terrain[y]?.[x]

const roadTiles = new Set(['R', 'G', 'B'])

const entrances = new Set()
const occupiedCells = new Set()
for (const building of townMap.buildings) {
  const { x, y, width, height, door, shape } = building
  assert(Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(width) && Number.isInteger(height) && width >= 2 && height >= 2 && width <= 4 && height <= 4, 'Building footprint must be 2-4 cells wide and tall: ' + building.id)
  if (shape) assert(shape.length === height && shape.every((row) => row.length === width && /^[.#]+$/.test(row)), 'Invalid building shape: ' + building.id)
  const cells = []
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    if (shape && shape[row][col] !== '#') continue
    const cellX = x + col, cellY = y + row, key = `${cellX},${cellY}`
    assert.equal(tileAt(cellX, cellY), 'H', 'Building footprint mismatch: ' + building.id)
    assert(!occupiedCells.has(key), 'Buildings overlap at ' + key)
    occupiedCells.add(key)
    cells.push([cellX, cellY])
  }
  assert(cells.length >= 4, 'Building too small: ' + building.id)
  const reached = new Set([cells[0].join(',')])
  const pending = [cells[0]]
  for (let index = 0; index < pending.length; index++) {
    const [cx, cy] = pending[index]
    for (const [nx, ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]) {
      const key = `${nx},${ny}`
      if (cells.some(([bx, by]) => bx === nx && by === ny) && !reached.has(key)) { reached.add(key); pending.push([nx, ny]) }
    }
  }
  assert.equal(reached.size, cells.length, 'Building shape disconnected: ' + building.id)
  assert(roadTiles.has(tileAt(door.x, door.y)), 'Building door lacks road: ' + building.id)
  const neighbor = door.side === 'north' ? [door.x, door.y + 1]
    : door.side === 'south' ? [door.x, door.y - 1]
    : door.side === 'west' ? [door.x + 1, door.y]
    : door.side === 'east' ? [door.x - 1, door.y] : null
  assert(neighbor && cells.some(([bx, by]) => bx === neighbor[0] && by === neighbor[1]), 'Door does not face its building: ' + building.id)
  if (building.kind !== 'house') entrances.add(building.id)
}
for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (tileAt(x, y) === 'H') assert(occupiedCells.has(`${x},${y}`), 'Unassigned building cell')
for (const gate of townMap.gates) {

  for (const cell of gateCells(gate)) assert.equal(tileAt(cell.x, cell.y), 'G', 'Gate lacks gate tile: ' + gate.id)

  entrances.add(gate.id)

}

assert.equal(townMap.gates.length, 4, 'Town needs four gates')

assert(townMap.terrain.some((row) => row.includes('B')), 'Town bridge missing')

for (const decor of townMap.decor) assert(tileAt(decor.x, decor.y) !== undefined, 'Decor outside map')

const walkable = new Set()

for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (roadTiles.has(tileAt(x, y))) walkable.add(`${x},${y}`)

const origin = townMap.buildings.find((building) => building.id === 'smithy').door

const seen = new Set([`${origin.x},${origin.y}`])

const queue = [origin]

for (let index = 0; index < queue.length; index++) {

  const { x, y } = queue[index]

  for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {

    const id = `${nx},${ny}`

    if (walkable.has(id) && !seen.has(id)) { seen.add(id); queue.push({ x:nx, y:ny }) }

  }

}

assert.equal(seen.size, walkable.size, 'Road network is disconnected')

assert(Number.isInteger(travelEvents.scriptedBandits.triggerSecond) && travelEvents.scriptedBandits.triggerSecond > 0, 'Invalid bandit trigger second')

for (const [group, rules] of Object.entries(unlocks)) {

  for (const [id, requirements] of Object.entries(rules)) {

    assert(Array.isArray(requirements), 'Invalid unlock rule: ' + group + '.' + id)

    for (const questId of requirements) assert(questIds.has(questId), 'Unknown quest in unlock rule: ' + group + '.' + id + ' -> ' + questId)

  }

}

const ids = new Set()

for (const place of places) {

  assert(!ids.has(place.id), 'Duplicate place: ' + place.id)

  ids.add(place.id)

  assert(entrances.has(place.id), 'Missing road node for place: ' + place.id)

  for (const field of ['name', 'sub', 'description']) {

    assert.equal(typeof lookup('places.' + place.id + '.' + field), 'string', 'Missing place text: ' + place.id + '.' + field)

  }

  if (place.available) assert(unlocks.places[place.id], 'Missing place unlock: ' + place.id)

  for (const id of place.actions) {

    assert(catalog.actions[id], 'Unknown action: ' + id)

    if (place.available) assert(unlocks.actions[place.id + '.' + id], 'Missing action unlock: ' + place.id + '.' + id)

  }

  for (const id of place.jobs) {

    assert(catalog.jobs[id], 'Unknown job: ' + id)

    if (place.available) assert(unlocks.jobs[place.id + '.' + id], 'Missing job unlock: ' + place.id + '.' + id)

  }

}

for (const group of ['actions', 'jobs']) {

  for (const definition of Object.values(catalog[group])) {

    assert.equal(typeof lookup(definition.labelKey), 'string', 'Missing action text: ' + definition.labelKey)

  }

}

for (const stage of ['intro', 'fatherCall', 'fatherTalk', 'errand', 'robbed', 'materials', 'sleep', 'drafted']) {

  assert.equal(typeof lookup('objectives.' + stage), 'string', 'Missing objective: ' + stage)

}

const forgeIds = new Set()

for (const station of forgeStations) {

  assert(!forgeIds.has(station.id), 'Duplicate forge station: ' + station.id)

  forgeIds.add(station.id)

  assert(unlocks.forgeStations[station.id], 'Missing forge unlock: ' + station.id)

  assert(station.x >= 0 && station.x <= 100 && station.y >= 0 && station.y <= 100, 'Forge station outside map: ' + station.id)

  assert(['addCoal', 'forge', 'inspect', 'workbench', 'sleep', 'town'].includes(station.action), 'Unknown forge action: ' + station.action)

  for (const field of ['station', 'actions']) {

    assert.equal(typeof lookup('forgeHouse.' + field + '.' + station.id), 'string', 'Missing forge text: ' + station.id)

  }

}

for (const id of ['pawn', 'objective', 'journal', 'sleep']) assert(unlocks.hud[id], 'Missing HUD unlock: ' + id)

console.log('Content catalogs valid')

