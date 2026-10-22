import { reactive } from 'vue'
import catalog from './data/audio.json'
export const audioCatalog = catalog
export const AUDIO_SETTINGS_KEY = 'briarwick-audio-v1'
export const audioGroups = ['music', 'ambience', 'woodcutting', 'forge', 'dishes', 'travel', 'interface', 'dialogue', 'encounters']
export const encounterCue = tone => ({ bad: 'encounterBad', good: 'encounterGood', neutral: 'encounterNeutral' }[tone] || 'encounterNeutral')
export function defaultAudioSettings() {
  return { muted: false, master: .7, groups: { music: .4, ambience: .6, woodcutting: .75, forge: .7, dishes: .65, travel: .45, interface: .55, dialogue: .5, encounters: .65 }, sounds: Object.fromEntries(Object.keys(catalog).map(id => [id, { volume: 1, muted: false }])) }
}
const volume = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
export function normalizeAudioSettings(saved) {
  const defaults = defaultAudioSettings()
  return { muted: saved?.muted === true, master: volume(saved?.master, defaults.master), groups: Object.fromEntries(audioGroups.map(id => [id, volume(saved?.groups?.[id], defaults.groups[id])])), sounds: Object.fromEntries(Object.keys(catalog).map(id => [id, { volume: volume(saved?.sounds?.[id]?.volume, 1), muted: saved?.sounds?.[id]?.muted === true }])) }
}
export function readAudioSettings(storage) {
  try { return normalizeAudioSettings(JSON.parse(storage.getItem(AUDIO_SETTINGS_KEY))) } catch { return defaultAudioSettings() }
}
export function soundVolume(settings, id) {
  const cue = catalog[id], item = settings.sounds[id]
  return !cue || settings.muted || item?.muted ? 0 : settings.master * settings.groups[cue.group] * item.volume * cue.gain
}
export function sceneSounds({ mapView, location, traveling, walking, woodcutting, fuel, raining }) {
  const rain = raining ? mapView === 'forge' || location === 'tavern' || woodcutting ? ['rainIndoor'] : location === 'market' ? ['rainMarket'] : ['rainOutdoor'] : []
  if (woodcutting) return ['innMusic', 'birds', ...rain]
  if (mapView === 'forge') return [...(fuel > 0 ? ['innMusic', 'fire'] : ['innMusic']), ...rain]
  if (!traveling && location === 'market') return ['villageMusic', 'marketCrowd', ...rain]
  if (!traveling && location === 'tavern') return ['innMusic', 'fire', ...rain]
  return walking ? ['villageMusic', 'birds', 'footstep', ...rain] : ['villageMusic', 'birds', ...rain]
}

export function seamlessLoop(context, buffer, overlapSeconds) {
  if (!overlapSeconds || !buffer.numberOfChannels || !buffer.length) return buffer
  const overlap = Math.min(Math.round(buffer.sampleRate * overlapSeconds), Math.floor(buffer.length / 4))
  if (overlap < 2) return buffer
  const result = context.createBuffer(buffer.numberOfChannels, buffer.length - overlap, buffer.sampleRate)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const input = buffer.getChannelData(channel), output = result.getChannelData(channel)
    output.set(input.subarray(overlap))
    for (let i = 0; i < overlap; i++) {
      const mix = (i + 1) / overlap
      output[output.length - overlap + i] = input[input.length - overlap + i] * (1 - mix) + input[i] * mix
    }
  }
  return result
}

