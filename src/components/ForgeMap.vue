<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CircleIcon from './CircleIcon.vue'
import stations from '../data/forge-stations.json'
import { isUnlocked } from '../progression'
import { itemQuantity, items } from '../inventory'
import { COAL_BURN_SECONDS, scoreWork, workshopRecipe, bladeMetal, bladeQuenchable, meltingPoint, readyToPour, readyForAnvil, readyForQuench, FORGING_TARGET, QUENCH_TARGET } from '../workshop'
import { newForgePawn, routeForgePawn, tickForgePawn, stationPoint, floorDistance } from '../forge-navigation'
import characters from '../data/characters.json'
const props = defineProps({ completedQuests: Array, workshop: Object, inventory: { type: Array, default: () => [] }, storehouse: { type: Array, default: () => [] }, dialogueBlocked: Boolean, feedback: String, paused: Boolean, guiding: Boolean, occupied: Boolean })
const emit = defineEmits(['town', 'modal', 'station', 'command'])
const { t } = useI18n()
const b = computed(() => props.workshop.blade), c = computed(() => props.workshop.crucible)
const recipe = computed(() => workshopRecipe({ workshop: props.workshop, completedQuests: props.completedQuests }))
const custom = computed(() => props.completedQuests.includes('dagger_forged'))
const quenching = ref(null)
const player = reactive(newForgePawn('entry')), father = reactive(newForgePawn('fatherNook'))
let arrival = null, idleTime = 0, idleIndex = 0
const idleStations = ['idle', 'workbench', 'grinder', 'furnace', 'rack', 'idle']
const isNear = station => floorDistance(player, stationPoint(station)) < 1.5 && !player.route.length
function approach(station, callback) {
  if (isNear(station)) { callback?.(); return }
  if (player.destination === station && player.route.length) {
    const previous = arrival
    arrival = () => { previous?.(); callback?.() }
    return
  }
  arrival = callback
  routeForgePawn(player, station)
}
defineExpose({ approach, isNear })
const cmd = (action, params = {}) => emit('command', action, params)
const unlocked = id => !props.dialogueBlocked && isUnlocked(props.completedQuests, 'forgeStations', id)
const visibleStations = computed(() => stations.filter(s => props.workshop.working ? !['warehouse', 'sonBed', 'door'].includes(s.id) : ['warehouse', 'sonBed', 'door'].includes(s.id)))
const hasCharge = computed(() => {
  const all = [...props.inventory, ...props.storehouse]
  return [['iron_ore', 4], ['copper_ore', 6]].some(([id, n]) => itemQuantity(all, id) >= n) && itemQuantity(all, 'coal') > 0
})
const available = id => {
  if (props.workshop.pour) return id === 'crucible'
  if (id === 'crucible') return c.value.stage !== 'empty' || hasCharge.value
  if (id === 'rack') return !!props.workshop.rack.length || !!itemQuantity(props.inventory, 'iron_ingot') || !!itemQuantity(props.inventory, 'copper_ingot')
  if (id === 'bellows') return props.workshop.fuel > 0 && props.workshop.bellowsRecovery === 0
  if (['anvil', 'water', 'oil', 'grinder'].includes(id)) return !!b.value
  if (id === 'mould') return !!props.workshop.mould
  return true
}
const nextActions = computed(() => {
  const w = props.workshop, blade = b.value, charge = c.value
  if (!w.working) return custom.value && !w.design ? ['design'] : []
  if (w.pour) return ['crucible']
  if (w.mould?.ruined) return ['mould']
  if (w.mould) return w.mould.remaining === 0 ? ['mould'] : []
  if (charge.stage === 'residue') return readyToPour(charge) ? ['dumpResidue'] : [!charge.onForge ? 'reheatResidue' : w.fuel ? 'bellows' : 'coal']
  if (blade) {
    if (blade.stage === 'ruined') return ['discardBlade']
    if (blade.stage === 'assembled') return ['grinder']
    if (blade.stage === 'quenched') return ['workbench']
    const upperHeat = blade.stage === 'shaped' ? bladeMetal(blade).quench + 50 : bladeMetal(blade).workMax
    if (blade.heating) {
      if (blade.temperature > upperHeat) return ['removeHeat', 'coolForge']
      return blade.temperature >= (blade.stage === 'shaped' ? bladeMetal(blade).quench : bladeMetal(blade).target) ? ['removeHeat'] : [w.fuel > 0 ? 'bellows' : 'coal']
    }
    if (blade.temperature > upperHeat) return []
    if (blade.stage === 'shaped' && readyForQuench(blade)) return ['water', 'oil']
    if (blade.stage === 'hammering' && readyForAnvil(blade)) return [blade.work.every(v => v > 0) ? 'shapeDone' : 'anvil']
    return ['heat']
  }
  if (['molten', 'melting'].includes(charge.stage) && readyToPour(charge)) return ['pour', ...(w.temperature > meltingPoint(charge.ore) + 180 ? ['coolForge'] : charge.stage === 'melting' && w.temperature < meltingPoint(charge.ore) + 80 ? [w.fuel ? 'bellows' : 'coal'] : [])]
  if (['reducing', 'melting', 'molten'].includes(charge.stage)) return [w.temperature > meltingPoint(charge.ore) + 180 ? 'coolForge' : w.fuel > 0 ? 'bellows' : 'coal']
  if (charge.stage === 'loaded') return charge.count === recipe.value.oreCount && charge.carbon === recipe.value.carbon ? [w.fuel > 0 ? 'smelt' : 'coal'] : ['crucible']
  return [hasCharge.value ? 'crucible' : null, available('rack') ? 'rack' : null].filter(Boolean)
})
const actions = computed(() => [
  { id: 'coal', station: 'furnace', icon: '+', x: 82, y: 49, key: 'coal', disabled: !itemQuantity(props.inventory, 'coal') || props.workshop.fuel > COAL_BURN_SECONDS * 5 },
  { id: 'coolForge', station: 'water', icon: '↓°', x: 52, y: 59, key: 'coolForge' },
  { id: 'maintenance', station: 'workbench', icon: '◇', x: 25, y: 46, key: 'regrind', disabled: !!props.workshop.blade || !!props.workshop.activeDesign || !props.inventory.some(e => ['dagger','custom_weapon'].includes(e.itemId)) },
  { id: 'design', station: 'workbench', icon: '✎', x: 20, y: 46, key: 'design', disabled: !custom.value },
  { id: 'discardBlade', station: 'anvil', icon: '×', x: 46, y: 58, key: 'discardBlade', disabled: b.value?.stage !== 'ruined' },
  { id: 'reference', station: 'workbench', icon: 'i', x: 15, y: 46, key: 'referenceTitle' },
  { id: 'smelt', station: 'crucible', icon: '↗', x: 65, y: 62, key: 'smelt', disabled: c.value.stage !== 'loaded' || c.value.count !== recipe.value.oreCount || c.value.carbon !== recipe.value.carbon || !props.workshop.fuel },
  { id: 'pour', station: 'crucible', icon: '↘', x: 70, y: 62, key: 'pour', disabled: !['melting', 'molten'].includes(c.value.stage) || !!props.workshop.mould },
  { id: 'heat', station: 'furnace', icon: '♨', x: 77, y: 44, key: 'heat', disabled: !b.value || b.value.stage === 'assembled' || b.value.heating },
  { id: 'removeHeat', station: 'furnace', icon: '↙', x: 77, y: 49, key: 'removeHeat', disabled: !b.value?.heating },
  { id: 'reheatResidue', station: 'crucible', icon: '♨', x: 61, y: 62, key: 'reheatResidue', disabled: c.value.stage !== 'residue' || c.value.onForge || !props.workshop.fuel },
  { id: 'dumpResidue', station: 'crucible', icon: '×', x: 66, y: 68, key: 'dumpResidue', disabled: c.value.stage !== 'residue' || c.value.melt < 99 || c.value.temperature < (c.value.ore === 'iron_ore' ? 1538 : 1085) },
  { id: 'shapeDone', station: 'anvil', icon: '✓', x: 43, y: 58, key: 'shapeDone', disabled: b.value?.stage !== 'hammering' || !b.value.work.every(v => v > 0) }
])
function activate(s) {
  if (!unlocked(s.id)) return
  if (s.id === 'door') emit('town')
  else if (s.id === 'sonBed') emit('modal', 'sleep')
  else if (s.id === 'bellows') cmd('bellows')
  else if (s.id === 'crucible' && props.workshop.pour) cmd('pour')
  else if (s.id === 'mould' && props.workshop.mould?.ruined) cmd('discardCasting')
  else if (s.id === 'mould' && props.workshop.mould?.remaining === 0) cmd('collect')
  else if (s.id === 'anvil' && b.value?.stage === 'hammering') { if (b.value.heating) cmd('anvil'); emit('station', 'anvil') }
  else emit('station', s.id)
}
function action(a) { if (a.id === 'maintenance') emit('station', 'workbench'); else if (['reference','design','maintenance'].includes(a.id)) emit('station', a.id); else cmd(a.id) }
function beginQuench(event, medium) {
  if (!unlocked(medium) || !b.value || !['shaped', 'quenched'].includes(b.value.stage) || !bladeQuenchable(b.value)) return
  if (!isNear(medium)) { approach(medium, () => emit('station', medium)); return }
  event.preventDefault(); if (event.pointerId !== undefined) event.currentTarget.setPointerCapture(event.pointerId)
  cmd('quenchStart', { medium }); quenching.value = medium
}
function endQuench() { if (quenching.value) { quenching.value = null; cmd('quenchEnd') } }
watch(() => props.paused, value => { if (value) endQuench() })
let timer, previous
onMounted(() => {
  window.addEventListener('blur', endQuench); previous = performance.now()
  approach('idle')
  timer = setInterval(() => {
    const now = performance.now(), dt = Math.min(.1, (now - previous) / 1000); previous = now
    if (props.paused) return
    if (player.route.length && tickForgePawn(player, dt)) { const callback = arrival; arrival = null; callback?.() }
    if (!props.guiding && !props.occupied && !player.route.length && !quenching.value) {
      if (father.route.length) tickForgePawn(father, dt, 8)
      else { idleTime += dt; if (idleTime > 4) { idleTime = 0; routeForgePawn(father, idleStations[idleIndex++ % idleStations.length]) } }
    }
    if (quenching.value) cmd('quenchTick', { medium: quenching.value, seconds: dt })
  }, 40)
})
onBeforeUnmount(() => { endQuench(); clearInterval(timer); window.removeEventListener('blur', endQuench) })
</script>
<template>
  <div class="workshop-map"><div class="workshop-scene">
    <img class="workshop-interior" src="/images/interior/Medieval Blacksmith’s Forge and Shop.png" alt=""/>
    <div v-for="(actor, id) in { player, father }" :key="id" class="forge-person" :class="{ 'forge-person--walking': actor.route.length && (id === 'player' || !guiding && !occupied) }" :style="{ left: actor.x + '%', top: actor.y + '%' }" :title="t(characters[id].nameKey)"><img :src="characters[id].portraitSrc" :alt="t(characters[id].nameKey)"/></div>
    <span v-if="player.route.length" class="forge-walking" role="status">{{ t('workshop.walkingToStation') }}</span>
    <CircleIcon v-for="s in visibleStations" :key="s.id" size="forge" :icon="s.icon" class="forge-hotspot" :class="{ 'forge-action-ready': nextActions.includes(s.id) }" :style="{ left: s.x + '%', top: s.y + '%' }" :aria-label="t(s.id === 'mould' && workshop.mould?.ruined ? 'workshop.discardCasting' : 'forgeHouse.actions.' + s.id)" :title="t(s.id === 'mould' && workshop.mould?.ruined ? 'workshop.discardCasting' : 'forgeHouse.actions.' + s.id)" :disabled="!!workshop.loading || !unlocked(s.id) || !available(s.id)" @click="activate(s)"/>
    <button v-for="a in actions.filter(a => workshop.working || ['reference','design','maintenance'].includes(a.id))" :key="a.id" class="forge-map-action" :class="{ 'forge-action-ready': nextActions.includes(a.id) }" :style="{ left: a.x + '%', top: a.y + '%' }" :disabled="!!workshop.loading || !!workshop.pour || !unlocked(a.station) || a.disabled" :aria-label="t('workshop.' + a.key)" :title="t('workshop.' + a.key)" @click="action(a)">{{ a.icon }}</button>
    <button v-for="(medium, i) in workshop.working ? ['water', 'oil'] : []" :key="medium" class="forge-map-action forge-quench-action" :class="{ 'forge-action-ready': quenching === medium || nextActions.includes(medium) }" :style="{ left: (58 + i * 6) + '%', top: '59%' }" :disabled="!unlocked(medium) || !quenching && (!b || !['shaped', 'quenched'].includes(b.stage) || !bladeQuenchable(b))" :title="t('workshop.quench') + ' · ' + t('forgeHouse.station.' + medium)" :aria-label="t('workshop.quench') + ' · ' + t('forgeHouse.station.' + medium)" @pointerdown="beginQuench($event, medium)" @pointerup="endQuench" @pointercancel="endQuench" @lostpointercapture="endQuench" @keydown.space.prevent="!$event.repeat && beginQuench($event, medium)" @keyup.space.prevent="endQuench">{{ medium === 'water' ? '≈↓' : '◇↓' }}</button>
    <button v-if="!workshop.working" class="smithing-start" :disabled="!unlocked('furnace')" @click="cmd('start')">{{ t('workshop.start') }}</button>
    <button v-else class="smithing-stop" :disabled="dialogueBlocked || !!workshop.loading || !!workshop.pour" @click="endQuench(); cmd('stop')">{{ t('workshop.stop') }}</button>
    <output v-if="workshop.loading" class="forge-loading" role="status">{{ t('workshop.loading', { item: t('items.' + (workshop.loading.action === 'coal' || workshop.loading.action === 'loadCarbon' ? 'coal' : workshop.loading.params.itemId) + '.name'), seconds: workshop.loading.remaining.toFixed(1) }) }}<progress :max="workshop.loading.duration" :value="workshop.loading.duration - workshop.loading.remaining" /></output>
    <output class="forge-temperature" :title="t('workshop.fuel', { seconds: Math.ceil(workshop.fuel) })">{{ t('workshop.temperature', { temperature: Math.round(workshop.temperature) }) }}<small>{{ t('workshop.fuel', { seconds: Math.ceil(workshop.fuel) }) }}</small></output>
    <button v-if="workshop.working && ['molten', 'pouring'].includes(c.stage)" class="molten-indicator" :class="{ 'forge-action-ready': nextActions.includes('pour') }" @click="cmd('pour')" :disabled="!!workshop.mould && !workshop.pour">{{ t('workshop.pour') }}</button>
    <output v-else-if="workshop.working && ['reducing', 'melting'].includes(c.stage)" class="crucible-reading">{{ t('workshop.' + c.stage) }} {{ Math.round(c.stage === 'reducing' ? c.reduction : c.melt) }}%</output>
    <output v-if="workshop.working && !['empty', 'loaded'].includes(c.stage)" class="crucible-temperatures">{{ t('workshop.metalHeat', { temperature: Math.round(c.temperature) }) }}<br/>{{ t('workshop.crucibleHeat', { temperature: Math.round(c.vesselTemperature ?? c.temperature) }) }}</output>
    <output v-if="workshop.mould" class="mould-reading">{{ workshop.mould.ruined ? t('workshop.ruinedCasting') : t('workshop.cooling', { seconds: Math.ceil(workshop.mould.remaining) }) }}</output>
    <div class="workshop-rack-art"><button v-for="ingot in workshop.rack" :key="ingot.id" :title="t('workshop.heatIngot') + ' · ' + t(items[ingot.itemId].nameKey)" :aria-label="t('workshop.heatIngot') + ' · ' + t(items[ingot.itemId].nameKey)" :disabled="!workshop.working || !!b || !ingot.design && ingot.itemId !== 'iron_ingot' || !unlocked('rack')" @click="cmd('heatIngot', { id: ingot.id })"><img :src="items[ingot.itemId].imageSrc" alt=""/></button></div>
    <output v-if="b" class="blade-heat-indicator">{{ t('workshop.ingotHeat', { temperature: Math.round(b.temperature) }) }}</output>
    <output v-if="quenching" class="quench-reading">{{ t('workshop.quenchScore', { quality: Math.round(scoreWork(b.quenchWork)) }) }}</output>
  </div><button v-if="!workshop.working" class="interior-back" :disabled="dialogueBlocked" @click="emit('town')">← {{ t('map.backTown') }}</button><p v-if="feedback" class="forge-map-feedback" role="status">{{ t('workshop.' + feedback) }}</p></div>
