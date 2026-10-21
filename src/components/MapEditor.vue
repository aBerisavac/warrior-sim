<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import sourceMap from '../data/town-map.json'
import { buildingCells, gateCells } from '../town-grid'
import { validateTownMap } from '../map-validation'
import { groundAccents, dustPatches, roofPerch } from '../map-ambience'
import TownArt from './TownArt.vue'

const emit = defineEmits(['close'])
const { t } = useI18n()
const draftKey = 'briarwick-town-map-draft-v1'
function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey))
    if (saved?.columns === 30 && saved?.rows === 30) return { ...saved, id: sourceMap.id, ambience: saved.ambience || structuredClone(sourceMap.ambience) }
  } catch { /* An incomplete draft can be discarded. */ }
  return structuredClone(sourceMap)
}
const map = ref(loadDraft())
const tool = ref('R')
const shape = ref('rectangle')
const imageForPlacement = ref('')
const status = ref('')
const saving = ref(false)
const dragStart = ref(null)
const dragEnd = ref(null)
const hoverCell = ref(null)
const terrainTools = [
  ['R', 'road'], ['.', 'ground'], ['W', 'wall'], ['~', 'river'],
  ['B', 'bridge'], ['F', 'forest'], ['M', 'mountain'], ['A', 'farm'],
]
const buildingTools = ['smithy', 'market', 'square', 'tavern', 'chapel', 'barracks', 'house']
const gateTools = ['northGate', 'eastGate', 'gate', 'westGate']
const decorTools = ['well', 'crates', 'flowers', 'bush', 'tree', 'rock', 'barrel', 'cart']
const isTileTool = computed(() => terrainTools.some(([code]) => code === tool.value))
const isBuildingTool = computed(() => buildingTools.includes(tool.value))
const isGateTool = computed(() => gateTools.includes(tool.value))
const exportMap = computed(() => {
  const current = map.value
  if (!current.ambience) return current
  return { ...current, ambience: { ...current.ambience, accents: groundAccents(current), dust: dustPatches(current), birds: (current.ambience.birds || []).filter(bird => roofPerch(current, bird.perch)) } }
})
const problems = computed(() => validateTownMap(exportMap.value))
const imageSource = computed({
  get() {
    if (isTileTool.value) return map.value.tileImages?.[tool.value] || ''
    if (isBuildingTool.value && tool.value !== 'house') return map.value.buildings.find((item) => item.id === tool.value)?.imageSrc || ''
    if (isGateTool.value) return map.value.gates.find((item) => item.id === tool.value)?.imageSrc || ''
    return imageForPlacement.value
  },
  set(value) {
    if (isTileTool.value) map.value.tileImages[tool.value] = value || null
    else if (isBuildingTool.value && tool.value !== 'house') {
      const building = map.value.buildings.find((item) => item.id === tool.value)
      if (building) building.imageSrc = value || null
      imageForPlacement.value = value
    } else if (isGateTool.value) {
      const gate = map.value.gates.find((item) => item.id === tool.value)
      if (gate) gate.imageSrc = value || null
    } else imageForPlacement.value = value
  },
})
const preview = computed(() => {
  if ((!isBuildingTool.value && !isGateTool.value) || !dragStart.value) return null
  const end = dragEnd.value || dragStart.value
  const x = Math.min(dragStart.value.x, end.x)
  const y = Math.min(dragStart.value.y, end.y)
  const spanX = Math.abs(end.x - dragStart.value.x) + 1
  const spanY = Math.abs(end.y - dragStart.value.y) + 1
  const width = isBuildingTool.value ? Math.min(4, Math.max(2, spanX)) : spanX
  const height = isBuildingTool.value ? Math.min(4, Math.max(2, spanY)) : spanY
  return { x: Math.min(30 - width, x), y: Math.min(30 - height, y), width, height }
})
watch(map, (value) => localStorage.setItem(draftKey, JSON.stringify(value)), { deep: true })
watch(tool, () => { imageForPlacement.value = '' })

