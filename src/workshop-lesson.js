import { readyToPour, readyForAnvil, readyForQuench } from './workshop'
import { itemQuantity } from './inventory'

const exchange = (id, speakers) => ({ id, lines: speakers.map((speaker, index) => ({ speaker: speaker === 'thought' ? 'player' : speaker, thought: speaker === 'thought', key: `forgeLesson.${id}.${index}` })) })
export const workshopLessons = Object.fromEntries([
  exchange('ore', ['father', 'player', 'thought']),
  exchange('reducer', ['father', 'player']),
  exchange('fuel', ['father', 'thought']),
  exchange('crucible', ['father']),
  exchange('bellows', ['father', 'player']),
  exchange('melting', ['father', 'thought']),
  exchange('pour', ['father', 'player']),
  exchange('ruined', ['father', 'thought']),
  exchange('residue', ['father']),
  exchange('collect', ['father']),
  exchange('ingot', ['father', 'player']),
  exchange('heatBlade', ['father']),
  exchange('hammer', ['father', 'player', 'thought']),
  exchange('reheat', ['father']),
  exchange('shape', ['father']),
  exchange('quenchHeat', ['father']),
  exchange('quench', ['father', 'player']),
  exchange('guard', ['father', 'thought']),
  exchange('handle', ['father', 'player']),
  exchange('pommel', ['father', 'player']),
  exchange('grind', ['father']),
  exchange('finished', ['player', 'father', 'player', 'thought'])
].map(lesson => [lesson.id, lesson]))

export function nextWorkshopLesson(game) {
  const w = game.workshop, c = w.crucible, b = w.blade
  const seen = w.lessonSeen || []
  const offer = id => seen.includes(id) ? null : workshopLessons[id]
  if (w.lessonFinishPending) return offer('finished')
  if (!w.working || game.completedQuests.includes('dagger_forged') || !game.completedQuests.includes('iron_stock_bought') || w.pour || b?.quenching) return null
  if (w.mould?.ruined) return offer('ruined')
  if (c.stage === 'residue') return offer('residue')
  if (w.mould) return w.mould.remaining === 0 ? offer('collect') : null
  if (b) {
    if (b.stage === 'assembled') return offer('grind')
    if (b.stage === 'quenched') return offer(['guard', 'handle', 'pommel'][b.parts] || 'pommel')
    if (b.stage === 'shaped') return readyForQuench(b) ? offer('quench') : offer('quenchHeat')
    if (b.work.every(v => v > 0)) return offer('shape')
    if (readyForAnvil(b)) return offer('hammer')
    if (!b.heating && b.work.some(v => v > 0)) return offer('reheat')
    return offer('heatBlade')
  }
  if (w.rack.some(e => e.itemId === 'iron_ingot') || itemQuantity(game.inventory, 'iron_ingot')) return offer('ingot')
  if (c.stage === 'molten') return readyToPour(c) ? offer('pour') : offer('melting')
  if (c.stage === 'melting') return offer('melting')
  if (c.stage === 'reducing') return offer('bellows')
  if (c.count === 4 && !c.carbon) return offer('reducer')
  if (c.count === 4 && c.carbon && !w.fuel) return offer('fuel')
  if (c.count === 4 && c.carbon && w.fuel) return offer('crucible')
  if (c.stage === 'empty' || c.stage === 'loaded') return offer('ore')
  return null
}
