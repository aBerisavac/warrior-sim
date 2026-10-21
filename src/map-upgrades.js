export const UPGRADE_TIERS = ['straw', 'mud', 'wood', 'stone']

const artNames = {
  smithy: 'Blacksmith.png', market: 'Market.png', square: 'Town_Square.png',
  tavern: 'Tavern.png', barracks: 'Barracks.png', chapel: 'Chapel.png',
  gate: 'South_Gate.png', northGate: 'North_Gate.png',
  eastGate: 'East_Gate.png', westGate: 'West_Gate.png',
}

export function structureTier(tiers, id) {
  return UPGRADE_TIERS.includes(tiers?.[id]) ? tiers[id] : UPGRADE_TIERS[0]
}

export function structureImage(structure, tiers = {}) {
  const tier = structureTier(tiers, structure.id)
  const source = structure.imageSrc
  if (source) {
    const match = source.match(/^\/images\/(straw|mud|wood|stone)\/([^/]+)$/)
    return match ? `/images/${tier}/${match[2]}` : source
  }
  const name = artNames[structure.id]
  return name ? `/images/${tier}/${name}` : null
}
