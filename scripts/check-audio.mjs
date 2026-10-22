import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createSSRApp, createRenderer, h, nextTick, ssrContextKey } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createI18n } from 'vue-i18n'

const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve)) }
class FakeContext {
  constructor() { this.state = 'suspended'; this.currentTime = 10; this.sampleRate = 8000; this.destination = {}; this.sources = []; this.gains = [] }
  async resume() { this.state = 'running'; this.onstatechange?.() }
  async close() { this.state = 'closed'; this.onstatechange?.() }
  async decodeAudioData() { return { duration: 10 } }
  createBuffer(_, length) { const samples = new Float32Array(length); return { duration: length / this.sampleRate, getChannelData: () => samples } }
  createBufferSource() {
    const source = { playbackRate: { value: 1, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value }, linearRampToValueAtTime(value, time) { this.ramp = { value, time } } }, connect() {}, disconnect() {}, start(...args) { this.started = true; this.startArguments = args }, stop() { this.stopped = true; queueMicrotask(() => this.onended?.()) } }
    this.sources.push(source); return source
  }
  createGain() {
    const result = { gain: { value: 0, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v }, linearRampToValueAtTime(v, time) { this.value = v; this.lastRamp = time } }, connect() {}, disconnect() {} }
    this.gains.push(result); return result
  }
  active() { return this.sources.filter(s => s.started && !s.stopped) }
}
try {
  const { audioCatalog, audioGroups, defaultAudioSettings, normalizeAudioSettings, readAudioSettings, soundVolume, sceneSounds, seamlessLoop, createAudioEngine, useGameAudio } = await server.ssrLoadModule('/src/audio.js')
  const settings = defaultAudioSettings()
  const stored = normalizeAudioSettings({ ...settings, muted: true, master: .33, groups: { ...settings.groups, forge: 0 } })
  assert.deepEqual(readAudioSettings({ getItem: () => JSON.stringify(stored) }), stored)
  assert.equal(readAudioSettings({ getItem() { throw Error('denied') } }).master, settings.master)
  assert.deepEqual(readAudioSettings({ getItem: () => 'broken JSON' }), settings)
  const invalid = normalizeAudioSettings({ master: 20, muted: 'yes', groups: { music: -4 }, sounds: { hammer: { volume: NaN, muted: true } } })
  assert.equal(invalid.master, 1); assert.equal(invalid.groups.music, 0); assert.equal(invalid.muted, false); assert.equal(invalid.sounds.hammer.volume, 1)
  assert.equal(soundVolume(settings, 'hammer'), settings.master * settings.groups.forge * audioCatalog.hammer.gain)
  const muted = normalizeAudioSettings({ ...settings, muted: true }); assert.equal(soundVolume(muted, 'hammer'), 0)
  assert.deepEqual(sceneSounds({ mapView: 'forge', fuel: 0 }), ['innMusic'])
  assert.deepEqual(sceneSounds({ mapView: 'forge', fuel: 1 }), ['innMusic', 'fire'])
  assert.deepEqual(sceneSounds({ mapView: 'forge', fuel: 1, raining: true }), ['innMusic', 'fire', 'rainIndoor'])
  assert.deepEqual(sceneSounds({ location: 'market', traveling: false, raining: true }), ['villageMusic', 'marketCrowd', 'rainMarket'])
  assert.deepEqual(sceneSounds({ location: 'smithy', traveling: false, raining: true }), ['villageMusic', 'birds', 'rainOutdoor'])
  assert.deepEqual(sceneSounds({ location: 'tavern', traveling: false }), ['innMusic', 'fire'])
  assert.deepEqual(sceneSounds({ location: 'tavern', traveling: true }), ['villageMusic', 'birds'])
  assert.deepEqual(sceneSounds({ location: 'market', traveling: false }), ['villageMusic', 'marketCrowd'])
  assert.deepEqual(sceneSounds({ location: 'market', traveling: true, walking: true }), ['villageMusic', 'birds', 'footstep'])
  assert.deepEqual(sceneSounds({ woodcutting: true }), ['innMusic', 'birds'])

  const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url)))
  const files = new Set()
  for (const [id, cue] of Object.entries(audioCatalog)) {
    assert(audioGroups.includes(cue.group)); assert(en.audio.sounds[id], id); assert(cue.credit)
    for (const file of cue.files || (cue.file ? [cue.file] : [])) files.add(file)
  }
  for (const file of files) {
    const data = readFileSync(new URL('../public/audio/' + file, import.meta.url))
    assert(data.length > 1000, file)
    if (file.endsWith('.ogg')) {
      assert(data.includes(Buffer.from('vorbis')), file + ' Vorbis codec')
      let offset = 0, lastType = 0
      while (offset < data.length) {
        assert.equal(data.toString('ascii', offset, offset + 4), 'OggS', file + ' complete Ogg pages')
        const segments = data[offset + 26]
        let size = 0
        for (let i = 0; i < segments; i++) size += data[offset + 27 + i]
        lastType = data[offset + 5]; offset += 27 + segments + size
      }
      assert.equal(offset, data.length); assert(lastType & 4, file + ' end-of-stream page')
    } else if (file.endsWith('.wav')) { assert.equal(data.toString('ascii', 0, 4), 'RIFF'); assert.equal(data.toString('ascii', 8, 12), 'WAVE') } else assert(data.toString('ascii', 0, 3) === 'ID3' || data[0] === 255, file + ' MP3 header')
  }
  assert(readFileSync(new URL('../public/audio/CREDITS.md', import.meta.url), 'utf8').includes('CC0'))

  const inputSamples = Float32Array.from({ length: 100 }, (_, i) => i / 100)
  const stitched = seamlessLoop({ createBuffer: (_, length) => { const samples = new Float32Array(length); return { getChannelData: () => samples } } }, { sampleRate: 100, length: 100, numberOfChannels: 1, getChannelData: () => inputSamples }, .1).getChannelData(0)
  assert.equal(stitched.length, 90)
  assert(Math.abs(stitched.at(-1) - stitched[0]) < .02, 'Loop overlap removes the abrupt tail-to-head discontinuity')
  assert(stitched.every(value => Number.isFinite(value) && Math.abs(value) <= 1))

  let hidden = false, fetched = 0
  const ctx = new FakeContext()
  const engine = createAudioEngine({ settings, makeContext: () => ctx, isHidden: () => hidden, fetchAudio: async () => { fetched++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) } } })
  engine.setScene(['villageMusic', 'birds']); engine.play('hammer'); await flush()
  assert.equal(fetched, 0, 'Nothing loads or plays before a gesture')
  await engine.unlock(); await flush(); assert.equal(ctx.active().length, 2)
  const count = fetched; engine.setScene(['villageMusic', 'birds']); await flush(); assert.equal(fetched, count, 'Steady scenes do not restart tracks')
  engine.configure(muted); await flush(); assert.equal(ctx.active().length, 0)
  engine.configure(settings); await flush(); assert.equal(ctx.active().length, 2)
  const cueMuted = normalizeAudioSettings(settings); cueMuted.sounds.birds.muted = true
  engine.configure(cueMuted); await flush(); assert.equal(ctx.active().length, 1, 'Per-sound mute leaves other tracks running')
  engine.configure(settings); await flush()
  engine.hold('grind'); await flush(); assert.equal(ctx.active().length, 3)
  engine.release('grind'); await flush(); assert.equal(ctx.active().length, 2)
  hidden = true; engine.visibilityChanged(); await flush(); assert.equal(ctx.active().length, 2, 'Ambient loops keep playing in a background tab')
  engine.play('coins'); await flush(); assert.equal(ctx.active().length, 3, 'One-shot cues can play in a background tab')
  ctx.active().find(source => !source.loop).stop(); await flush()
  hidden = false; engine.visibilityChanged(); await flush(); assert.equal(ctx.active().length, 2)
  engine.setScene(['villageMusic', 'birds', 'footstep']); await flush()
  const walkingSource = ctx.active().find(source => source.buffer && source.loop && source !== ctx.active()[0] && source !== ctx.active()[1])
  assert(walkingSource, 'Walking is a continuously looping source')
  const walkingSourceCount = ctx.sources.length
  engine.setScene(['villageMusic', 'birds', 'footstep']); await flush()
  assert.equal(ctx.sources.length, walkingSourceCount, 'Steady walking does not restart the recording')
  await new Promise(resolve => setTimeout(resolve, 280))
  assert(walkingSource.playbackRate.ramp, 'Walking pitch is automated with a smooth ramp')
  assert(walkingSource.playbackRate.ramp.value >= .96 && walkingSource.playbackRate.ramp.value <= 1.04)
  assert(walkingSource.playbackRate.ramp.time >= ctx.currentTime + 2)
  engine.setScene(['villageMusic', 'birds']); await flush()
  assert(walkingSource.stopped, 'Pausing or ending movement stops the loop')
  engine.setScene(['innMusic', 'fire']); await flush(); assert.equal(ctx.active().length, 2, 'Scene changes replace previous loops')
  await engine.preview('hammer'); await flush(); assert(ctx.active().some(s => s.startArguments[2] === 2), 'Previews are limited to two seconds')
  await engine.dispose(); await flush(); assert.equal(ctx.active().length, 0); assert.equal(ctx.state, 'closed')
  const allowedContext = new FakeContext(); allowedContext.state = 'running'
  const allowed = createAudioEngine({ settings, makeContext: () => allowedContext, fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }) })
  allowed.setScene(['birds']); allowed.tryAutoplay(); await flush(); assert.equal(allowedContext.active().length, 1, 'Allowed autoplay starts the scene on load')
  await allowed.dispose()
  const blockedContext = new FakeContext(); blockedContext.resume = () => new Promise(() => {})
  const blocked = createAudioEngine({ settings, makeContext: () => blockedContext, fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }) })
  blocked.setScene(['birds']); blocked.tryAutoplay(); await flush(); assert.equal(blockedContext.active().length, 0, 'Blocked autoplay stays silent')
  blockedContext.resume = FakeContext.prototype.resume
  await blocked.unlock(); await flush(); assert.equal(blockedContext.active().length, 1, 'A gesture unlocks audio even after a pending autoplay attempt')
  await blocked.dispose()
  const { encounterCue } = await server.ssrLoadModule('/src/audio.js')
  assert.equal(encounterCue('unknown'), 'encounterNeutral')
  const encounterContext = new FakeContext()
  const encounterMixer = createAudioEngine({ settings, makeContext: () => encounterContext, isHidden: () => false })
  await encounterMixer.unlock()
  for (const tone of ['bad', 'good', 'neutral']) encounterMixer.play(encounterCue(tone))
  await flush(); assert.equal(encounterContext.active().length, 3)
  const waveforms = encounterContext.active().map(source => source.buffer.getChannelData(0))
  assert(waveforms.every(samples => samples.some(value => Math.abs(value) > .01)), 'Every encounter cue has audible samples')
  assert(waveforms.every(samples => samples.every(value => Math.abs(value) <= 1)), 'Encounter cues do not clip')
  assert(waveforms[0].some((value, i) => value !== waveforms[1][i])); assert(waveforms[1].some((value, i) => value !== waveforms[2][i]))
  assert.equal(normalizeAudioSettings({ master: .4, groups: { music: .2 } }).groups.encounters, .65, 'Old audio saves gain encounter controls')
  await encounterMixer.dispose()

  const broken = createAudioEngine({ settings, makeContext: () => new FakeContext(), isHidden: () => false, fetchAudio: async () => ({ ok: false }) })
  await broken.unlock(); broken.play('hammer'); await flush(); assert(broken.status.failed.includes('hammer')); await broken.dispose()
  const unsupported = createAudioEngine({ makeContext: () => null }); await unsupported.unlock(); assert(unsupported.status.unavailable); await unsupported.dispose()
  const { default: AudioSettings } = await server.ssrLoadModule('/src/components/AudioSettings.vue')
  const missing = []
  const html = await renderToString(createSSRApp({ render: () => h(AudioSettings, { settings, status: { unlocked: true, failed: [] } }) }).use(createI18n({ legacy: false, locale: 'en', messages: { en }, missing: (_, key) => missing.push(key) })))
  assert(html.includes('role="tab"')); assert(html.includes('Mute all sound')); assert(html.includes('Individual sounds')); assert(html.includes('Hot metal strike')); assert(html.includes('Cold metal thud')); assert.deepEqual(missing, [])
  // Drive real Vue typing/conversation components without a browser or audio device.
  const { default: Bubble } = await server.ssrLoadModule('/src/components/DialogueBubble.vue')
  const { default: Writer } = await server.ssrLoadModule('/src/components/TypewriterText.vue')
  const { default: Cloud } = await server.ssrLoadModule('/src/components/TutorialCloud.vue')
  const BubbleView = { ...Bubble, setup(props, context) { Bubble.setup(props, context); return () => h('div', context.slots.default?.()) } }
  const WriterView = { ...Writer, render: () => h('span') }
  const CloudView = { ...Cloud, render: () => h('div') }
  const quests = JSON.parse(readFileSync(new URL('../src/data/quests.json', import.meta.url)))
  const node = (type, text = '') => ({ type, text, children: [], props: {}, parent: null })
  const renderer = createRenderer({
    createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
    setText: (n, text) => { n.text = text }, setElementText: (n, text) => { n.text = text; n.children = [] },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] || null,
    patchProp: (n, key, old, value) => { n.props[key] = value },
    insert(n, parent, anchor) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1; if (index < 0) parent.children.push(n); else parent.children.splice(index, 0, n) },
    remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null }
  })
  const realInterval = globalThis.setInterval, realClear = globalThis.clearInterval, realTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout, oldWindow = globalThis.window
  const intervals = new Map(), delays = new Map(), tones = []; let serial = 0
  globalThis.setInterval = callback => { intervals.set(++serial, callback); return serial }
  globalThis.clearInterval = id => intervals.delete(id)
  globalThis.window = { matchMedia: () => ({ matches: false }) }
  useGameAudio({ play: id => tones.push(id) })
  const drain = async () => { for (let i = 0; i < 600 && intervals.size; i++) for (const callback of [...intervals.values()]) callback(); await nextTick() }
  const appFor = render => renderer.createApp({ render }).provide(ssrContextKey, { modules: new Set() }).use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
  try {
    for (const [bubbleProps, spoken, writerProps] of [[{ speaker: 'father' }, true], [{ speaker: 'player', thought: true }, false], [{ speaker: 'notice' }, false], [{ speaker: 'player', narration: true }, false], [{ speaker: 'player', mixed: true }, true, { spoken: true }], [{ speaker: 'father' }, false, { spoken: false }]]) {
      tones.length = 0; const root = node('root')
      const app = appFor(() => h(BubbleView, bubbleProps, () => h(WriterView, { text: 'Some words being written.', ...writerProps })))
      app.mount(root); await drain(); assert.equal(tones.includes('speech'), spoken); app.unmount()
    }
    globalThis.setTimeout = (callback, milliseconds) => { delays.set(++serial, { callback, milliseconds }); return serial }
    globalThis.clearTimeout = id => delays.delete(id)
    const delayedRoot = node('root'); let completed = 0
    const delayedApp = appFor(() => h(WriterView, { text: 'A considered reply.', delay: 1500, onComplete: () => completed++ }))
    delayedApp.mount(delayedRoot)
    const replyState = delayedApp._instance.subTree.component.setupState
    assert.equal(replyState.waiting, true); assert.equal(intervals.size, 0)
    replyState.reveal(); assert.equal(completed, 0, 'Clicking cannot skip a conversational pause')
    assert.equal([...delays.values()][0].milliseconds, 1500)
    const pause = [...delays.values()][0]; delays.clear(); pause.callback(); await drain()
    assert.equal(completed, 1); delayedApp.unmount()
    const cancelledApp = appFor(() => h(WriterView, { text: 'An interrupted reply.', delay: 1500 }))
    cancelledApp.mount(node('root')); assert.equal(delays.size, 1); cancelledApp.unmount(); assert.equal(delays.size, 0, 'Closing removes pending reply timers')
    globalThis.setTimeout = realTimeout; globalThis.clearTimeout = realClearTimeout
    const quest = quests.find(q => q.id === 'iron_errand_accepted'), root = node('root'); let accepted = 0
    const app = appFor(() => h(CloudView, { quest, onAccept: () => accepted++ }))
    app.mount(root)
    const state = app._instance.subTree.component.setupState
    for (let i = 0; i < quest.cloud.conversation.length; i++) {
      const line = quest.cloud.conversation[i]
      assert.equal(state.conversationLine.textKey, line.textKey, 'Opening dialogue advances in order')
      assert.equal(accepted, 0)
      state.accept(); assert.equal(state.conversationIndex, i, 'Unfinished lines cannot advance')
      state.complete(); state.accept(); await nextTick()
    }
    assert.equal(accepted, 1, 'The supply errand is accepted only after the dagger conversation finishes')
    app.unmount(); assert.equal(intervals.size, 0)
  } finally { useGameAudio(null); globalThis.setInterval = realInterval; globalThis.clearInterval = realClear; globalThis.setTimeout = realTimeout; globalThis.clearTimeout = realClearTimeout; globalThis.window = oldWindow }
  console.log(`Audio: ${files.size} complete licensed recordings, saved settings, master/per-cue gains, autoplay fallback, scene transitions, held effects, background playback, previews, cleanup and settings rendering passed`)
} finally { await server.close() }
