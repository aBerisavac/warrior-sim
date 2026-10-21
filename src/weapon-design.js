import catalog from './data/items.json'

// Densities are g/cm³. Ore yields are explicit game assumptions for sorted ore,
// not universal geological grades. One stock unit has the volume of 1 kg iron.
export const STOCK_VOLUME = 1000 / 7.87
export const METALS = {
  iron: { density: 7.87, ore: 'iron_ore', ingot: 'iron_ingot', orePerUnit: 4, melt: 1538, workMin: 750, workMax: 1150, target: 900, quench: 850, strength: 1, retention: 1, durability: 100, color: '#adb9ad' },
  copper: { density: 8.96, ore: 'copper_ore', ingot: 'copper_ingot', orePerUnit: 6, melt: 1085, workMin: 500, workMax: 850, target: 650, quench: 600, strength: .62, retention: .55, durability: 58, color: '#c88d64' }
}
export const SECTION_PROFILES = {
  cutting: { area: .5, edge: 1, stiffness: .75 },
  diamond: { area: .5, edge: .78, stiffness: 1.25 },
  wedge: { area: .72, edge: .7, stiffness: 1.1 },
  rounded: { area: .785, edge: 0, stiffness: 1.3 }
}
export const POINTS = { needle: { pierce: 1, taper: .12 }, spear: { pierce: .85, taper: .22 }, rounded: { pierce: .08, taper: .7 }, flat: { pierce: 0, taper: 1 } }
export const FITTING_KINDS = ['handle', 'guard', 'pommel']
export const componentItems = kind => catalog.filter(item => item.component?.kind === kind)
const item = id => catalog.find(i => i.id === id)
const clamp = (v, lo, hi, fallback = lo) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : fallback))
const copy = value => JSON.parse(JSON.stringify(value))
export const customUnlocked = game => game.completedQuests.includes('dagger_forged')
export function newWeaponDesign() {
  return { version: 1, name: '', material: 'iron', ingots: 1, length: 20, point: 'spear', handle: 'handle_ash_short', guard: 'guard_iron', pommel: 'pommel_iron', controls: [{ x: .33, y: 0 }, { x: .67, y: 0 }, { x: 1, y: 0 }], sections: Array.from({ length: 3 }, () => ({ length: 1, width: 3.5, thickness: 5, profile: 'diamond', edge: 'both' })) }
}
export function normalizeDesign(raw) {
  if (!raw || !Array.isArray(raw.controls) || !Array.isArray(raw.sections) || raw.version !== 1 || !METALS[raw.material] || !POINTS[raw.point] || !FITTING_KINDS.every(kind => item(raw[kind])?.component?.kind === kind)) return null
  const ingots = Math.round(clamp(raw.ingots, 1, 12, 1)), count = ingots * 3
  return { version: 1, name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 48) : '', material: raw.material, ingots, length: clamp(raw.length, 20, 180, 40), point: raw.point, handle: raw.handle, guard: raw.guard, pommel: raw.pommel,
    controls: Array.from({ length: 3 }, (_, i) => ({ x: clamp(raw.controls?.[i]?.x, [.12, .35, .4][i], [.6, .9, 1.05][i], [.33, .67, 1][i]), y: clamp(raw.controls?.[i]?.y, -.55, .55, 0) })),
    sections: Array.from({ length: count }, (_, i) => { const section = raw.sections?.[i] || raw.sections?.at(-1) || {}; return { length: clamp(section.length, .2, 3, 1), width: clamp(section.width, 1, 12, 3.5), thickness: clamp(section.thickness, 2, 18, 5), profile: SECTION_PROFILES[section.profile] ? section.profile : 'diamond', edge: ['both', 'left', 'right', 'none'].includes(section.edge) ? section.edge : 'both' } }) }
}
export function resizeSections(design, ingots) {
  const previous = design.sections
  design.ingots = Math.round(clamp(ingots, 1, 12, 1))
  design.sections = Array.from({ length: design.ingots * 3 }, (_, i) => copy(previous[Math.min(previous.length - 1, Math.floor(i / (design.ingots * 3) * previous.length))]))
}
export function bladeGeometry(raw) {
  const d = normalizeDesign(raw)
  if (!d) return null
  const p = [{ x: 0, y: 0 }, ...d.controls]
  const points = Array.from({ length: 121 }, (_, i) => {
    const t = i / 120, s = 1 - t
    return { x: 3 * s * s * t * p[1].x + 3 * s * t * t * p[2].x + t ** 3 * p[3].x, y: 3 * s * s * t * p[1].y + 3 * s * t * t * p[2].y + t ** 3 * p[3].y }
  })
  const length = points.slice(1).reduce((total, v, i) => total + Math.hypot(v.x - points[i].x, v.y - points[i].y), 0)
  const scale = d.length / Math.max(.1, length)
  points.forEach(v => { v.x *= scale; v.y *= scale })
  const total = d.sections.reduce((sum, s) => sum + s.length, 0)
  const boundaries = [0]; d.sections.forEach(s => boundaries.push(boundaries.at(-1) + s.length / total))
  const samples = []; let travelled = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], distance = Math.hypot(b.x - a.x, b.y - a.y)
    const fraction = (travelled + distance / 2) / d.length
    const section = Math.min(d.sections.length - 1, boundaries.findIndex((v, index) => index && fraction <= v) - 1)
    const s = d.sections[Math.max(0, section)], profile = SECTION_PROFILES[s.profile]
    const tipStart = d.point === 'needle' ? .68 : d.point === 'spear' ? .84 : .94
    const tipFraction = Math.max(0, Math.min(1, (fraction - tipStart) / (1 - tipStart)))
    const tip = d.point === 'flat' ? 1 : d.point === 'rounded' ? Math.sqrt(1 - tipFraction ** 2) : 1 - tipFraction
    // Interpolate dimensions through section centres, preserving a continuous outline.
    const centres = d.sections.map((_, j) => (boundaries[j] + boundaries[j + 1]) / 2)
    const rightIndex = centres.findIndex(v => v >= fraction)
    const hi = rightIndex < 0 ? d.sections.length - 1 : rightIndex, lo = Math.max(0, hi - 1)
    const mix = lo === hi ? 0 : Math.max(0, Math.min(1, (fraction - centres[lo]) / (centres[hi] - centres[lo])))
    const smooth = mix * mix * (3 - 2 * mix)
    const interpolate = field => d.sections[lo][field] * (1 - smooth) + d.sections[hi][field] * smooth
    const width = interpolate('width') * tip, thickness = interpolate('thickness'), area = width * thickness / 10 * profile.area
    samples.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance, width, thickness, area, section: Math.max(0, section), volume: area * distance, angle: Math.atan2(b.y - a.y, b.x - a.x) })
    travelled += distance
  }
  const volume = samples.reduce((sum, s) => sum + s.volume, 0)
  return { points, samples, boundaries, volume, length: travelled, controlScale: scale }
}
export function designIssues(raw) {
  const d = normalizeDesign(raw), errors = [], warnings = []
  if (!d) return { errors: ['invalid'], warnings }
  const g = bladeGeometry(d)
  if (d.length > d.ingots * 20) errors.push('lengthBudget')
  if (g.volume > d.ingots * STOCK_VOLUME + .001) errors.push('metalBudget')
  if (d.controls.reduce((sum, p) => sum + Math.abs(p.y), 0) > 1.05) errors.push('bendBudget')
  if (d.controls[0].x >= d.controls[1].x) errors.push('folded')
  // Reject nonlocal intersections of the actual wide blade, not just its spine.
  for (let i = 0; i < g.samples.length; i++) for (let j = i + 10; j < g.samples.length; j++) {
    const a = g.samples[i], b = g.samples[j]
    if ((j - i) / 120 * d.length > (a.width + b.width) * .7 && Math.hypot(a.x - b.x, a.y - b.y) < (a.width + b.width) * .35) { if (!errors.includes('folded')) errors.push('folded') }
  }
  if (g.samples.some(s => s.x < -s.width / 2)) errors.push('gripCollision')
  if (item(d.handle).component.length > 200) errors.push('handleLength')
  const areas = d.sections.map(s => s.width * s.thickness * SECTION_PROFILES[s.profile].stiffness)
  if (areas.some((a, i) => i && Math.min(a, areas[i - 1]) / Math.max(a, areas[i - 1]) < .5)) warnings.push('weakTransition')
  if (Math.min(...areas) < 9 && d.length > 80) warnings.push('thinBlade')
  if (d.material === 'copper') warnings.push('softCopper')
  if (d.length > 100 && item(d.handle).component.length < 25) warnings.push('shortGrip')
  return { errors: [...new Set(errors)], warnings }
}
export function designRecipe(raw) {
  const d = normalizeDesign(raw)
  if (!d) return null
  const m = METALS[d.material]
  return { ore: m.ore, oreCount: d.ingots * m.orePerUnit, carbon: d.ingots, fuel: Math.ceil(d.ingots / 2), units: d.ingots, volume: d.ingots * STOCK_VOLUME, blankMass: d.ingots * STOCK_VOLUME * m.density / 1000, fittings: [d.guard, d.handle, d.pommel] }
}
export function designRequirements(game, raw) {
  const recipe = designRecipe(raw)
  if (!recipe || designIssues(raw).errors.length) return { valid: false, missing: [] }
  const quantity = (entries, id) => entries.reduce((n, e) => n + (e.itemId === id ? e.quantity : 0), 0)
  const all = [...game.inventory, ...game.storehouse]
  const requirements = [{ itemId: recipe.ore, quantity: recipe.oreCount, source: 'combined' }, { itemId: 'coal', quantity: recipe.carbon + Math.max(0, recipe.fuel - Math.ceil(game.workshop.fuel / 480)), source: 'combined' }, ...recipe.fittings.map(itemId => ({ itemId, quantity: 1, source: 'bag' }))]
  const missing = requirements.filter(r => quantity(r.source === 'bag' ? game.inventory : all, r.itemId) < r.quantity)
  if (game.workshop.fuel <= 0 && !quantity(game.inventory, 'coal') && !missing.some(r => r.itemId === 'coal')) missing.push({ itemId: 'coal', quantity: 1, source: 'bag' })
  return { valid: !missing.length, missing, requirements }
}
export function weaponHands(raw) { const d = normalizeDesign(raw); return d && (d.length + item(d.handle).component.length > 95 || item(d.handle).component.length > 25) ? 2 : 1 }
export function weaponStats(raw, craft = {}) {
  const d = normalizeDesign(raw), g = d && bladeGeometry(d)
  if (!g) return null
  const m = METALS[d.material], components = FITTING_KINDS.map(kind => ({ kind, ...item(d[kind]) }))
  const handle = item(d.handle).component, grip = -handle.length * .55
  const masses = g.samples.map(s => ({ ...s, mass: s.volume * m.density / 1000 }))
  const fittings = components.flatMap(c => c.kind === 'handle' ? Array.from({ length: 16 }, (_, i) => ({ x: -handle.length * (i + .5) / 16, y: 0, mass: c.weightKg / 16 })) : [{ x: c.kind === 'guard' ? 0 : -handle.length, y: 0, mass: c.weightKg }])
  const all = [...masses, ...fittings], weight = all.reduce((sum, p) => sum + p.mass, 0)
  const centre = { x: all.reduce((sum, p) => sum + p.x * p.mass, 0) / weight, y: all.reduce((sum, p) => sum + p.y * p.mass, 0) / weight }
  const inertia = all.reduce((sum, p) => sum + p.mass * ((p.x - grip) ** 2 + p.y ** 2), 0)
  const bend = g.samples.slice(1).reduce((sum, s, i) => sum + Math.abs(Math.atan2(Math.sin(s.angle - g.samples[i].angle), Math.cos(s.angle - g.samples[i].angle))), 0)
  const average = values => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)
  const sharpFor = index => craft.sharpness ? Math.max(0, Math.min(100, craft.sharpness[index] || 0)) / 100 : 1
  let cut = 0, intended = 0, dull = 0, effectiveSharpness = 0, edged = 0
  d.sections.forEach((s, i) => {
    const sectionMass = masses.filter(p => p.section === i).reduce((sum, p) => sum + p.mass, 0)
    const edgeFaces = s.profile === 'rounded' || s.edge === 'none' ? [] : s.edge === 'both' ? [0, 1] : [s.edge === 'left' ? 0 : 1]
    const sharp = edgeFaces.length ? average(edgeFaces.map(side => sharpFor(side * d.sections.length + i))) : 0
    if (edgeFaces.length) {
      edged += sectionMass; effectiveSharpness += sharp * sectionMass
      cut += sectionMass * SECTION_PROFILES[s.profile].edge * sharp * (1 + Math.min(2, bend) * .7)
      dull += sectionMass * (1 - sharp) * .38
    } else intended += sectionMass
  })
  const piercing = POINTS[d.point].pierce * (1 / (1 + bend * 2.5)) * (.3 + .7 * (edged ? effectiveSharpness / edged : 1)) * (1 + Math.max(0, .5 - centre.x / d.length)) * masses.reduce((sum, p) => sum + p.mass, 0)
  const blunt = intended * 1.4 + dull + weight * .06
  const sum = cut + piercing + blunt
  const cutRatio = Math.round(cut / sum * 1000) / 10, pierceRatio = Math.round(piercing / sum * 1000) / 10
  const ratios = { cut: cutRatio, pierce: pierceRatio, blunt: Math.max(0, Math.round((100 - cutRatio - pierceRatio) * 10) / 10) }
  const quality = clamp(craft.quality, 0, 100, 100) / 100
  const efficiency = edged ? .5 + .5 * effectiveSharpness / edged : 1
  const baseDamage = Math.max(1, 12 * weight ** .65 * (Math.max(20, d.length + handle.length) / 40) ** .2 * (.6 + m.strength * .4) * efficiency * (.4 + quality * .6))
  const weakest = Math.min(...d.sections.map(s => s.width * s.thickness * SECTION_PROFILES[s.profile].stiffness))
  const weak = designIssues(d).warnings.includes('weakTransition') ? .65 : 1
  const durability = Math.max(1, Math.round(m.durability * (.3 + quality * .7) * Math.min(1.3, weakest / 18) * weak))
  return { damage: Math.round(baseDamage * 10) / 10, ratios, weight: Math.round(weight * 1000) / 1000, centre, inertia, speed: Math.round(clamp(2.4 * (1 + Math.min(1, handle.length / 50) * .25) / (.7 + Math.sqrt(inertia / 1800)), .15, 3) * 100) / 100, durability, retention: m.retention, hands: weaponHands(d), reach: Math.round(d.length + handle.length), bluntness: Math.round((intended + dull) / Math.max(.001, intended + edged) * 100) }
}
export function cellNeedsEdge(design, cell) {
  const d = normalizeDesign(design)
  if (!d) return true
  const count = d.sections.length, section = d.sections[cell % count], side = Math.floor(cell / count)
  return section.profile !== 'rounded' && section.edge !== 'none' && (section.edge === 'both' || section.edge === (side === 0 ? 'left' : 'right'))
}
export function designPaths(raw, scale = 1) {
  const d = normalizeDesign(raw), g = d && bladeGeometry(d)
  if (!g) return []
  return d.sections.map((section, index) => {
    const indices = g.samples.map((p, i) => p.section === index ? i : -1).filter(i => i >= 0)
    if (!indices.length) return ''
    const first = indices[0], last = indices.at(-1)
    const join = (a, b) => Object.fromEntries(['x','y','angle','width'].map(k => [k, (a[k] + b[k]) / 2]))
    const samples = [first ? join(g.samples[first - 1], g.samples[first]) : { ...g.samples[first], x: 0, y: 0 }, ...indices.map(i => g.samples[i]), last < g.samples.length - 1 ? join(g.samples[last], g.samples[last + 1]) : { ...g.samples[last], ...g.points.at(-1), width: d.point === 'flat' ? g.samples[last].width : 0 }]
    const left = samples.map(p => [p.x - Math.sin(p.angle) * p.width / 2, p.y + Math.cos(p.angle) * p.width / 2])
    const right = samples.map(p => [p.x + Math.sin(p.angle) * p.width / 2, p.y - Math.cos(p.angle) * p.width / 2]).reverse()
    return [...left, ...right].map(([x, y], i) => `${i ? 'L' : 'M'}${x * scale} ${-y * scale}`).join(' ') + ' Z'
  })
}

