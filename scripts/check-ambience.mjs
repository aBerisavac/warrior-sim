import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createSSRApp, createRenderer, h, markRaw, nextTick, ref, ssrContextKey } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createI18n } from 'vue-i18n'
import { ambienceFor, birdPose, dustPatches, groundAccents, roofPerch, vegetationMotion, validateMapAmbience } from '../src/map-ambience.js'

const map = JSON.parse(readFileSync(new URL('../src/data/town-map.json', import.meta.url)))
assert.deepEqual(validateMapAmbience(map), [])
assert.equal(ambienceFor({ ...map, id: 'another-town' }), null)
assert.equal(ambienceFor({ ...map, ambience: undefined }), null)
assert.equal(groundAccents({ ...map, id: 'another-town' }).length, 0)
const tree = map.decor.find(d => d.type === 'tree')
assert.deepEqual(vegetationMotion(map, tree), vegetationMotion(map, tree))
assert.notDeepEqual(vegetationMotion(map, tree), vegetationMotion(map, { ...tree, x: tree.x + 1 }))
assert.equal(vegetationMotion(map, { ...tree, animation: false }), null)
assert.equal(vegetationMotion(map, map.decor.find(d => d.type === 'rock')), null)

const occupied = structuredClone(map)
occupied.ambience.accents = [{ x: tree.x, y: tree.y, type: 'grass' }, { x: 12, y: 12, type: 'grass' }, ...map.ambience.accents]
assert.equal(groundAccents(occupied).length, map.ambience.accents.length, 'Grass never covers existing vegetation or a building')
const dust = structuredClone(map)
dust.ambience.dust[0].tiles.push({ x: 12, y: 12 })
assert(dustPatches(dust).every(patch => patch.tiles.every(tile => dust.terrain[tile.y][tile.x] === 'R')))
assert(validateMapAmbience(dust).some(error => error.includes('Dust')))

for (const route of map.ambience.birds) {
  const perch = roofPerch(map, route.perch)
  assert(perch)
  const landed = birdPose(map, route, route.arrival.seconds + 1 - route.phase)
  assert.equal(landed.flying, false)
  assert.equal(landed.x, perch.x * map.cellSize); assert.equal(landed.y, perch.y * map.cellSize)
  const leaving = birdPose(map, route, route.arrival.seconds + route.restSeconds + .1 - route.phase)
  assert(leaving.flying)
  const touchdown = birdPose(map, route, route.arrival.seconds - .00001 - route.phase)
  assert(Math.hypot(touchdown.x - landed.x, touchdown.y - landed.y) < .01, 'Landing joins the perch continuously')
  assert.equal(birdPose(map, route, route.period - .1 - route.phase), null, 'Routes include quiet intervals')
  for (let t = 0; t < route.period; t += .2) {
    const pose = birdPose(map, route, t)
    if (pose) assert(Number.isFinite(pose.x) && Number.isFinite(pose.y))
  }
  const moved = structuredClone(map)
  moved.buildings.find(b => b.id === route.perch.buildingId).x += 1
  assert.equal(roofPerch(moved, route.perch).x, perch.x + 1, 'Perches follow their building')
  moved.buildings = moved.buildings.filter(b => b.id !== route.perch.buildingId)
  assert.equal(birdPose(moved, route, 0), null, 'Removed buildings cannot host birds')
}
assert.equal(roofPerch(map, { buildingId: 'square', cell: { x: 1, y: 1 }, edge: 'north' }), null, 'An interior roof cell is not a perch')
assert.equal(roofPerch(map, { buildingId: 'square', cell: { x: 0, y: 0 }, edge: 'south' }), null, 'A cell edge facing more roof is not exposed')

const server = await createServer({ server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
try {
  const { default: Art } = await server.ssrLoadModule('/src/components/TownArt.vue')
  const { default: Ambience } = await server.ssrLoadModule('/src/components/MapAmbience.vue')
  const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url)))
  const render = props => renderToString(createSSRApp({ render: () => h(Art, props) }).use(createI18n({ legacy: false, locale: 'en', messages: { en } })))
  const active = await render({ map })
  assert(active.includes('data-ambience-map="briarwick-town"')); assert(active.includes('ambience-bird--flying'))
  assert(active.includes('town-vegetation')); assert(active.includes('town-water-ripple'))
  assert(active.includes('briarwick-town-dust-market-lane')); assert(active.includes('pointer-events="none"'))
  const other = await render({ map: { ...map, id: 'another-town' } })
  assert(!other.includes('data-ambience-map')); assert(!other.includes('class="town-vegetation"'))
  assert(!(await render({ map, ambienceEnabled: false })).includes('data-ambience-map'), 'Editor can suppress ambience')
  assert((await render({ map, paused: true })).includes('town-art--paused'))

  // Exercise the real component clock, including cancellation and resume.
  const node = type => markRaw({ type, children: [], props: {} })
  const renderer = createRenderer({
    createElement: node, createText: node, createComment: node, setText() {}, setElementText() {}, patchProp() {},
    parentNode: n => n.parent, nextSibling: () => null,
    insert(n, parent) { n.parent = parent; parent.children.push(n) },
    remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1) }
  })
  const oldFrame = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame
  const frames = new Map(); let serial = 0
  globalThis.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  let app
  try {
    const paused = ref(false), View = { ...Ambience, render: () => h('g') }
    app = renderer.createApp({ render: () => h(View, { map, paused: paused.value }) }).provide(ssrContextKey, { modules: new Set() })
    app.mount(node('root'))
    const state = app._instance.subTree.component.setupState
    const frame = now => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now)) }
    frame(0); frame(40); assert(state.seconds > 0)
    const beforePause = state.seconds
    paused.value = true; await nextTick(); assert.equal(frames.size, 0)
    paused.value = false; await nextTick(); frame(50000)
    assert.equal(state.seconds, beforePause, 'Hidden or paused time does not advance flights')
    frame(50040); assert(state.seconds < beforePause + .1)
    app.unmount(); app = null; assert.equal(frames.size, 0, 'Leaving the map removes animation callbacks')
  } finally { app?.unmount(); globalThis.requestAnimationFrame = oldFrame; globalThis.cancelAnimationFrame = oldCancel }
  console.log('Map ambience: map isolation, independent vegetation, clear ground, clipped road dust, roof-edge landings, continuous flights, pause/resume, cleanup and SVG rendering passed')
} finally { await server.close() }