</template>
<style scoped>
.forge-person{position:absolute;z-index:7;width:clamp(18px,3.5vw,29px);height:clamp(18px,3.5vw,29px);transform:translate(-50%,-95%);border:2px solid #d5bd7b;border-radius:50%;background:#304133;box-shadow:0 3px 3px #0009;pointer-events:none}.forge-person img{width:100%;height:100%;object-fit:cover;border-radius:50%}.forge-person--walking img{animation:pawn-step .35s ease-in-out infinite alternate}.forge-walking{position:absolute;left:35%;top:92%;font-size:10px;padding:3px 6px;background:#23372deb;border:1px solid #b49b63;border-radius:4px;color:#efd59a;pointer-events:none;z-index:9}@keyframes pawn-step{to{transform:translateY(-2px)}}@media(prefers-reduced-motion:reduce){.forge-person--walking img{animation:none}}.workshop-map{position:absolute;inset:0;display:grid;place-items:center;background:#20291e}.workshop-scene{position:relative;width:100%;aspect-ratio:3/2}.workshop-interior{display:block;width:100%;height:100%;object-fit:contain}.forge-temperature{position:absolute;left:76%;top:35%;padding:2px 4px;border:1px solid #b09b63;border-radius:3px;background:#233225eb;color:#ffcb8e;font-size:10px;line-height:1.2;pointer-events:none}.forge-temperature small{display:block;font-size:8px;color:#d8c9a1}.forge-map-action{position:absolute;transform:translate(-50%,-50%);width:21px;height:21px;padding:0;border:1px solid #b6a172;border-radius:50%;background:#314536ed;color:#f0db9f;font-size:11px;z-index:5;cursor:pointer;touch-action:none}.forge-map-action:disabled{opacity:.35;cursor:default}.forge-map-action:hover:not(:disabled),.forge-map-action:focus-visible{background:#7a6541;outline:1px solid #ead198;outline-offset:2px}.molten-indicator,.blade-heat-indicator,.crucible-reading,.mould-reading,.quench-reading{position:absolute;left:59%;top:68%;background:#34412cf5;color:#f1cf83;border:1px solid #d0a553;border-radius:4px;padding:3px;font-size:9px;z-index:6}.blade-heat-indicator{top:23%;left:65%;pointer-events:none}.crucible-reading{left:60%;top:47%;pointer-events:none}.mould-reading{left:70%;top:67%;pointer-events:none}.quench-reading{left:53%;top:73%;pointer-events:none}.workshop-rack-art{position:absolute;left:71%;top:27%;width:17%;display:flex;flex-wrap:wrap;gap:2px;z-index:5}.workshop-rack-art button{width:24px;height:19px;background:#263b28cc;border:1px solid #aa9462;padding:0;border-radius:3px;cursor:pointer}.workshop-rack-art img{width:100%;height:100%;object-fit:contain}.forge-action-ready{background:#812d39!important;color:#ffe4b0;box-shadow:0 0 5px #b44f56;animation:ready-glow 1.4s ease-in-out alternate infinite}.forge-map-feedback{position:absolute;left:52%;right:8px;bottom:8px;margin:0;padding:5px 7px;background:#25362bf2;border:1px solid #a68b56;border-radius:4px;color:#e1ce9d;font-size:10px;pointer-events:none;z-index:19}@keyframes ready-glow{to{box-shadow:0 0 10px #d06c72;filter:brightness(1.15)}}.smithing-start,.smithing-stop{position:absolute;z-index:8;padding:5px 8px;border:1px solid #c2a366;border-radius:5px;background:#293c2eee;color:#efdaa5;font-size:10px;cursor:pointer}.smithing-start{left:71%;top:46%;max-width:27%}.smithing-stop{right:8px;top:8px}.smithing-start:disabled{opacity:.4}@media(prefers-reduced-motion:reduce){.forge-action-ready{animation:none}}@media(max-width:570px){.forge-map-action{width:18px;height:18px;font-size:9px}.forge-temperature{font-size:9px}}
</style>

<style scoped>.forge-loading{position:absolute;left:55%;top:80%;z-index:20;padding:5px 8px;background:#25362bf5;border:1px solid #ad945e;border-radius:5px;color:#ead5a0;font-size:10px;pointer-events:none}.forge-loading progress{display:block;width:100%;height:7px;accent-color:#c5a566;margin-top:3px}</style>

<style scoped>.crucible-temperatures{position:absolute;left:60%;top:31%;z-index:8;pointer-events:none;background:#25362be8;padding:3px 5px;border:1px solid #9f8955;border-radius:4px;color:#efd19a;font-size:9px}</style>