export function customGrindingCells(design, x, depth, side) {
  const d = normalizeDesign(design), g = d && bladeGeometry(d)
  if (!g || ![0, 1].includes(side)) return []
  const scale = 170 / d.length, origin = Math.max(0, Math.min(1, x)) * 400 - 85
  const flatten = .35 + Math.max(0, Math.min(1, depth)) * .65
  return [...new Set(g.samples.filter(s => {
    const px = origin + s.x * scale, py = 190 - s.y * scale * flatten
    return px + s.width * scale / 2 >= 170 && px - s.width * scale / 2 <= 230 && py + s.width * scale * flatten / 2 >= 108 && py - s.width * scale * flatten / 2 <= 284
  }).map(s => side * d.sections.length + s.section))].filter(i => cellNeedsEdge(d, i))
}
export function statsForEntry(entry) {
  if (!entry) return null
  if (entry.craft?.design) return weaponStats(entry.craft.design, entry.craft)
  const source = item(entry.itemId)
  if (!['melee', 'bow'].includes(source?.weaponType) && entry.itemId !== 'javelins') return null
  const profiles = { dagger: [10, 35, 60, 5], arming_sword: [22, 60, 30, 10], greatsword: [34, 65, 20, 15], hunting_bow: [18, 0, 95, 5], javelins: [20, 0, 90, 10] }
  const [damage, cut, pierce, blunt] = profiles[entry.itemId] || [12, 35, 45, 20]
  const quality = (entry.craft?.quality ?? 100) / 100
  const sharp = entry.craft?.sharpness?.length ? entry.craft.sharpness.reduce((a,b) => a + b, 0) / entry.craft.sharpness.length / 100 : 1
  const rawCut = cut * sharp, rawPierce = pierce * (.5 + sharp * .5), rawBlunt = blunt + cut * (1 - sharp) * .35 + pierce * (1 - sharp) * .1
  const sum = rawCut + rawPierce + rawBlunt, cutShare = Math.round(rawCut / sum * 1000) / 10, pierceShare = Math.round(rawPierce / sum * 1000) / 10
  return { damage: Math.round(damage * (.4 + .6 * quality) * (.5 + .5 * sharp) * 10) / 10, ratios: { cut: cutShare, pierce: pierceShare, blunt: Math.round((100 - cutShare - pierceShare) * 10) / 10 }, weight: source.weightKg, speed: source.hands === 2 ? .8 : 1.5, durability: Math.round(100 * (.3 + .7 * quality)), hands: source.hands || 1, reach: entry.itemId === 'dagger' ? 32 : 100, centre: { x: entry.itemId === 'dagger' ? 8 : 25, y: 0 }, bluntness: blunt }
}