// One shared mixer. Browsers may require a user gesture before audible playback.
export function createAudioEngine({ settings, makeContext, fetchAudio, isHidden } = {}) {
  let config = normalizeAudioSettings(settings), context, desired = [], disposed = false
  const buffers = new Map(), loops = new Map(), voices = new Set(), lastPlay = new Map(), lastSample = new Map(), holds = new Map()
  const status = reactive({ unlocked: false, unavailable: false, failed: [] })
  const hidden = () => isHidden ? isHidden() : typeof document !== 'undefined' && document.hidden
  const oggSupported = typeof Audio === 'undefined' || !!new Audio().canPlayType('audio/ogg; codecs="vorbis"')
  function target(id, scale = 1) { return soundVolume(config, id) * scale }
  function gainTo(voice, value, seconds = .12) {
    if (!context) return
    const now = context.currentTime
    const current = voice.gain.gain.value
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(current, now)
    voice.gain.gain.linearRampToValueAtTime(value, now + seconds)
  }
  async function bufferFor(id) {
    const cue = catalog[id]
    const choices = cue.avoidRepeat && cue.files?.length > 1 ? cue.files.filter(file => file !== lastSample.get(id)) : cue.files
    const filename = choices ? choices[Math.floor(Math.random() * choices.length)] : cue.file
    if (cue.avoidRepeat) lastSample.set(id, filename)
    const key = filename || cue.synthesis
    if (!buffers.has(key)) {
      const pending = (async () => {
        if (cue.synthesis) {
          const rate = context.sampleRate, length = Math.floor(rate * (cue.synthesis === 'speech' ? .045 : cue.synthesis === 'air' ? .8 : cue.synthesis === 'cart' ? 7 : 2)), result = context.createBuffer(1, length, rate), samples = result.getChannelData(0)
          let seed = 7319, smooth = 0
          for (let i = 0; i < length; i++) {
            if (cue.synthesis.startsWith('encounter')) {
              const notes = cue.synthesis === 'encounterBad' ? [220, 207.65, 164.81, 146.83] : cue.synthesis === 'encounterGood' ? [261.63, 329.63, 392, 523.25] : [293.66, 329.63, 293.66]
              const time = i / rate
              samples[i] = notes.reduce((sum, frequency, n) => {
                const age = time - n * .19
                return age < 0 ? sum : sum + (Math.sin(age * frequency * Math.PI * 2) + .18 * Math.sin(age * frequency * Math.PI * 4)) * Math.min(1, age / .018) * Math.exp(-age * 4.5) * .22
              }, 0) * Math.min(1, (length - i) / (rate * .08))
              continue
            }
            if (cue.synthesis === 'speech') { samples[i] = Math.sin(i / rate * Math.PI * 2 * 520) * .5 * Math.sin(Math.PI * i / length) ** 2; continue }
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
            const noise = seed / 2147483648 - 1
            smooth = smooth * .85 + noise * .15
            if (cue.synthesis === 'squirrelScratch') {
              const t = i / rate, stroke = Math.max(0, Math.sin(t * Math.PI * 2 * 4.5)) ** 4
              const fade = Math.sin(Math.PI * i / length) ** 1.5
              samples[i] = (noise * .24 + smooth * .16) * stroke * fade
              continue
            }
            if (cue.synthesis === 'cart') {
              const t = i / rate, pass = Math.sin(Math.PI * i / length) ** 2
              const knock = Math.exp(-((t * 9) % 1) * 24)
              samples[i] = (smooth * .35 + Math.sin(t * 2 * Math.PI * (135 + 20 * Math.sin(t * 4))) * knock * .2) * pass
              continue
            }
            const envelope = cue.synthesis === 'air' ? Math.sin(Math.PI * i / length) : 1
            samples[i] = (cue.synthesis === 'grind' ? noise * .4 + Math.sin(i * .41) * .06 : cue.synthesis === 'steam' ? noise * .5 : smooth * 1.6) * envelope
          }
          return result
        }
        const alternatives = filename.endsWith('.ogg')
          ? oggSupported ? [filename, filename.replace(/\.ogg$/, '.mp3')] : [filename.replace(/\.ogg$/, '.mp3'), filename]
          : [filename]
        for (const file of alternatives) {
          try {
            const response = await (fetchAudio || fetch)('/audio/' + file)
            if (!response.ok) continue
            const decoded = await context.decodeAudioData(await response.arrayBuffer())
            return seamlessLoop(context, decoded, cue.loopCrossfade)
          } catch { /* Try the other supported format. */ }
        }
        throw new Error('audio file unavailable')
      })().catch(() => { buffers.delete(key); if (!status.failed.includes(id)) status.failed.push(id); return null })
      buffers.set(key, pending)
    }
    return buffers.get(key)
  }
  function stopVoice(voice, fade = .2) {
    if (!voice || voice.stopping) return
    voice.stopping = true; clearTimeout(voice.driftTimer); gainTo(voice, 0, fade)
    if (voice.id.startsWith('rain') && fade > .03) {
      // Keep the loop alive during its fade so a returning shower can reverse it.
      voice.stopTimer = setTimeout(() => {
        voice.stopTimer = null
        try { voice.source.stop() } catch { /* Already ended. */ }
      }, (fade + .02) * 1000)
    } else {
      try { voice.source.stop(context.currentTime + fade + .02) } catch { /* Already ended. */ }
    }
  }
  function drift(voice) {
    if (voice.stopping || disposed) return
    const cue = catalog[voice.id], seconds = 2 + Math.random() * 2, now = context.currentTime
    const [lowRate, highRate] = cue.rateRange, [lowVolume, highVolume] = cue.volumeRange
    const rate = voice.source.playbackRate
    rate.cancelScheduledValues(now); rate.setValueAtTime(rate.value, now)
    rate.linearRampToValueAtTime(lowRate + Math.random() * (highRate - lowRate), now + seconds)
    voice.scale = lowVolume + Math.random() * (highVolume - lowVolume)
    gainTo(voice, target(voice.id, voice.scale), seconds)
    voice.driftTimer = setTimeout(() => drift(voice), seconds * 1000)
  }
  async function start(id, loop, scale = 1, rate = 1, duration) {
    if (!status.unlocked || disposed || !catalog[id] || target(id, scale) <= 0) return null
    const buffer = await bufferFor(id)
    if (!buffer || disposed || !status.unlocked || target(id, scale) <= 0) return null
    const source = context.createBufferSource(), gain = context.createGain()
    source.buffer = buffer; source.loop = loop; source.playbackRate.value = rate
    source.connect(gain); gain.connect(context.destination)
    const voice = { id, source, gain, scale, stopping: false }
    voices.add(voice)
    gain.gain.value = loop ? 0 : target(id, scale)
    if (loop) gainTo(voice, target(id, scale), catalog[id].fadeIn ?? .8)
    if (loop && catalog[id].smoothVariation) voice.driftTimer = setTimeout(() => drift(voice), (catalog[id].fadeIn ?? .8) * 1000)
    source.onended = () => { clearTimeout(voice.driftTimer); clearTimeout(voice.stopTimer); voices.delete(voice); source.disconnect(); gain.disconnect() }
    if (duration) source.start(0, 0, Math.min(duration, buffer.duration))
    else source.start()
    return voice
  }
  async function syncLoops() {
    if (!status.unlocked || disposed) return
    const wanted = new Set([...desired, ...holds.keys()])
    for (const [id, slot] of loops) if (!wanted.has(id) || target(id) <= 0) { if (slot.voice) stopVoice(slot.voice, target(id) <= 0 ? .03 : catalog[id].fadeOut ?? .6); loops.delete(id) }
    for (const id of wanted) {
      if (!catalog[id]?.loop || target(id) <= 0) continue
      if (loops.has(id)) continue
      const slot = { voice: null }; loops.set(id, slot)
      const fadingRain = id.startsWith('rain') && [...voices].find(voice => voice.id === id && voice.stopping && voice.stopTimer)
      if (fadingRain) {
        clearTimeout(fadingRain.stopTimer)
        fadingRain.stopTimer = null
        fadingRain.stopping = false
        gainTo(fadingRain, target(id, fadingRain.scale), catalog[id].fadeIn ?? .8)
        slot.voice = fadingRain
      } else slot.voice = await start(id, true)
      if (loops.get(id) !== slot || disposed) stopVoice(slot.voice)
      else if (!slot.voice) loops.delete(id)
    }
  }
  function ensureContext() {
    if (context) return context
    const Context = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    context = makeContext ? makeContext() : Context ? new Context() : null
    if (!context) { status.unavailable = true; return null }
    context.onstatechange = () => {
      if (disposed) return
      status.unlocked = context.state === 'running'
      if (status.unlocked) void syncLoops()
    }
    return context
  }
  function tryAutoplay() {
    if (disposed || status.unavailable) return
    if (typeof navigator !== 'undefined' && /iP(?:hone|ad|od)/.test(navigator.userAgent)) return
    try {
      if (!ensureContext()) return
      if (context.state === 'running') { status.unlocked = true; void syncLoops() }
      else if (context.state !== 'closed') void context.resume().then(() => {
        if (disposed) return
        status.unlocked = context.state === 'running'
        if (status.unlocked) void syncLoops()
      }).catch(() => { /* A later user gesture can unlock blocked autoplay. */ })
    } catch { status.unlocked = false }
  }
  async function unlock() {
    if (disposed || status.unavailable) return
    try {
      if (!ensureContext()) return
      if (context.state !== 'running' && context.state !== 'closed') await context.resume()
      status.unlocked = context.state === 'running'
      if (status.unlocked) void syncLoops()
    } catch { status.unlocked = false }
  }
  function play(id, { scale = 1, rate, duration } = {}) {
    if (!status.unlocked || disposed || !catalog[id] || target(id) <= 0) return
    const now = Date.now()
    if (now - (lastPlay.get(id) || 0) < 75) return
    lastPlay.set(id, now)
    if (voices.size > 18) return
    const cue = catalog[id]
    const [lowRate, highRate] = cue.rateRange || [.96, 1.04]
    const [lowVolume, highVolume] = cue.volumeRange || [1, 1]
    const variation = lowVolume + Math.random() * (highVolume - lowVolume)
    void start(id, false, scale * variation, rate || lowRate + Math.random() * (highRate - lowRate), duration)
  }
  function hold(id, milliseconds = 180) {
    if (!status.unlocked || disposed) return
    clearTimeout(holds.get(id)); holds.set(id, setTimeout(() => release(id), milliseconds)); void syncLoops()
  }
  function release(id) { clearTimeout(holds.get(id)); holds.delete(id); void syncLoops() }
  function configure(next) {
    config = normalizeAudioSettings(next)
    for (const voice of voices) if (!voice.stopping) gainTo(voice, target(voice.id, voice.scale), .08)
    void syncLoops()
  }
  function setScene(next) { desired = [...new Set(next)]; void syncLoops() }
  function visibilityChanged() {
    if (hidden()) {
      for (const id of [...holds.keys()]) release(id)
    } else if (context && context.state !== 'running') {
      status.unlocked = false
      void unlock()
    } else void syncLoops()
  }
  async function dispose() {
    disposed = true
    for (const timer of holds.values()) clearTimeout(timer)
    holds.clear(); desired = []; loops.clear()
    for (const voice of voices) { clearTimeout(voice.driftTimer); clearTimeout(voice.stopTimer); try { voice.source.stop() } catch { /* Already ended. */ } }
    voices.clear()
    if (context && context.state !== 'closed') { try { await context.close() } catch { /* Browser may have already closed the device. */ } }
  }
  async function preview(id) { await unlock(); play(id, { duration: 2, rate: 1 }) }
  return { status, tryAutoplay, unlock, configure, play, hold, release, setScene, visibilityChanged, dispose, preview }
}

let activeEngine = null
export function useGameAudio(engine) { activeEngine = engine }
export function playSound(id, options) { activeEngine?.play(id, options) }
