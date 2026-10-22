import townMap from './data/town-map.json'
import characters from './data/characters.json'
import audioCatalog from './data/audio.json'
import { items } from './inventory'
import { structureImage } from './map-upgrades'

export const MAP_LOADING = {
  town: {
    titleKey: 'loading.town', returnKey: 'loading.townReturn', arrivalKey: 'loading.townArrival',
    characters: ['player', 'father', 'merchant', 'innkeeper', 'notice'],
    sounds: ['villageMusic', 'innMusic', 'birds', 'marketCrowd', 'marketCallout', 'marketHorse', 'footstep', 'door', 'rainOutdoor', 'eagle'],
  },
  forge: {
    titleKey: 'loading.forge',
    images: ['/images/interior/Medieval Blacksmith’s Forge and Shop.png'],
    characters: ['player', 'father'],
    sounds: ['innMusic', 'fire', 'coal', 'metal', 'pour', 'hammer', 'door', 'rainIndoor'],
  },
}

export function mapAssetUrls(mapId, tiers = {}, map = townMap) {
  const config = MAP_LOADING[mapId]
  if (!config) return []
  const urls = [...(config.images || []), ...Object.values(items).map(item => item.imageSrc)]
  for (const id of config.characters) {
    const character = characters[id]
    urls.push(character?.portraitSrc, character?.sceneSrc)
  }
  if (mapId === 'town') {
    urls.push(...Object.values(map.tileImages || {}))
    urls.push(...(map.cellImages || []).map(image => image.src))
    urls.push(...(map.buildings || []).map(building => structureImage(building, tiers)))
    urls.push(...(map.gates || []).map(gate => structureImage(gate, tiers)))
  }
  for (const id of config.sounds) {
    const cue = audioCatalog[id]
    if (cue?.file) urls.push('/audio/' + (cue.file.endsWith('.ogg') ? cue.file.replace(/\.ogg$/, '.mp3') : cue.file))
    for (const file of cue?.files || []) urls.push('/audio/' + (file.endsWith('.ogg') ? file.replace(/\.ogg$/, '.mp3') : file))
  }
  return [...new Set(urls.filter(Boolean))]
}

function preloadAsset(url) {
  if (url.startsWith('/audio/')) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    return fetch(url, { signal: controller.signal }).then(response => response.ok ? response.blob() : null).catch(() => null).finally(() => clearTimeout(timer))
  }
  return new Promise(resolve => {
    const image = new Image()
    const timer = setTimeout(finish, 8000)
    function finish() { clearTimeout(timer); image.onload = null; image.onerror = null; resolve() }
    image.onload = () => { if (image.decode) void image.decode().catch(() => {}).finally(finish); else finish() }
    image.onerror = finish
    image.src = url
  })
}

export async function preloadMapAssets(mapId, tiers, onProgress, map = townMap, load = preloadAsset) {
  const urls = mapAssetUrls(mapId, tiers, map)
  let completed = 0, cursor = 0
  onProgress?.(completed, urls.length)
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++]
      try { await load(url) } catch { /* An unavailable asset must not trap the player on the loading screen. */ }
      onProgress?.(++completed, urls.length)
    }
  }))
}
