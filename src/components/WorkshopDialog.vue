<script setup>
import WeaponDesigner from './WeaponDesigner.vue'
import WeaponPreview from './WeaponPreview.vue'
import DaggerAssembly from './DaggerAssembly.vue'
import DaggerSharpening from './DaggerSharpening.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { items, itemQuantity, carriedWeight } from '../inventory'
import { average, scoreWork, bladeQuality, COAL_BURN_SECONDS, workshopRecipe, bladeMetal, bladeWorking, bladeQuenchable } from '../workshop'
const props = defineProps({ game: Object, station: String, feedback: String, embedded: Boolean, paused: Boolean })
const emit = defineEmits(['command', 'station', 'close', 'assembly-busy'])
const { t } = useI18n()
const w = computed(() => props.game.workshop), b = computed(() => w.value.blade), c = computed(() => w.value.crucible)
const recipe = computed(() => workshopRecipe(props.game))
const hammerPage = ref(0)
const hammerCells = computed(() => b.value?.design ? [0,1].flatMap(side => [0,1,2].map(i => side * b.value.design.sections.length + hammerPage.value * 3 + i)) : b.value?.work.map((_, i) => i) || [])
const tabs = ['warehouse', 'crucible', 'furnace', 'mould', 'rack', 'anvil', 'water', 'oil', 'workbench', 'grinder']
const power = ref(0), holding = ref(null), position = ref(.5), dialog = ref(null)
const cmd = (action, params = {}) => emit('command', action, params)
const sources = computed(() => [{ id: 'bag', entries: props.game.inventory }, { id: 'storehouse', entries: props.game.storehouse }])
const working = computed(() => b.value?.stage === 'hammering' && !b.value.heating && bladeWorking(b.value))
let timer, previous
function stop() {
  const h = holding.value; holding.value = null
  if (h?.type === 'hammer') cmd('strike', { cell: h.cell, power: power.value })
  if (h?.type === 'quench') cmd('quenchEnd')
  power.value = 0
}
function cancel() {
  if (holding.value?.type === 'quench' && b.value?.quenching) stop()
  else { holding.value = null; power.value = 0 }
}
function trapFocus(event) {
  if (props.embedded) return
  if (event.key !== 'Tab') return
  const controls = [...dialog.value.querySelectorAll('button:not(:disabled),select')]
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function beginHammer(event, index) {
  if (!working.value || holding.value) return
  event.currentTarget.setPointerCapture(event.pointerId)
  power.value = 0; holding.value = { type: 'hammer', cell: index }
}
function beginQuench(event) {
  if (!b.value || !['shaped', 'quenched'].includes(b.value.stage) || !bladeQuenchable(b.value)) return
  event.currentTarget.setPointerCapture(event.pointerId); cmd('quenchStart'); holding.value = { type: 'quench' }
}
watch(() => props.station, () => { stop(); position.value = .5 })
watch(() => props.paused, value => { if (value) cancel() })
onMounted(() => {
  if (!props.embedded) dialog.value.querySelector('button')?.focus()
  window.addEventListener('blur', cancel)
  previous = performance.now()
  timer = setInterval(() => {
    const now = performance.now(), dt = Math.min(.1, (now - previous) / 1000); previous = now
    if (holding.value?.type === 'hammer') power.value = Math.min(1, power.value + dt / 1.2)
    if (holding.value?.type === 'quench') cmd('quenchTick', { seconds: dt, medium: props.station })
  }, 40)
})
onBeforeUnmount(() => { cancel(); clearInterval(timer); window.removeEventListener('blur', cancel) })
</script>
<template>
  <div class="workshop-overlay" :inert="paused" :class="{ 'workshop-overlay--embedded': embedded }" @keydown.esc.stop="emit('close')">
    <section ref="dialog" class="workshop-dialog" :class="{ 'workshop-dialog--assembly': station === 'workbench' && b && ['quenched', 'assembled'].includes(b.stage) || station === 'grinder' && b?.stage === 'assembled', 'workshop-dialog--designer': station === 'design', 'workshop-dialog--minigame': !!b && ['anvil', 'water', 'oil', 'grinder', 'workbench'].includes(station) }" :role="embedded ? 'region' : 'dialog'" :aria-modal="embedded ? undefined : true" :aria-label="t('forgeHouse.station.' + station)" @keydown="trapFocus">
      <header><div><small>{{ t('workshop.title') }}</small><h2>{{ t('forgeHouse.station.' + station) }}</h2></div><button :aria-label="t('workshop.close')" @click="emit('close')">×</button></header>
      <nav v-if="!embedded" :aria-label="t('workshop.title')"><button v-for="tab in tabs" :key="tab" :class="{ active: station === tab }" @click="emit('station', tab)">{{ t('forgeHouse.station.' + tab) }}</button></nav>
      <div v-if="!embedded" class="workshop-readings"><strong>{{ t('workshop.temperature', { temperature: Math.round(w.temperature) }) }}</strong><span>{{ t('workshop.fuel', { seconds: Math.ceil(w.fuel) }) }}</span><button @click="cmd('coal')" :disabled="!itemQuantity(game.inventory, 'coal') || w.fuel > COAL_BURN_SECONDS * 5">{{ t('workshop.coal') }}</button><button @click="cmd('bellows')" :disabled="!w.fuel">{{ t('workshop.bellows') }}</button></div>
      <p v-if="feedback" class="workshop-feedback" role="status">{{ t('workshop.' + feedback) }}</p>
      <p v-if="b && station !== 'design'" class="working-range">{{ t('workshop.workingRange', { min: bladeMetal(b).workMin, max: bladeMetal(b).workMax, quench: bladeMetal(b).quench + 50 }) }}</p><div v-if="w.loading" class="workshop-loading" role="status">{{ t('workshop.loading', { item: t('items.' + (w.loading.action === 'coal' || w.loading.action === 'loadCarbon' ? 'coal' : w.loading.params.itemId) + '.name'), seconds: w.loading.remaining.toFixed(1) }) }}<progress :max="w.loading.duration" :value="w.loading.duration - w.loading.remaining" /></div>
      <div v-if="b?.stage === 'ruined'" class="workshop-feedback"><p>{{ t('workshop.bladeRuined') }}</p><button @click="cmd('discardBlade')">{{ t('workshop.discardBlade') }}</button></div><div class="workshop-body" :inert="!!w.loading" :aria-busy="!!w.loading">
        <WeaponDesigner v-if="station === 'design'" :game="game" @command="(action, params) => cmd(action, params)"/><template v-if="station === 'reference'">
          <p>{{ t('workshop.referenceIntro') }}</p><article v-for="metal in ['iron', 'copper']" :key="metal"><h3>{{ t('items.' + metal + '_ore.name') }}</h3><p>{{ t('workshop.reference.' + metal) }}</p></article><h3>{{ t('workshop.processTitle') }}</h3><p>{{ t('workshop.reference.process') }}</p><p>{{ t('workshop.thermalHelp') }}</p>
        </template>
        <template v-if="station === 'warehouse'">
          <p>{{ t('workshop.storageHelp') }} {{ t('workshop.materialsOnly') }}</p><small>{{ t('inventory.weight', { weight: carriedWeight(game.inventory).toFixed(2), capacity: 30 }) }}</small>
          <div class="workshop-storage"><section v-for="source in sources" :key="source.id"><h3>{{ t('workshop.' + source.id) }}</h3><div v-for="entry in source.entries.filter(e => items[e.itemId].category === 'materials')" :key="entry.id" class="workshop-item"><img :src="items[entry.itemId].imageSrc" alt=""/><span>{{ t(items[entry.itemId].nameKey) }} ×{{ entry.quantity }}</span><button @click="cmd('transfer', { from: source.id, id: entry.id })" :aria-label="t('workshop.transfer')">{{ source.id === 'bag' ? '→' : '←' }}</button></div><p v-if="!source.entries.some(e => items[e.itemId].category === 'materials')">{{ t('workshop.noMaterials') }}</p></section></div>
        </template>
        <template v-else-if="station === 'crucible'">
          <p>{{ c.design || w.activeDesign ? t('workshop.customRecipe') : t('workshop.recipe') }} · {{ t('workshop.source') }}</p><h3>{{ t('workshop.' + c.stage) }}</h3><p>{{ t('workshop.metalHeat', { temperature: Math.round(c.temperature) }) }} · {{ t('workshop.crucibleHeat', { temperature: Math.round(c.vesselTemperature ?? c.temperature) }) }}</p><p>{{ t('workshop.customCharge', { count: c.count, carbon: c.carbon, ore: recipe.oreCount, required: recipe.carbon }) }}</p>
          <template v-if="['empty', 'loaded'].includes(c.stage)"><div class="workshop-storage"><section v-for="source in sources" :key="source.id"><h3>{{ t('workshop.' + source.id) }}</h3><div v-for="ore in ['iron_ore', 'copper_ore']" :key="ore" class="workshop-item"><img :src="items[ore].imageSrc" alt=""/><span>{{ t(items[ore].nameKey) }} ×{{ itemQuantity(source.entries, ore) }}</span><button :aria-label="t('workshop.load')" :disabled="!itemQuantity(source.entries, ore) || c.count >= recipe.oreCount || !!recipe.ore && recipe.ore !== ore || !!c.ore && c.ore !== ore" @click="cmd('loadOre', { from: source.id, itemId: ore })">+</button></div><button :disabled="c.carbon >= recipe.carbon || !itemQuantity(source.entries, 'coal')" @click="cmd('loadCarbon', { from: source.id })">{{ t('workshop.carbon') }}</button></section></div><button :disabled="c.count !== recipe.oreCount || c.carbon !== recipe.carbon || !w.fuel" @click="cmd('smelt')">{{ t('workshop.smelt') }}</button><button :disabled="c.stage !== 'loaded'" @click="cmd('unload')">{{ t('workshop.unload') }}</button></template>
          <template v-else-if="c.stage === 'residue'"><p>{{ t('workshop.residueHelp') }}</p><button :disabled="c.onForge || !w.fuel" @click="cmd('reheatResidue')">{{ t('workshop.reheatResidue') }}</button><button :disabled="c.melt < 99 || c.temperature < (c.ore === 'iron_ore' ? 1538 : 1085)" @click="cmd('dumpResidue')">{{ t('workshop.dumpResidue') }}</button></template>
          <template v-else><label>{{ t('workshop.reduction', { progress: Math.round(c.reduction) }) }}<progress max="100" :value="c.reduction"/></label><label>{{ t('workshop.melt', { progress: Math.round(c.melt) }) }}<progress max="100" :value="c.melt"/></label><button :disabled="!['melting', 'molten', 'pouring'].includes(c.stage) || !!w.mould && !w.pour" @click="cmd('pour')">{{ t('workshop.pour') }}</button></template>
        </template>
        <template v-else-if="station === 'mould'"><h3>{{ w.mould ? t(items[w.mould.itemId].nameKey) : t('workshop.empty') }}</h3><p v-if="w.mould?.ruined">{{ t('workshop.castingFailed') }}</p><button v-if="w.mould?.ruined" @click="cmd('discardCasting')">{{ t('workshop.discardCasting') }}</button><p v-else-if="w.mould">{{ t('workshop.cooling', { seconds: Math.ceil(w.mould.remaining) }) }}</p><button :disabled="!w.mould || w.mould.ruined || w.mould.remaining > 0" @click="cmd('collect')">{{ t('workshop.collect') }}</button></template>
        <template v-else-if="['rack', 'furnace', 'bellows'].includes(station)">
          <p>{{ t('workshop.temperatureHelp') }} {{ t('workshop.thermalHelp') }}</p><div v-if="b"><h3>{{ t('workshop.progress', { stage: t('workshop.' + b.stage) }) }} · {{ t('workshop.temperature', { temperature: Math.round(b.temperature) }) }}</h3><progress :value="b.temperature" max="1500"/><button :disabled="b.stage === 'assembled'" @click="cmd('heat')">{{ t('workshop.heat') }}</button><button v-if="b.stage === 'hammering'" :disabled="!bladeWorking(b)" @click="cmd('anvil'); emit('station', 'anvil')">{{ t('workshop.anvil') }}</button><button v-if="b.heating" @click="cmd('removeHeat')">{{ t('workshop.removeHeat') }}</button></div>
          <div v-for="ingot in w.rack" :key="ingot.id" class="workshop-item"><img :src="items[ingot.itemId].imageSrc" alt=""/><span>{{ t(items[ingot.itemId].nameKey) }}</span><button :disabled="!!b || !ingot.design && ingot.itemId !== 'iron_ingot'" @click="cmd('heatIngot', { id: ingot.id })">{{ t('workshop.heatIngot') }}</button><button @click="cmd('takeIngot', { id: ingot.id })">{{ t('workshop.takeIngot') }}</button></div><p v-if="!w.rack.length">{{ t('workshop.rackEmpty') }}</p><button v-for="entry in game.inventory.filter(e => ['iron_ingot','copper_ingot'].includes(e.itemId))" :key="entry.id" @click="cmd('rackIngot', { itemId: entry.itemId, id: entry.id })">{{ t('workshop.rackIngot') }} · {{ entry.design?.name || t(items[entry.itemId].nameKey) }} ×{{ entry.units || 1 }}</button>
        </template>
        <template v-else-if="station === 'anvil'">
          <template v-if="b?.stage === 'hammering'"><p>{{ t('workshop.hammerHelp') }}</p><div class="workshop-readings"><strong>{{ t('workshop.temperature', { temperature: Math.round(b.temperature) }) }}</strong><button @click="cmd('heat'); emit('station', 'furnace')">{{ t('workshop.heat') }}</button></div><template v-if="b.design"><WeaponPreview :design="b.design" :highlight="holding?.cell % b.design.sections.length"/><nav><button v-for="page in b.design.ingots" :key="page" :class="{ active: hammerPage === page - 1 }" @click="hammerPage = page - 1">{{ t('design.workRegion', { n: page }) }}</button></nav></template><div class="hammer-grid" :style="b.design ? { gridTemplateColumns: 'repeat(3, 1fr)' } : {}"><button v-for="i in hammerCells" :key="i" :disabled="!working" :style="{ background: `hsl(${15 + scoreWork(b.work[i]) * .18} 35% ${28 + Math.max(0, b.temperature - 500) / 30}%)` }" :aria-label="t('workshop.cell', { cell: i + 1, quality: Math.round(scoreWork(b.work[i])) })" @pointerdown.prevent="beginHammer($event, i)" @pointerup="stop" @pointercancel="cancel" @lostpointercapture="cancel">{{ Math.round(scoreWork(b.work[i])) }}%<span v-if="b.work[i] >= 100">{{ b.work[i] >= 200 ? '×' : '↓' }}</span></button><span v-if="holding?.type === 'hammer'" class="hammer-sprite" :style="{ transform: `translateY(${-power * 35}px) rotate(${-power * 35}deg)` }">⚒</span></div><label>{{ t('workshop.power') }}<progress :value="power" max="1"/></label><button :disabled="!b.work.every(v => v > 0) || !!holding" @click="cmd('shapeDone')">{{ t('workshop.shapeDone') }}</button></template><p v-else>{{ t(b ? 'workshop.nextQuench' : 'workshop.noBlade') }}</p>
        </template>
        <template v-else-if="station === 'water' || station === 'oil'">
          <p>{{ t('workshop.quenchHelp') }}</p><template v-if="b && ['shaped', 'quenched'].includes(b.stage)"><strong>{{ t('workshop.temperature', { temperature: Math.round(b.temperature) }) }}</strong><button @click="cmd('heat'); emit('station', 'furnace')">{{ t('workshop.recoverQuench') }}</button><div class="quench-scene" :class="{ dipping: holding?.type === 'quench' }"><div class="quench-blade"></div><button class="quench-barrel" :disabled="!holding && (!bladeQuenchable(b))" @pointerdown.prevent="beginQuench" @pointerup="stop" @pointercancel="cancel" @lostpointercapture="cancel">{{ t('workshop.quench') }}</button></div><progress :value="scoreWork(b.quenchWork)" max="100"/><p>{{ t('workshop.quenchScore', { quality: Math.round(holding ? scoreWork(b.quenchWork) : b.quench) }) }}</p><p v-if="b.stage === 'quenched'">{{ t('workshop.nextAssembly') }}</p></template><p v-else>{{ t(b ? 'workshop.nextQuench' : 'workshop.noBlade') }}</p>
        </template>
        <template v-else-if="station === 'workbench'">
          <DaggerAssembly v-if="b && ['quenched', 'assembled'].includes(b.stage)" :blade="b" :inventory="game.inventory" :paused="paused" @command="(action, params) => cmd(action, params)" @busy="emit('assembly-busy', $event)" /><p v-else>{{ t(b ? 'workshop.nextQuench' : 'workshop.noBlade') }}</p>
          <div v-for="entry in game.inventory.filter(e => ['dagger', 'custom_weapon'].includes(e.itemId))" :key="entry.id" class="workshop-item"><img :src="items.dagger.imageSrc" alt=""/><span>{{ t(items.dagger.nameKey) }}</span><button :disabled="!!b" @click="cmd('regrind', { id: entry.id }); emit('station', 'grinder')">{{ t('workshop.regrind') }}</button></div>
        </template>
        <template v-else-if="station === 'grinder'">
          <DaggerSharpening v-if="b?.stage === 'assembled'" :blade="b" :paused="paused" @command="(action, params) => cmd(action, params)" /><p v-else>{{ t(b ? 'workshop.nextAssembly' : 'workshop.noBlade') }}</p>
        </template>
      </div><footer v-if="b"><strong>{{ t('workshop.quality', { quality: bladeQuality(b) }) }}</strong><small>{{ t('workshop.weights') }}</small><small v-if="(b.assemblyCeiling ?? 100) < 100">{{ t('workshop.assemblyCeiling', { quality: b.assemblyCeiling }) }}</small><small v-if="b.heatDamage > 0">{{ t('workshop.heatDamage', { quality: b.heatDamage.toFixed(1) }) }}</small><button v-if="station === 'workbench' && b.stage === 'assembled' && !b.sourceId" @click="cmd('reseat')">{{ t('workshop.reseat') }}</button></footer><button v-if="!embedded" class="workshop-return" @click="emit('close')">{{ t('workshop.close') }}</button>
    </section>
  </div>
</template>
<style scoped>
.workshop-overlay{position:absolute;inset:0;z-index:45;background:#132018a8;display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box}.workshop-dialog{color:#d7d3b6;background:#25362b;border:2px solid #b49b66;border-radius:8px;width:min(100%,730px);max-height:100%;display:flex;flex-direction:column;box-shadow:0 12px 45px #10150fe0;padding:14px;box-sizing:border-box;font-size:12px}.workshop-dialog header{display:flex;justify-content:space-between;align-items:center}.workshop-dialog h2{font-size:24px;margin:4px 0 10px;color:#edd49a}.workshop-dialog h3{font-size:14px;color:#d4b97b}.workshop-dialog small{font-size:10px;color:#bfa877}.workshop-dialog button{background:#485038;color:#eed5a1;border:1px solid #a38b55;border-radius:5px;padding:7px 10px;cursor:pointer;font:inherit}.workshop-dialog button:disabled{opacity:.4;cursor:default}.workshop-dialog button:focus-visible{outline:2px solid #ffe4a3;outline-offset:2px}.workshop-dialog nav{display:flex;flex-wrap:wrap;gap:4px;padding-bottom:9px;border-bottom:1px solid #b49b6644}.workshop-dialog nav button{font-size:10px;padding:4px 6px}.workshop-dialog nav .active{background:#c5aa68;color:#25362b}.workshop-readings{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:8px 0}.workshop-body{overflow:auto;min-height:0;overscroll-behavior:contain;padding:4px;flex:1}.workshop-body p{font-size:12px;line-height:1.5}.workshop-body>button{margin:5px 5px 5px 0}.workshop-body progress{display:block;width:100%;height:12px;accent-color:#c6a561;margin:5px 0 10px}.workshop-body label{display:block}.workshop-storage{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}.workshop-storage section{background:#1b2a21;padding:8px;min-height:150px;min-width:0}.workshop-item{display:flex;gap:6px;align-items:center;padding:5px 0;min-height:40px;border-bottom:1px solid #a38b5533}.workshop-item img{width:30px;height:30px}.workshop-item span{flex:1}.workshop-item button{font-size:10px}.workshop-dialog footer{border-top:1px solid #b49b6644;padding:8px 0;display:grid;gap:5px}.workshop-return{align-self:flex-end;margin-top:8px}.workshop-feedback{padding:6px;background:#68533355;color:#f5d69f;margin:3px 0}.hammer-grid{position:relative;display:grid;grid-template-rows:repeat(2,54px);grid-template-columns:repeat(8,1fr);gap:2px;margin:15px 0;padding:15px;background:linear-gradient(#62665d,#3a4039);border-radius:40% 20% 10% 20%}.hammer-grid button{padding:2px;border-radius:2px;position:relative;box-shadow:inset 0 0 8px #e8c99b66;touch-action:none;color:#fff0d3;font-size:11px}.hammer-grid button span{display:block}.hammer-sprite{position:absolute;left:45%;top:-8px;font-size:45px;pointer-events:none;transition:transform .04s}.quench-scene{height:160px;position:relative;display:grid;place-items:end center;margin:10px}.quench-barrel{width:150px;height:95px;border-radius:35% 35% 15% 15%!important;background:repeating-linear-gradient(90deg,#5b402a 0 18px,#694f32 20px 24px)!important;border:5px double #aa9c74!important;touch-action:none;position:relative;z-index:2}.quench-blade{position:absolute;width:14px;height:90px;top:0;background:linear-gradient(#b5a48d,#d86f36);border-radius:0 0 50% 50%;transition:transform .3s}.dipping .quench-blade{transform:translateY(60px)}.dipping .quench-barrel{box-shadow:0 -15px 25px #d2d6c15c}@media(max-width:500px){.workshop-dialog{padding:8px;font-size:11px}.workshop-dialog nav button{font-size:9px}.workshop-readings button{padding:5px}.workshop-storage{gap:4px}.workshop-item{flex-wrap:wrap}.hammer-grid{padding:6px;grid-template-rows:repeat(2,44px)}.hammer-grid button{font-size:9px}}
</style>

<style scoped>.workshop-overlay--embedded{background:none;pointer-events:none;padding:0;display:block;z-index:18}.workshop-overlay--embedded .workshop-dialog{position:absolute;left:8px;bottom:8px;width:49%;max-height:42%;padding:8px;pointer-events:auto;font-size:10px;background:#25362bf5;border-width:1px;box-shadow:0 4px 16px #10150f99}.workshop-overlay--embedded h2{font-size:17px;margin:2px 0 5px}.workshop-overlay--embedded header small{display:none}.workshop-overlay--embedded .workshop-body p{font-size:10px;margin:5px 0}.workshop-overlay--embedded .workshop-body>p:first-child{display:none}.workshop-overlay--embedded button{padding:4px 6px;font-size:10px}.workshop-overlay--embedded .workshop-storage{gap:4px}.workshop-overlay--embedded .workshop-storage section{padding:4px;min-height:100px}.workshop-overlay--embedded .workshop-item{min-height:24px;flex-wrap:wrap}.workshop-overlay--embedded .workshop-item img{width:21px;height:21px}.workshop-overlay--embedded .hammer-grid{grid-template-rows:repeat(2,33px);padding:4px}.workshop-overlay--embedded .hammer-grid button{font-size:8px}.workshop-overlay--embedded footer{padding:4px 0}.workshop-overlay--embedded footer small{font-size:8px}@media(max-width:570px){.workshop-overlay--embedded .workshop-dialog{width:57%;left:4px;bottom:4px;max-height:47%;padding:5px}.workshop-overlay--embedded .workshop-storage{grid-template-columns:1fr}.workshop-overlay--embedded h2{font-size:14px}}</style>


<style scoped>.workshop-overlay--embedded .workshop-dialog.workshop-dialog--assembly{left:50%;top:50%;bottom:auto;transform:translate(-50%,-50%);width:min(420px,calc(100% - 16px));max-height:82%}</style>

<style scoped>
.workshop-dialog header{position:sticky;top:0;z-index:20;background:#25362b;flex:none}.workshop-overlay .workshop-dialog.workshop-dialog--minigame{position:absolute;inset:8px;left:8px;top:8px;bottom:8px;transform:none;width:auto;height:auto;max-height:none}.workshop-dialog--minigame .workshop-body{overflow:auto}.workshop-dialog--assembly .workshop-body{overflow:hidden;display:flex;flex-direction:column}.workshop-dialog--minigame footer{flex:none;padding:4px 0;gap:2px}.workshop-dialog--minigame h2{margin:2px 0 5px}.workshop-dialog--minigame .hammer-grid{margin:7px 0;grid-template-rows:repeat(2,minmax(24px,6vh))}.workshop-dialog button:hover:not(:disabled){background:#dec18a;color:#203428}
</style>

<style scoped>.workshop-dialog--minigame{container-type:size}.workshop-dialog--minigame .quench-scene{height:clamp(76px,24cqh,160px)}.workshop-dialog--minigame .workshop-body>p{line-height:1.35;margin:4px 0}.workshop-dialog--minigame footer small{line-height:1.2}.workshop-dialog--minigame footer small:nth-of-type(1){display:none}</style>

<style scoped>.workshop-loading{flex:none;font-size:11px;padding:5px;color:#ead5a0}.workshop-loading progress{display:block;width:100%;height:8px;accent-color:#c5a566;margin-top:4px}</style>

<style scoped>.workshop-overlay .workshop-dialog.workshop-dialog--designer{position:absolute;inset:8px;width:auto;max-height:none;transform:none}.workshop-dialog--designer .workshop-body{overflow:auto}</style>
<style scoped>.working-range{font-size:10px;margin:2px 0 4px;flex:none;color:#cab481}.workshop-dialog--minigame .weapon-preview{height:clamp(40px,12cqh,95px)}</style>
<style scoped>
.workshop-overlay:has(.workshop-dialog--minigame),.workshop-overlay:has(.workshop-dialog--designer){z-index:40}.workshop-overlay .workshop-dialog.workshop-dialog--minigame,.workshop-overlay .workshop-dialog.workshop-dialog--designer{inset:0;width:100%;height:100%;max-width:none;max-height:none;border-radius:0;padding:12px}.workshop-dialog--minigame .workshop-body{display:flex;flex-direction:column;overflow:auto}.workshop-dialog--minigame .dagger-assembly,.workshop-dialog--minigame .dagger-sharpening{flex:1;min-height:160px}.workshop-dialog--minigame .hammer-grid{flex:1;min-height:100px;grid-template-rows:repeat(2,minmax(30px,1fr))}.workshop-dialog--minigame .quench-scene{flex:1;min-height:90px;height:auto}.workshop-dialog--minigame .working-range{font-size:9px}@media(max-width:570px){.workshop-overlay .workshop-dialog.workshop-dialog--minigame,.workshop-overlay .workshop-dialog.workshop-dialog--designer{padding:7px}}
</style>

<style scoped>.workshop-overlay .workshop-dialog.workshop-dialog--minigame,.workshop-overlay .workshop-dialog.workshop-dialog--designer{background:#25362b}</style>
<style scoped>
@media(max-width:570px){
  .workshop-overlay--embedded:has(.workshop-dialog--minigame,.workshop-dialog--designer){position:fixed;inset:0;width:100vw;height:100dvh;z-index:60;pointer-events:auto}
  .workshop-overlay--embedded .workshop-dialog.workshop-dialog--minigame,
  .workshop-overlay--embedded .workshop-dialog.workshop-dialog--designer{position:absolute;inset:0;width:100%;height:100%;max-height:none;padding:calc(env(safe-area-inset-top) + 8px) 8px calc(env(safe-area-inset-bottom) + 8px)}
}
</style>