function tileAt(x, y) { return map.value.terrain[y]?.[x] }
function setTile(x, y, code) {
  const row = map.value.terrain[y]
  map.value.terrain[y] = row.slice(0, x) + code + row.slice(x + 1)
}
function buildingAt(x, y) {
  return map.value.buildings.find((building) => buildingCells(building).some((cell) => cell.x === x && cell.y === y))
}
function removeBuilding(building) {
  for (const cell of buildingCells(building)) setTile(cell.x, cell.y, '.')
  map.value.buildings = map.value.buildings.filter((item) => item !== building)
}
function chooseDoor(building) {
  const candidates = []
  for (const { x, y } of buildingCells(building)) {
    for (const [dx, dy, side] of [[0,-1,'north'],[1,0,'east'],[0,1,'south'],[-1,0,'west']]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= 30 || ny >= 30 || buildingCells(building).some((cell) => cell.x === nx && cell.y === ny)) continue
      candidates.push({ x: nx, y: ny, side })
    }
  }
  building.door = candidates.find((door) => ['R', 'G', 'B'].includes(tileAt(door.x, door.y))) || candidates[0]
}
function refreshDoors() {
  for (const building of map.value.buildings) {
    const door = building.door
    if (!door || !['R', 'G', 'B'].includes(tileAt(door.x, door.y))) chooseDoor(building)
  }
}
function paint(x, y) {
  if (isTileTool.value) {
    const old = buildingAt(x, y)
    if (old) removeBuilding(old)
    setTile(x, y, tool.value)
    refreshDoors()
  } else if (tool.value === 'door') {
    if (!['R', 'G', 'B'].includes(tileAt(x, y))) { status.value = t('mapEditor.doorRoad'); return }
    for (const [dx, dy, side] of [[0,1,'north'],[-1,0,'east'],[0,-1,'south'],[1,0,'west']]) {
      const building = buildingAt(x + dx, y + dy)
      if (building) { building.door = { x, y, side }; status.value = t('mapEditor.doorPlaced'); return }
    }
    status.value = t('mapEditor.doorBuilding')
  } else if (tool.value === 'cellImage') {
    map.value.cellImages = map.value.cellImages.filter((item) => item.x !== x || item.y !== y)
    if (imageForPlacement.value) map.value.cellImages.push({ x, y, src: imageForPlacement.value })
  } else if (decorTools.includes(tool.value)) {
    map.value.decor = map.value.decor.filter((item) => item.x !== x || item.y !== y)
    map.value.decor.push({ type: tool.value, x, y })
  }
}
function placeGate(bounds) {
  const existing = map.value.gates.find((item) => item.id === tool.value)
  const next = { ...existing, id: tool.value, ...bounds }
  const cells = gateCells(next)
  const previous = existing ? gateCells(existing) : []
  const previousKeys = new Set(previous.map((cell) => `${cell.x},${cell.y}`))
  const collision = cells.some((cell) => {
    if (buildingAt(cell.x, cell.y)) return true
    if (map.value.gates.some((gate) => gate.id !== tool.value && gateCells(gate).some((part) => part.x === cell.x && part.y === cell.y))) return true
    return !previousKeys.has(`${cell.x},${cell.y}`) && !['.', 'R', 'W', 'G'].includes(tileAt(cell.x, cell.y))
  })
  if (collision) { status.value = t('mapEditor.occupied'); return }
  const previousTiles = new Map((existing?.underTiles || []).map((cell) => [`${cell.x},${cell.y}`, cell.tile]))
  for (const cell of previous) setTile(cell.x, cell.y, previousTiles.get(`${cell.x},${cell.y}`) || 'W')
  next.underTiles = cells.map((cell) => ({ ...cell, tile: tileAt(cell.x, cell.y) }))
  for (const cell of cells) setTile(cell.x, cell.y, 'G')
  if (existing) Object.assign(existing, next)
  else map.value.gates.push(next)
  refreshDoors()
  status.value = t('mapEditor.gatePlaced')
}
function placeBuilding(bounds) {
  const { x, y, width, height } = bounds
  const rows = shape.value === 'L' && (width > 2 || height > 2)
    ? Array.from({ length: height }, (_, index) => index === height - 1 ? '#'.repeat(width - 1) + '.' : '#'.repeat(width)) : null
  const existing = map.value.buildings.find((item) => item.id === tool.value)
  const building = { id: tool.value === 'house' ? `house${Date.now()}` : tool.value, kind: tool.value, x, y, width, height, door: null, imageSrc: imageSource.value || null }
  if (rows) building.shape = rows
  const cells = buildingCells(building)
  const collision = cells.find((cell) => {
    const occupant = buildingAt(cell.x, cell.y)
    return occupant && occupant !== existing || !['.', 'H'].includes(tileAt(cell.x, cell.y))
  })
  if (collision) { status.value = t('mapEditor.occupied'); return }
  if (existing) removeBuilding(existing)
  for (const cell of cells) setTile(cell.x, cell.y, 'H')
  chooseDoor(building)
  map.value.buildings.push(building)
  status.value = t('mapEditor.buildingPlaced')
}
function cellFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  return { x: Math.max(0, Math.min(29, Math.floor((event.clientX - rect.left) / rect.width * 30))), y: Math.max(0, Math.min(29, Math.floor((event.clientY - rect.top) / rect.height * 30))) }
}
function pointerDown(event) {
  if (event.button !== 0) return
  event.currentTarget.setPointerCapture(event.pointerId)
  const cell = cellFromEvent(event)
  dragStart.value = cell; dragEnd.value = cell; hoverCell.value = cell; status.value = ''
  if (!isBuildingTool.value && !isGateTool.value) paint(cell.x, cell.y)
}
function pointerMove(event) {
  const cell = cellFromEvent(event)
  hoverCell.value = cell
  if (!dragStart.value) return
  if (isBuildingTool.value || isGateTool.value) { dragEnd.value = cell; return }
  const from = dragEnd.value || cell
  const steps = Math.max(Math.abs(cell.x - from.x), Math.abs(cell.y - from.y))
  for (let index = 1; index <= steps; index++) {
    paint(Math.round(from.x + (cell.x - from.x) * index / steps), Math.round(from.y + (cell.y - from.y) * index / steps))
  }
  dragEnd.value = cell
}
function pointerUp(event) {
  if (!dragStart.value) return
  dragEnd.value = cellFromEvent(event)
  if (isBuildingTool.value && preview.value) placeBuilding(preview.value)
  else if (isGateTool.value && preview.value) placeGate(preview.value)
  dragStart.value = null; dragEnd.value = null
}
function resetDraft() {
  map.value = structuredClone(sourceMap)
  localStorage.removeItem(draftKey)
  status.value = t('mapEditor.resetDone')
}
function downloadJson() {
  const blob = new Blob([JSON.stringify(exportMap.value, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = 'town-map.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function saveJson() {
  if (problems.value.length) { status.value = t('mapEditor.fixErrors'); return }
  saving.value = true
  try {
    const response = await fetch('/__map-editor/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exportMap.value) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || t('mapEditor.saveFailed'))
    localStorage.removeItem(draftKey)
    window.location.reload()
  } catch (error) { status.value = error.message || t('mapEditor.saveFailed') }
  finally { saving.value = false }
}
</script>

<template>
  <div class="map-editor">
    <div class="map-editor-bar">
      <strong>{{ t('mapEditor.title') }} <small>30 × 30</small></strong>
      <button type="button" @click="emit('close')">{{ t('mapEditor.close') }}</button>
    </div>
    <div class="map-editor-controls">
      <label>{{ t('mapEditor.paint') }}
        <select v-model="tool">
          <optgroup :label="t('mapEditor.terrain')"><option v-for="[code, label] in terrainTools" :key="code" :value="code">{{ t('mapEditor.' + label) }}</option></optgroup>
          <optgroup :label="t('mapEditor.buildings')"><option v-for="id in buildingTools" :key="id" :value="id">{{ id === 'house' ? t('mapEditor.house') : t('places.' + id + '.name') }}</option></optgroup>
          <optgroup :label="t('mapEditor.gates')"><option v-for="id in gateTools" :key="id" :value="id">{{ t('places.' + id + '.name') }}</option></optgroup>
          <optgroup :label="t('mapEditor.details')"><option value="door">{{ t('mapEditor.door') }}</option><option value="cellImage">{{ t('mapEditor.cellImage') }}</option><option v-for="id in decorTools" :key="id" :value="id">{{ t('mapEditor.' + id) }}</option></optgroup>
        </select>
      </label>
      <label v-if="isBuildingTool">{{ t('mapEditor.shape') }} <select v-model="shape"><option value="rectangle">{{ t('mapEditor.rectangle') }}</option><option value="L">{{ t('mapEditor.lShape') }}</option></select></label>
      <label v-if="isTileTool || isBuildingTool || isGateTool || tool === 'cellImage'">{{ t('mapEditor.imageSource') }} <input v-model="imageSource" type="text" :placeholder="t('mapEditor.imagePlaceholder')" /></label>
    </div>
    <p class="map-editor-help">{{ isBuildingTool ? t('mapEditor.buildingHelp') : isGateTool ? t('mapEditor.gateHelp') : t('mapEditor.paintHelp') }}</p>
    <div class="map-editor-canvas">
      <TownArt :map="map" :ambience-enabled="false" />
      <div class="map-editor-hit" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @pointerleave="hoverCell = null"></div>
      <div v-if="preview" class="map-editor-preview" :style="{ left: preview.x / 30 * 100 + '%', top: preview.y / 30 * 100 + '%', width: preview.width / 30 * 100 + '%', height: preview.height / 30 * 100 + '%' }"></div>
      <div v-else-if="hoverCell" class="map-editor-hover" :style="{ left: hoverCell.x / 30 * 100 + '%', top: hoverCell.y / 30 * 100 + '%' }"></div>
    </div>
    <div class="map-editor-bottom">
      <div class="map-editor-feedback" role="status">{{ status || (problems.length ? t('mapEditor.errors', { count: problems.length }) + ' ' + problems[0] : t('mapEditor.ready')) }}</div>
      <div class="map-editor-buttons"><button type="button" @click="resetDraft">{{ t('mapEditor.reset') }}</button><button type="button" @click="downloadJson">{{ t('mapEditor.download') }}</button><button type="button" class="map-editor-save" :disabled="saving || problems.length > 0" @click="saveJson">{{ saving ? t('mapEditor.saving') : t('mapEditor.save') }}</button></div>
    </div>
  </div>
</template>
