import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { createServer } from 'vite'
import { createSSRApp, createRenderer, h, nextTick, reactive } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createI18n } from 'vue-i18n'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
try {
  const D = await server.ssrLoadModule('/src/weapon-design.js')
  const W = await server.ssrLoadModule('/src/workshop.js')
  const I = await server.ssrLoadModule('/src/inventory.js')
  const M = await server.ssrLoadModule('/src/merchants.js')
  const G = await server.ssrLoadModule('/src/game.js')
  const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url)))
  const copy = value => JSON.parse(JSON.stringify(value))
  const base = D.newWeaponDesign()
  assert.deepEqual(D.designIssues(base).errors, [])
  assert.equal(D.normalizeDesign({ ...base, sections: {} }), null)
  assert.equal(D.designRecipe(base).oreCount, 4)
  const copper = { ...copy(base), material: 'copper' }
  assert.equal(D.designRecipe(copper).oreCount, 6)
  assert.equal(D.designRecipe(base).volume, D.designRecipe(copper).volume)
  assert(D.weaponStats(copper).weight > D.weaponStats(base).weight)
  assert(D.weaponStats(copper).durability < D.weaponStats(base).durability)
  assert(D.designIssues({ ...base, length: 180 }).errors.includes('lengthBudget'))
  const tooWide = copy(base); tooWide.sections.forEach(s => { s.width = 12; s.thickness = 18 })
  assert(D.designIssues(tooWide).errors.includes('metalBudget'))
  const curved = copy(base); curved.controls = [{ x: .33, y: .3 }, { x: .67, y: .3 }, { x: 1, y: .1 }]
  assert(D.weaponStats(curved).ratios.cut > D.weaponStats(base).ratios.cut)
  assert(D.weaponStats(curved).ratios.pierce < D.weaponStats(base).ratios.pierce)
  assert(Math.abs(D.weaponStats(curved).centre.y) > .1)
  assert.equal(D.bladeGeometry(curved).points[0].x, 0)
  assert(Math.abs(D.bladeGeometry(curved).length - base.length) < .001)
  for (const design of [base, curved, copper]) { const r = D.weaponStats(design).ratios; assert(Math.abs(r.cut + r.pierce + r.blunt - 100) < .001) }
  const heavyPommel = { ...base, pommel: 'pommel_iron' }, lightPommel = { ...base, pommel: 'dagger_pommel' }
  assert(D.weaponStats(heavyPommel).centre.x < D.weaponStats(lightPommel).centre.x)
  const blunt = copy(base); blunt.point = 'flat'; blunt.sections.forEach(s => { s.profile = 'rounded'; s.edge = 'none' })
  const dull = D.weaponStats(base, { sharpness: Array(6).fill(0) })
  assert(D.weaponStats(blunt).damage > dull.damage)
  assert.equal(D.weaponStats(blunt).ratios.blunt, 100)
  assert(!D.cellNeedsEdge(blunt, 0))
  const weak = copy(base); weak.sections[1].width = 1; weak.sections[1].thickness = 2
  assert(D.designIssues(weak).warnings.includes('weakTransition'))
  const great = copy(base); D.resizeSections(great, 9); great.length = 180; great.handle = 'handle_ash_long'
  assert.equal(great.sections.length * 2, 54)
  assert.equal(D.weaponStats(great).hands, 2)
  assert(D.weaponStats(great).speed < D.weaponStats(base).speed)
  assert.deepEqual(D.designIssues(great).errors, [])
  const game = G.initialState(); game.completedQuests.push('dagger_forged')
  assert.equal(W.workshopAction(game, 'start').error, 'designRequired')
  const design = copy(base); D.resizeSections(design, 2); design.length = 40; design.name = 'Briarwick test blade'
  const recipe = D.designRecipe(design)
  assert(!W.workshopAction(game, 'saveDesign', { design }).error)
  assert.equal(W.workshopAction(game, 'start').error, 'designMaterials')
  game.inventory.push(...recipe.fittings.map((itemId, i) => ({ id: 'fit' + i, itemId, quantity: 1 })), { id: 'ore', itemId: recipe.ore, quantity: recipe.oreCount }, { id: 'coal', itemId: 'coal', quantity: 8 })
  assert(D.designRequirements(game, design).valid)
  const missing = copy(game); missing.inventory = missing.inventory.filter(e => e.itemId !== design.pommel)
  assert.equal(W.workshopAction(missing, 'start').error, 'designMaterials')
  const ok = (action, params = {}) => { const result = W.workshopAction(game, action, params); assert(!result.error, `${action}: ${result.error}`); return result }
  ok('start'); assert(game.workshop.activeDesign)
  assert.equal(W.workshopAction(game, 'saveDesign', { design: base }).error, 'designLocked')
  for (let i = 0; i < recipe.oreCount; i++) ok('loadOre', { itemId: recipe.ore })
  for (let i = 0; i < recipe.carbon; i++) ok('loadCarbon')
  ok('coal'); ok('smelt')
  assert.equal(game.workshop.crucible.mass, 2)
  const small = copy(game), large = copy(game)
  small.workshop.crucible.mass = 1
  small.workshop.crucible.temperature = large.workshop.crucible.temperature = 1650
  small.workshop.crucible.vesselTemperature = large.workshop.crucible.vesselTemperature = 1650
  small.workshop.crucible.stage = large.workshop.crucible.stage = 'melting'
  small.workshop.temperature = large.workshop.temperature = 1650
  W.tickWorkshop(small, .2); W.tickWorkshop(large, .2)
  assert(small.workshop.crucible.melt > large.workshop.crucible.melt, 'Large charges melt more slowly')
  for (let i = 0; i < 3000 && game.workshop.crucible.stage !== 'molten'; i++) { game.workshop.temperature = 1700; W.tickWorkshop(game, .2) }
  assert.equal(game.workshop.crucible.stage, 'molten')
  ok('pour'); ok('pourControl', { holding: true, height: .65 })
  for (let i = 0; i < 150 && game.workshop.pour; i++) W.tickWorkshop(game, .1)
  assert(!game.workshop.pour); assert(!game.workshop.mould.ruined)
  for (let i = 0; i < 120; i++) W.tickWorkshop(game, .2)
  ok('collect'); assert.equal(game.workshop.rack[0].units, 2)
  assert.equal(W.workshopAction(game, 'loadOre', { itemId: recipe.ore }).error, 'finishProject')
  // Taking, manually storing, retrieving, and returning a large blank preserves its mass and shape.
  ok('takeIngot', { id: game.workshop.rack[0].id }); ok('stop')
  const blank = game.inventory.find(e => e.design)
  assert.equal(I.entryWeight(blank), 2)
  ok('transfer', { id: blank.id, from: 'bag' })
  const stored = game.storehouse.find(e => e.design)
  assert.equal(stored.mass, 2)
  ok('transfer', { id: stored.id, from: 'storehouse' })
  const held = game.inventory.find(e => e.design)
  assert.deepEqual(I.normalizeInventory([held])[0], held)
  ok('start'); ok('rackIngot', { itemId: held.itemId }); ok('heatIngot', { id: game.workshop.rack[0].id })
  const b = game.workshop.blade
  assert.equal(b.work.length, 12); assert.equal(b.mass, 2)
  b.temperature = 900; ok('anvil')
  for (let cell = 0; cell < 12; cell++) { ok('strike', { cell, power: 1 }); ok('strike', { cell, power: 1 }); ok('strike', { cell, power: .5 }) }
  ok('shapeDone'); b.temperature = 850; ok('quenchStart')
  for (let i = 0; i < 14; i++) ok('quenchTick', { seconds: .25, medium: 'water' })
  ok('quenchEnd'); assert(b.quench > 98)
  for (let part = 0; part < 3; part++) ok('assemble', { offsetPx: 0 })
  for (let cell = 0; cell < 12; cell++) for (let i = 0; i < 20; i++) ok('grind', { cell, angle: 15, seconds: .25 })
  assert(b.sharpness.every(v => v === 100))
  const snapshot = copy(game.workshop); assert.deepEqual(W.normalizeWorkshop(snapshot), snapshot)
  ok('finish'); assert.equal(game.workshop.activeDesign, null)
  const weapon = game.inventory.find(e => e.itemId === 'custom_weapon')
  assert.equal(weapon.craft.design.name, design.name)
  assert.deepEqual(I.normalizeInventory([weapon])[0], weapon)
  assert.equal(I.entryWeight(weapon), D.weaponStats(design, weapon.craft).weight)
  const equipment = I.equipItem([weapon], {}, weapon.id, 'weapon'); assert.equal(equipment.weapon, weapon.id)
  const twoHander = { ...weapon, id: 'great', craft: { ...weapon.craft, design: great } }
  const nextEquipment = I.equipItem([twoHander], { shield: 'shield' }, 'great', 'weapon')
  assert.equal(nextEquipment.shield, undefined); assert(I.slotBlocked([twoHander], nextEquipment, 'shield'))
  assert.equal(I.carriedWeight([twoHander]), D.weaponStats(great, twoHander.craft).weight)
  for (let side = 0; side < 2; side++) {
    const cells = D.customGrindingCells(design, .6, .4, side)
    assert(cells.length > 1); assert(cells.every(i => Math.floor(i / design.sections.length) === side))
  }
  assert.deepEqual(D.customGrindingCells(blunt, .6, .4, 0), [])
  const ruined = copy(game); ruined.workshop.blade = copy(b); ruined.workshop.blade.stage = 'hammering'; ruined.workshop.blade.work[0] = 190; ruined.workshop.blade.temperature = 900
  assert(!W.workshopAction(ruined, 'strike', { cell: 0, power: 1 }).error)
  assert.equal(ruined.workshop.blade.stage, 'ruined')
  assert.equal(W.workshopAction(ruined, 'regrind', { id: weapon.id }).error, 'bladeRuined')
  const bad = copy(b); bad.stage = 'shaped'; bad.quenching = true; bad.quenchWork = 200
  assert.equal(W.normalizeWorkshop({ ...game.workshop, blade: bad }).blade.stage, 'ruined')
  const stopGame = copy(game); stopGame.workshop.blade = bad
  W.workshopAction(stopGame, 'stop'); assert.equal(stopGame.workshop.blade.stage, 'ruined')
  // Resale and save loading retain the exact crafted instance, rather than a generic item.
  game.coins = 10000
  const trade = draft => { const quote = M.quoteTrade(game, M.MARKET_MERCHANT, draft); assert(!quote.error); return M.executeTrade(game, M.MARKET_MERCHANT, draft, { merchantId: M.MARKET_MERCHANT, fingerprint: M.offerFingerprint(draft), net: quote.net }) }
  assert(!trade({ buy: [], sell: [{ instanceId: weapon.id, quantity: 1 }], percent: 100 }).error)
  assert(!game.inventory.some(e => e.itemId === 'custom_weapon'))
  assert(!trade({ buy: [{ itemId: 'custom_weapon', quantity: 1 }], sell: [], percent: 100 }).error)
  assert.deepEqual(game.inventory.find(e => e.itemId === 'custom_weapon').craft, weapon.craft)
  // Maintenance needs neither another raw charge nor a new design.
  ok('stop'); game.workshop.design = null
  const maintained = game.inventory.find(e => e.itemId === 'custom_weapon')
  ok('regrind', { id: maintained.id }); assert.equal(game.workshop.blade.sourceId, maintained.id)
  ok('finish')
  const bypass = G.initialState(); bypass.completedQuests.push('dagger_forged'); bypass.workshop.working = true
  assert.equal(W.workshopAction(bypass, 'coal').error, 'designRequired')
  const oldStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => JSON.stringify(game) }
  const restored = G.readSave(); globalThis.localStorage = oldStorage
  assert.deepEqual(restored.inventory.find(e => e.itemId === 'custom_weapon').craft, weapon.craft)
  const missingKeys = []
  for (const name of ['WeaponDesigner','WeaponPreview','WeaponStats','WorkshopDialog','DaggerAssembly','DaggerSharpening','PlayerInventory','ForgeMap']) {
    const { default: Component } = await server.ssrLoadModule('/src/components/' + name + '.vue')
    const app = createSSRApp({ render: () => h(Component, { game, design, stats: D.weaponStats(design), station: 'design', blade: b, inventory: game.inventory, equipment: game.equipment, completedQuests: game.completedQuests, workshop: game.workshop, storehouse: game.storehouse }) })
    app.use(createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, missing: (_, key) => missingKeys.push(key), messages: { en } }))
    const html = await renderToString(app)
    assert(!html.includes('NaN'), name + ' renders finite geometry')
    if (name === 'WeaponDesigner') { assert(html.includes('Save design')); assert(html.includes('role="slider"')); assert(html.includes('Weapon name')) }
  }
  assert.deepEqual(missingKeys, [])
  // Execute the actual compiled editor's pointer, keyboard, dimension, and save handlers.
  const source = readFileSync(new URL('../src/components/WeaponDesigner.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const code = compileScript(descriptor, { id: 'weapon-editor-check', inlineTemplate: true }).content
    .replace("from '../weapon-design'", "from '/src/weapon-design'")
    .replace("import WeaponPreview from './WeaponPreview.vue'", "const WeaponPreview = { render: () => null }")
    .replace("import WeaponStats from './WeaponStats.vue'", "const WeaponStats = { render: () => null }")
  mkdirSync(new URL('../.tmp/', import.meta.url), { recursive: true })
  const temporary = new URL('../.tmp/weapon-editor-check.js', import.meta.url)
  writeFileSync(temporary, code)
  try {
    const { default: ClientEditor } = await server.ssrLoadModule('/.tmp/weapon-editor-check.js')
    const node = type => ({ type, tagName: String(type).toUpperCase(), props: {}, children: [], parent: null, text: '',
      addEventListener() {}, removeEventListener() {}, getRootNode() { return globalThis.document }, get options() { return this.children.filter(n => n.type === 'option') },
      createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y } } } },
      getScreenCTM: () => ({ inverse: () => ({}) }), setPointerCapture(id) { this.captured = id } })
    const renderer = createRenderer({ createElement: node, createText: text => ({ ...node('#text'), text }), createComment: node,
      setText: (n, text) => { n.text = text }, setElementText: (n, text) => { n.text = text }, patchProp: (n, key, old, value) => { n.props[key] = value; if (key === 'value') { n.value = value; n._value = value } },
      parentNode: n => n.parent, nextSibling: () => null, insert(n, parent) { n.parent = parent; parent.children.push(n) }, remove(n) { n.parent.children = n.parent.children.filter(c => c !== n) } })
    const uiGame = reactive(G.initialState()); uiGame.completedQuests.push('dagger_forged')
    const root = node('root'), saved = []
    const app = renderer.createApp({ render: () => h(ClientEditor, { game: uiGame, onCommand: (action, params) => { saved.push(params.design); W.workshopAction(uiGame, action, params) } }) })
    app.use(createI18n({ legacy: false, locale: 'en', messages: { en } })); globalThis.Document = class {}; globalThis.ShadowRoot = class {}; globalThis.document = { activeElement: null }; app.mount(root)
    const all = n => [n, ...n.children.flatMap(all)]
    const controls = () => all(root).filter(n => n.type === 'circle' && n.props.role === 'slider')
    const first = controls()[0], oldX = first.props.cx, oldY = first.props.cy
    first.props.onPointerdown({ clientX: 5, clientY: -4, currentTarget: first, pointerId: 7, preventDefault() {} })
    await nextTick(); assert.equal(first.captured, 7); assert.notEqual(first.props.cy, oldY); assert.notEqual(first.props.cx, oldX)
    const svg = all(root).find(n => n.type === 'svg')
    svg.props.onPointerup(); const afterDrag = first.props.cx
    first.props.onKeydown({ key: 'ArrowRight', preventDefault() {} }); await nextTick(); assert.notEqual(first.props.cx, afterDrag)
    const units = all(root).find(n => n.type === 'input' && n.props.type === 'number')
    units.props.onChange({ target: { value: '2' } }); await nextTick()
    const lengthInput = all(root).find(n => n.type === 'input' && n.props.type === 'range')
    lengthInput.props['onUpdate:modelValue'](100); await nextTick()
    let save = all(root).find(n => n.type === 'button' && n.text === 'Save design')
    assert(save.props.disabled, 'A length beyond its stock budget disables saving')
    lengthInput.props['onUpdate:modelValue'](40); await nextTick()
    save = all(root).find(n => n.type === 'button' && n.text === 'Save design')
    assert(!save.props.disabled); save.props.onClick(); await nextTick()
    assert.equal(saved.length, 1); assert.equal(saved[0].sections.length, 6)
    assert.equal(uiGame.workshop.design.ingots, 2)
    uiGame.workshop.activeDesign = copy(saved[0]); await nextTick()
    assert(all(root).filter(n => n.type === 'fieldset').every(n => n.props.disabled), 'Active work locks every dimension and fitting control')
    assert(all(root).find(n => n.type === 'button' && n.text === 'Save design').props.disabled)
    app.unmount(); delete globalThis.document; delete globalThis.Document; delete globalThis.ShadowRoot
  } finally { unlinkSync(temporary) }
  console.log('Weapon design: geometry, material volume, stats, recipe gating, full custom craft, dynamic cells, irreversible failure, equipment, storage, resale, saves and localized components passed')
} finally { await server.close() }
