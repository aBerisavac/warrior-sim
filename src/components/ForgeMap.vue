<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CircleIcon from './CircleIcon.vue'
import ButtonProgressRing from './ButtonProgressRing.vue'
import stations from '../data/forge-stations.json'
import { isUnlocked } from '../progression'
import { itemQuantity, items } from '../inventory'
import { COAL_BURN_SECONDS, scoreWork, workshopRecipe, bladeQuenchable } from '../workshop'
import { newForgePawn, routeForgePawn, tickForgePawn, stationPoint, floorDistance } from '../forge-navigation'
import characters from '../data/characters.json'
const props = defineProps({ avatarSrc: { type: String, default: '/images/profile/blacksmith.png' }, completedQuests: Array, workshop: Object, inventory: { type: Array, default: () => [] }, storehouse: { type: Array, default: () => [] }, dialogueBlocked: Boolean, feedback: String, paused: Boolean, guiding: Boolean, occupied: Boolean })
const emit = defineEmits(['town', 'modal', 'station', 'command'])
const { t } = useI18n()
const b = computed(() => props.workshop.blade), c = computed(() => props.workshop.crucible)
const recipe = computed(() => workshopRecipe({ workshop: props.workshop, completedQuests: props.completedQuests }))
const custom = computed(() => props.completedQuests.includes('dagger_forged'))
const quenching = ref(null)
const openStation = ref(null)
let menuCloseTimer
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
const visibleStations = computed(() => stations.filter(s => props.workshop.working ? !['warehouse', 'sonBed', 'door'].includes(s.id) : ['warehouse', 'sonBed', 'door', 'workbench'].includes(s.id)))
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
const actions = computed(() => [
  { id: 'coal', station: 'furnace', icon: '+', x: 82, y: 49, key: 'coal', disabled: !itemQuantity([...props.inventory, ...props.storehouse], 'coal') || props.workshop.fuel > COAL_BURN_SECONDS * 5 },
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
function stationOptions(station) {
  const options = station.id === 'bellows' ? [] : [{ id: 'inspect', icon: 'i', key: 'inspect', disabled: false }]
  if (station.id === 'anvil') options.push({ id: 'forge', icon: '⚒', key: 'anvil', disabled: b.value?.stage !== 'hammering' })
  if (station.id === 'mould' && props.workshop.mould) options.push({ id: props.workshop.mould.ruined ? 'discardCasting' : 'collect', icon: props.workshop.mould.ruined ? '×' : '✓', key: props.workshop.mould.ruined ? 'discardCasting' : 'collect', disabled: !props.workshop.mould.ruined && props.workshop.mould.remaining > 0 })
  if (station.id === 'bellows') options.push({ id: 'bellows', icon: '≋', key: 'bellows', disabled: !available('bellows') })
  if (station.id === 'rack') options.push(...props.workshop.rack.map(ingot => ({ id: 'heatIngot:' + ingot.id, icon: '▱', key: 'heatIngot', ingotId: ingot.id, disabled: !!b.value || !ingot.design && ingot.itemId !== 'iron_ingot' })))
  if (['water', 'oil'].includes(station.id)) options.push({ id: 'quench', icon: '↓', key: 'quench', disabled: !b.value || !bladeQuenchable(b.value) })
  return [...options, ...actions.value.filter(a => a.station === station.id && (props.workshop.working || ['reference','design','maintenance'].includes(a.id)))]
}
const hasMenu = station => !['door', 'sonBed'].includes(station.id) && stationOptions(station).length > 1
const directOption = station => stationOptions(station).length === 1 ? stationOptions(station)[0] : null
function openMenu(id) { clearTimeout(menuCloseTimer); openStation.value = id }
function cancelMenuClose() { clearTimeout(menuCloseTimer) }
function scheduleClose() { clearTimeout(menuCloseTimer); menuCloseTimer = setTimeout(() => { openStation.value = null }, 520) }
function optionLabel(option, station) {
  if (option.id === 'inspect') return t('forgeHouse.station.' + station.id)
  if (option.ingotId) {
    const ingot = props.workshop.rack.find(entry => entry.id === option.ingotId)
    return t('workshop.heatIngot') + (ingot ? ' · ' + t(items[ingot.itemId].nameKey) : '')
  }
  return t('workshop.' + option.key)
}
function chooseOption(option, station) {
  if (option.disabled || props.workshop.loading || props.workshop.pour && station.id !== 'crucible') return
  if (option.id !== 'coal') openStation.value = null
  if (option.id === 'inspect') emit('station', station.id)
  else if (option.id === 'forge') { if (b.value?.heating) cmd('anvil'); emit('station', 'anvil') }
  else if (option.id === 'quench') emit('station', station.id)
  else if (option.ingotId) cmd('heatIngot', { id: option.ingotId })
  else if (['collect','discardCasting','bellows'].includes(option.id)) cmd(option.id)
  else action(option)
}
function activate(s) {
  if (!unlocked(s.id)) return
  if (s.id === 'door') emit('town')
  else if (s.id === 'sonBed') emit('modal', 'sleep')
  else if (directOption(s)) chooseOption(directOption(s), s)
  else openMenu(s.id)
}
function action(a) { if (a.id === 'maintenance') emit('station', 'workbench'); else if (['reference','design','maintenance'].includes(a.id)) emit('station', a.id); else cmd(a.id, a.id === 'coal' ? { from: itemQuantity(props.inventory, 'coal') ? 'bag' : 'storehouse' } : {}) }
function beginQuench(event, medium) {
  if (!unlocked(medium)) return
  if (!b.value || !['shaped', 'quenched'].includes(b.value.stage) || !bladeQuenchable(b.value)) { emit('station', medium); return }
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
onBeforeUnmount(() => { endQuench(); clearInterval(timer); clearTimeout(menuCloseTimer); window.removeEventListener('blur', endQuench) })
</script>
<template>
  <div class="workshop-map"><div class="workshop-scene">
    <img class="workshop-interior" src="/images/interior/Medieval Blacksmith’s Forge and Shop.png" alt=""/>
    <div v-for="(actor, id) in { player, father }" :key="id" class="forge-person" :class="{ 'forge-person--walking': actor.route.length && (id === 'player' || !guiding && !occupied) }" :style="{ left: actor.x + '%', top: actor.y + '%' }" :title="t(characters[id].nameKey)"><img :src="id === 'player' ? avatarSrc : characters[id].portraitSrc" :alt="t(characters[id].nameKey)"/></div>
    <span v-if="player.route.length" class="forge-walking" role="status">{{ t('workshop.walkingToStation') }}</span>
    <div v-for="s in visibleStations" :key="s.id" class="forge-station-node" :class="{ 'forge-station-node--open': hasMenu(s) && openStation === s.id, 'forge-station-node--direct': !!directOption(s) }" :style="{ left: s.x + '%', top: s.y + '%' }" @pointerenter="hasMenu(s) && unlocked(s.id) && $event.pointerType !== 'touch' && openMenu(s.id)" @pointerleave="$event.pointerType !== 'touch' && scheduleClose()" @focusin="hasMenu(s) && unlocked(s.id) && openMenu(s.id)" @keydown.esc.stop="openStation = null">
      <CircleIcon size="forge" :icon="s.icon" class="forge-hotspot" :aria-label="directOption(s) ? optionLabel(directOption(s), s) : t('forgeHouse.actions.' + s.id)" :title="directOption(s) ? optionLabel(directOption(s), s) : t('forgeHouse.actions.' + s.id)" :aria-expanded="hasMenu(s) ? openStation === s.id : undefined" :disabled="!!workshop.loading || !unlocked(s.id) || !!workshop.pour && s.id !== 'crucible' || !!directOption(s)?.disabled" @click="activate(s)"/>
      <Transition name="forge-radial"><div v-if="hasMenu(s) && openStation === s.id" class="forge-station-actions" @pointerenter="cancelMenuClose">
        <CircleIcon v-for="(option, index) in stationOptions(s)" :key="option.id" size="job" :icon="option.icon" class="forge-station-option" :class="{ 'forge-map-action--loading': option.id === workshop.loading?.action }" :style="{ '--dx': `${(index - (stationOptions(s).length - 1) / 2) * 28}px`, '--dy': `${-37 - (stationOptions(s).length - 1 - Math.abs(index - (stationOptions(s).length - 1) / 2) * 2) * 3}px` }" :title="optionLabel(option, s)" :aria-label="optionLabel(option, s)" :disabled="!!workshop.loading || !!workshop.pour && s.id !== 'crucible' || option.disabled" @click="option.id !== 'quench' && chooseOption(option, s)" @pointerdown="option.id === 'quench' && beginQuench($event, s.id)" @pointerup="option.id === 'quench' && endQuench()" @pointercancel="option.id === 'quench' && endQuench()" @lostpointercapture="option.id === 'quench' && endQuench()" @keydown.space.prevent="option.id === 'quench' && !$event.repeat && beginQuench($event, s.id)" @keyup.space.prevent="option.id === 'quench' && endQuench()"><ButtonProgressRing v-if="option.id === workshop.loading?.action" :duration="workshop.loading.duration" :remaining="workshop.loading.remaining" /></CircleIcon>
      </div></Transition>
    </div>
    <output v-if="workshop.loading" class="loading-announcement" role="status">{{ t('workshop.loading', { item: t('items.' + (workshop.loading.action === 'coal' || workshop.loading.action === 'loadCarbon' ? 'coal' : workshop.loading.params.itemId) + '.name'), seconds: Math.ceil(workshop.loading.remaining) }) }}</output>
    <button v-if="!workshop.working" class="smithing-start" :disabled="!unlocked('furnace')" @click="cmd('start')">{{ t('workshop.start') }}</button>
    <button v-else class="smithing-stop" :disabled="dialogueBlocked || !!workshop.loading || !!workshop.pour" @click="endQuench(); cmd('stop')">{{ t('workshop.stop') }}</button>
    <output class="forge-temperature" :title="t('workshop.fuel', { seconds: Math.ceil(workshop.fuel) })">{{ t('workshop.temperature', { temperature: Math.round(workshop.temperature) }) }}<small>{{ t('workshop.fuel', { seconds: Math.ceil(workshop.fuel) }) }}</small></output>
    <output v-if="workshop.working && ['reducing', 'melting'].includes(c.stage)" class="crucible-reading">{{ t('workshop.' + c.stage) }} {{ Math.round(c.stage === 'reducing' ? c.reduction : c.melt) }}%</output>
    <output v-if="workshop.working && !['empty', 'loaded'].includes(c.stage)" class="crucible-temperatures">{{ t('workshop.metalHeat', { temperature: Math.round(c.temperature) }) }}<br/>{{ t('workshop.crucibleHeat', { temperature: Math.round(c.vesselTemperature ?? c.temperature) }) }}</output>
    <output v-if="workshop.mould" class="mould-reading">{{ workshop.mould.ruined ? t('workshop.ruinedCasting') : t('workshop.cooling', { seconds: Math.ceil(workshop.mould.remaining) }) }}</output>
    <div class="workshop-rack-art" aria-hidden="true"><img v-for="ingot in workshop.rack" :key="ingot.id" :src="items[ingot.itemId].imageSrc" alt=""/></div>
    <output v-if="b" class="blade-heat-indicator">{{ t('workshop.ingotHeat', { temperature: Math.round(b.temperature) }) }}</output>
    <output v-if="quenching" class="quench-reading">{{ t('workshop.quenchScore', { quality: Math.round(scoreWork(b.quenchWork)) }) }}</output>
  </div><button v-if="!workshop.working" class="interior-back" :disabled="dialogueBlocked" @click="emit('town')">← {{ t('map.backTown') }}</button><p v-if="feedback" class="forge-map-feedback" role="status">{{ t('workshop.' + feedback) }}</p></div>
</template>
<style scoped>
.forge-person{position:absolute;z-index:7;width:clamp(18px,3.5vw,29px);height:clamp(18px,3.5vw,29px);transform:translate(-50%,-95%);border:2px solid #d5bd7b;border-radius:50%;background:#304133;box-shadow:0 3px 3px #0009;pointer-events:none}.forge-person img{width:100%;height:100%;object-fit:cover;border-radius:50%}.forge-person--walking img{animation:pawn-step .35s ease-in-out infinite alternate}.forge-walking{position:absolute;left:35%;top:92%;font-size:10px;padding:3px 6px;background:#23372deb;border:1px solid #b49b63;border-radius:4px;color:#efd59a;pointer-events:none;z-index:9}@keyframes pawn-step{to{transform:translateY(-2px)}}@media(prefers-reduced-motion:reduce){.forge-person--walking img{animation:none}}.workshop-map{position:absolute;inset:0;display:grid;place-items:center;background:#20291e}.workshop-scene{position:relative;width:100%;aspect-ratio:3/2}.workshop-interior{display:block;width:100%;height:100%;object-fit:contain}.forge-temperature{position:absolute;left:76%;top:35%;padding:2px 4px;border:1px solid #b09b63;border-radius:3px;background:#233225eb;color:#ffcb8e;font-size:10px;line-height:1.2;pointer-events:none}.forge-temperature small{display:block;font-size:8px;color:#d8c9a1}.forge-map-action{position:absolute;transform:translate(-50%,-50%);width:21px;height:21px;padding:0;border:1px solid #b6a172;border-radius:50%;background:#314536ed;color:#f0db9f;font-size:11px;z-index:5;cursor:pointer;touch-action:none}.forge-map-action:disabled{opacity:.35;cursor:default}.forge-map-action:hover:not(:disabled),.forge-map-action:focus-visible{background:#7a6541;outline:1px solid #ead198;outline-offset:2px}.molten-indicator,.blade-heat-indicator,.crucible-reading,.mould-reading,.quench-reading{position:absolute;left:59%;top:68%;background:#34412cf5;color:#f1cf83;border:1px solid #d0a553;border-radius:4px;padding:3px;font-size:9px;z-index:6}.blade-heat-indicator{top:23%;left:65%;pointer-events:none}.crucible-reading{left:60%;top:47%;pointer-events:none}.mould-reading{left:70%;top:67%;pointer-events:none}.quench-reading{left:53%;top:73%;pointer-events:none}.workshop-rack-art{position:absolute;left:71%;top:27%;width:17%;display:flex;flex-wrap:wrap;gap:2px;z-index:5}.workshop-rack-art button{width:24px;height:19px;background:#263b28cc;border:1px solid #aa9462;padding:0;border-radius:3px;cursor:pointer}.workshop-rack-art img{width:100%;height:100%;object-fit:contain}.forge-action-ready{background:#812d39!important;color:#ffe4b0;box-shadow:0 0 5px #b44f56;animation:ready-glow 1.4s ease-in-out alternate infinite}.forge-map-feedback{position:absolute;left:52%;right:8px;bottom:8px;margin:0;padding:5px 7px;background:#25362bf2;border:1px solid #a68b56;border-radius:4px;color:#e1ce9d;font-size:10px;pointer-events:none;z-index:19}@keyframes ready-glow{to{box-shadow:0 0 10px #d06c72;filter:brightness(1.15)}}.smithing-start,.smithing-stop{position:absolute;z-index:8;padding:5px 8px;border:1px solid #c2a366;border-radius:5px;background:#293c2eee;color:#efdaa5;font-size:10px;cursor:pointer}.smithing-start{left:71%;top:46%;max-width:27%}.smithing-stop{right:8px;top:8px}.smithing-start:disabled{opacity:.4}@media(prefers-reduced-motion:reduce){.forge-action-ready{animation:none}}@media(max-width:570px){.forge-map-action{width:18px;height:18px;font-size:9px}.forge-temperature{font-size:9px}}
.forge-map-action--loading:disabled{opacity:1}
</style>

<style scoped>.loading-announcement{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}</style>

<style scoped>.crucible-temperatures{position:absolute;left:60%;top:31%;z-index:8;pointer-events:none;background:#25362be8;padding:3px 5px;border:1px solid #9f8955;border-radius:4px;color:#efd19a;font-size:9px}</style>
<style scoped>
/* Readings sit over the three upper rooms, leaving the working floor clear. */
.forge-temperature,.crucible-temperatures,.blade-heat-indicator{top:4%;box-sizing:border-box;text-align:center;z-index:10;pointer-events:none}
.forge-temperature{left:3%;width:23%}
.crucible-temperatures{left:28%;width:28%}
.blade-heat-indicator{left:58%;width:20%}
.smithing-start,.smithing-stop{left:80%;right:auto;top:4%;width:18%;max-width:none;box-sizing:border-box;min-height:24px;padding:3px 4px;text-align:center;line-height:1.15;white-space:normal;z-index:11}
.forge-station-node{position:absolute;width:0;height:0;z-index:12}
.forge-station-node--open{z-index:18}
.forge-station-node .forge-hotspot{left:0;top:0}
.forge-station-node .forge-hotspot:hover:not(:disabled){background:#334638;transform:translate(-50%,-50%)}
.forge-station-node--direct .forge-hotspot:hover:not(:disabled),.forge-station-node--direct .forge-hotspot:focus-visible{background:#8d2630;color:#fff0d2;border-color:#ebc79d}
.forge-station-node--open .forge-hotspot,.forge-station-node--open .forge-hotspot:hover:not(:disabled){background:#8d2630;color:#fff0d2;border-color:#ebc79d;transform:translate(-50%,-50%);box-shadow:0 0 9px 4px #18251ba8}
.forge-station-actions{position:absolute;left:0;top:0;z-index:2}
.forge-station-option{position:absolute;left:0;top:0;--circle-size:21px;--glyph-size:13px;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy)));background:#334638;border-color:#bca774;box-shadow:0 0 8px 5px #101d15a8,0 0 18px 11px #101d1559;transition:transform .18s ease,background .18s ease}
.forge-station-option:hover:not(:disabled),.forge-station-option:focus-visible{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.1);background:#8d2630;color:#fff0d2;outline:none}
.forge-station-option:disabled{opacity:.5;box-shadow:none}
.forge-station-option.forge-map-action--loading:disabled{opacity:1}
.workshop-rack-art img{width:24px;height:19px;object-fit:contain}
.forge-radial-enter-active .forge-station-option{animation:forge-action-open .26s both}
.forge-radial-leave-active .forge-station-option{animation:forge-action-close .23s both;pointer-events:none}
.forge-radial-leave-active .forge-station-option:not(:disabled){background:#334638;color:#f2e3b7;border-color:#bca774}
@keyframes forge-action-open{from{opacity:0;transform:translate(-50%,-50%) scale(.3)}to{opacity:1;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1)}}
@keyframes forge-action-close{from{opacity:1;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1)}to{opacity:0;transform:translate(-50%,-50%) scale(.3)}}
@media(prefers-reduced-motion:reduce){.forge-radial-enter-active .forge-station-option,.forge-radial-leave-active .forge-station-option{animation:none}}
</style>
