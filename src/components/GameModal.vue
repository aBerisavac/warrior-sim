<script setup>
import { canSleep } from '../needs'
import { formatCurrency } from '../currency'
import { MARKET_MERCHANT, merchantSpeaker } from '../merchants'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { translateEntry } from '../i18n/messages'
import TypewriterText from './TypewriterText.vue'
import WoodcuttingGame from './WoodcuttingGame.vue'
import DialogueBubble from './DialogueBubble.vue'
import SpeakerPortrait from './SpeakerPortrait.vue'
import TradingPanel from './TradingPanel.vue'
import characters from '../data/characters.json'
import PlayerInventory from './PlayerInventory.vue'
import CircleIcon from './CircleIcon.vue'
import SkillsPanel from './SkillsPanel.vue'
import { activeQuests, hasQuest, primaryQuest, questById } from '../progression'

const props = defineProps({
  merchantId: { type: String, default: MARKET_MERCHANT },
  audioPaused: { type: Boolean, default: false },
  tradeAgreement: { type: Object, default: null },
  modal: { type: String, default: null },
  game: { type: Object, required: true },
  selectedPlace: { type: Object, required: true },
  tripMinutes: { type: Number, required: true },
  stamina: { type: Number, required: true },
  sleepNeed: { type: Number, required: true },
  moodKey: { type: String, required: true },
  tradeFeedback: { type: Object, default: null },
  tavernReply: { type: String, default: null },
})
const emit = defineEmits(['eat', 'rest', 'trade-offer', 'trade-confirm', 'equip', 'market-notice-read', 'close', 'modal', 'reset', 'tip', 'work', 'wood-finished', 'update:skipWoodcuttingIntro', 'tavern-answer', 'forge', 'sleep'])
const { t } = useI18n()
const placeName = () => t('places.' + props.selectedPlace.id + '.name')
const entryText = (entry) => translateEntry(t, entry)
const currentQuests = computed(() => activeQuests(props.game.completedQuests))
const shownQuests = computed(() => currentQuests.value.length ? currentQuests.value : [primaryQuest(props.game.completedQuests)].filter(Boolean))
const journalTab = ref('quests')
const uniqueJournal = computed(() => {
  const seen = new Set()
  return props.game.journal.filter(entry => { const key = typeof entry === 'string' ? entry : JSON.stringify(entry); if (seen.has(key)) return false; seen.add(key); return true })
})
watch(() => props.modal, () => { journalTab.value = 'quests' })
const portraitOpen = ref(false)
watch([() => props.modal, () => props.merchantId], () => { portraitOpen.value = false })
const writer = ref(null)
const dialogueReady = ref(true)
const woodStarted = ref(false)
const restHours = ref(1)
const woodCompleted = ref(false)
const confirmingWoodExit = ref(false)
const keepWorkingButton = ref(null)
async function requestClose() {
  if (props.modal === 'wood') {
    confirmingWoodExit.value = true
    await nextTick()
    keepWorkingButton.value?.focus()
  } else if (canClose.value) emit('close')
}
function trapExitFocus(event) {
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
  if (!buttons.length) return
  if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus() }
  else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus() }
}
function leaveWoodcutting() { confirmingWoodExit.value = false; emit('close') }
watch(() => props.modal, () => { confirmingWoodExit.value = false })
const marketStep = ref(0)
const marketScene = computed(() => questById('market_job_notice_read').scene[marketStep.value])
watch(() => props.modal, () => { marketStep.value = 0 })
const canClose = computed(() => props.modal === 'trade' || dialogueReady.value && props.modal !== 'marketNotice' && (props.modal !== 'tavern' || !!props.tavernReply))
const abandonedWood = computed(() => props.modal === 'woodDone' && ['cancelled', 'started'].includes(props.game.dailyJobs.wood?.status))
const dialogueSpeaker = computed(() => props.modal === 'tavern' ? 'innkeeper'
  : props.modal === 'marketNotice' && marketStep.value === 2 ? 'notice'
  : props.modal === 'trade' ? merchantSpeaker(props.merchantId) : 'player')
const isInnerThought = computed(() => dialogueSpeaker.value === 'player' && !['event', 'info', 'locked'].includes(props.modal))
const dialogueText = computed(() => {
  const modal = props.modal
  if (modal === 'marketNotice') return t(marketScene.value.textKey)
  if (modal === 'event') return [entryText(props.game.event), props.game.stage !== 'drafted' ? t('modal.injury', { health: props.game.health, stamina: props.stamina }) : ''].filter(Boolean).join(' ')
  if (modal === 'info') return [t('places.' + props.selectedPlace.id + '.description'), !props.selectedPlace.available ? t('modal.lockedHelp') : props.game.location === props.selectedPlace.id ? t('actions.here') : t('modal.walkingHere', { minutes: props.tripMinutes })].join(' ')
  if (modal === 'locked') return t('modal.lockedFuture')
  if (modal === 'trade') return t(props.merchantId === MARKET_MERCHANT ? 'trade.greeting' : 'trade.innGreeting')
  if (modal === 'tavern') return t(props.tavernReply ? 'tavern.reply.' + props.tavernReply : 'tavern.greeting')
  if (modal === 'woodDone') return t(props.game.dailyJobs.wood?.status === 'cancelled' || props.game.dailyJobs.wood?.status === 'started' ? 'dailyJobs.woodAbandoned' : 'dailyJobs.woodDone')
  if (modal === 'dishesDone') return t('dailyJobs.dishesDone')
  if (modal === 'wood') return t('modal.woodHelp')
  if (modal === 'dishes') return t('modal.dishesHelp')
  if (modal === 'forge') return t(!props.game.materials ? 'modal.forgeNeed' : props.game.dagger ? 'modal.forgeDone' : 'modal.forgeHelp')
  if (modal === 'sleep') return [t(props.sleepNeed >= 60 ? 'modal.sleepThoughtExhausted' : props.sleepNeed >= 30 ? 'modal.sleepThoughtTired' : canSleep(props.game) ? 'modal.sleepThoughtEvening' : 'modal.sleepThoughtRest'), t(props.game.location === 'smithy' ? 'modal.sleepThoughtHome' : 'modal.sleepThoughtAway')].join(' ')
  if (modal === 'workbench') return t('modal.workbenchHelp')
  return ''
})
watch([() => props.modal, dialogueText], () => { woodCompleted.value = false; woodStarted.value = props.modal === 'wood' && props.game.skipWoodcuttingIntro === true; dialogueReady.value = woodStarted.value || !dialogueText.value }, { immediate: true })

function titleKey() {
  if (['journal', 'objective'].includes(props.modal)) return 'interface.journal'
  if (props.modal === 'skills') return 'sidebar.skillTree'
  if (props.modal === 'help') return 'sidebar.howToPlay'
  if (props.modal === 'event') return props.game.stage === 'drafted' ? 'modal.title.eventDraft' : 'modal.title.eventBandits'
  if (props.modal === 'woodDone') return 'modal.title.wood'
  if (props.modal === 'dishesDone') return 'modal.title.dishes'
  return 'modal.title.' + props.modal
}
</script>

<template>
  <div v-if="modal" class="map-modal-scrim" :inert="audioPaused" @click.self="requestClose">
    <section :class="['map-modal', { 'map-modal--wood': modal === 'wood', 'map-modal--minigame': ['wood', 'dishes'].includes(modal), 'map-modal--inventory': modal === 'inventory', 'map-modal--trade': modal === 'trade', 'map-modal--portrait': modal === 'trade' && portraitOpen }]" role="dialog" aria-modal="true" :aria-label="t(titleKey())" @click="writer?.reveal()">
      <img v-if="modal === 'trade'" class="merchant-modal-art" :src="characters[merchantSpeaker(merchantId)].sceneSrc" alt="" />
      <div class="modal-top"><span>{{ t(titleKey()) }}</span><button v-if="modal === 'trade'" class="merchant-portrait-toggle" :aria-label="t('trade.viewPortrait')" :aria-pressed="portraitOpen" @click.stop="portraitOpen = !portraitOpen"><SpeakerPortrait :speaker="merchantSpeaker(merchantId)" compact /></button><button :disabled="modal !== 'wood' && !canClose" @click="requestClose" :aria-label="t('modal.close')">×</button></div>

      <DialogueBubble v-if="modal === 'smithingUnavailable'" speaker="player" thought>{{ t('workshop.noSupplies') }}</DialogueBubble>
      <PlayerInventory v-else-if="modal === 'inventory'" :hunger="game.hunger" @eat="emit('eat', $event)" :inventory="game.inventory" :equipment="game.equipment" @equip="emit('equip', $event)" />
      <template v-else-if="modal === 'objective' || modal === 'journal'">
        <nav class="journal-tabs" :aria-label="t('interface.journal')"><button :aria-pressed="journalTab === 'quests'" @click="journalTab = 'quests'">{{ t('sidebar.currentObjective') }}</button><button :aria-pressed="journalTab === 'events'" @click="journalTab = 'events'">{{ t('sidebar.recentEvents') }}</button></nav>
        <div v-if="journalTab === 'quests'">
        <h3>{{ t('sidebar.currentObjective') }}</h3>
        <p v-if="!shownQuests.length">{{ t('sidebar.objectivePendingHint') }}</p>
        <div v-for="quest in shownQuests" :key="quest.id" class="modal-quest">
          <strong>{{ t(hasQuest(game.completedQuests, quest.id) && quest.completedTitleKey ? quest.completedTitleKey : quest.titleKey) }}</strong>
          <p>{{ t(hasQuest(game.completedQuests, quest.id) && quest.completedDescriptionKey ? quest.completedDescriptionKey : quest.descriptionKey) }}</p>
          <ul v-if="!hasQuest(game.completedQuests, quest.id)"><li v-for="step in quest.objectives" :key="step.textKey">{{ t(step.textKey) }}</li></ul>
        </div>
        </div>
        <ul v-else class="modal-journal"><li v-for="(entry, i) in uniqueJournal" :key="i">{{ entryText(entry) }}</li></ul>
      </template>

      <template v-else-if="modal === 'pawn'">
        <h3>{{ t('modal.pawnTitle') }}</h3>
        <p>{{ t('modal.pawnSummary', { age: game.stage === 'drafted' ? 16 : 15, coins: formatCurrency(game.coins, t) }) }}</p>
        <div class="modal-facts">
          <span>{{ t('sidebar.health') }} <b>{{ game.health }}/100</b></span>
          <span>{{ t('sidebar.stamina') }} <b>{{ stamina }}/100</b></span>
          <span>{{ t('modal.awake') }} <b>{{ t('modal.hours', { hours: Math.floor((game.minutes - game.awakeSince) / 60) }) }}</b></span>
          <span>{{ t('modal.ironStock') }} <b>{{ t(game.materials ? 'modal.owned' : 'modal.needed') }}</b></span>
          <span>{{ t('modal.dagger') }} <b>{{ t(game.dagger ? 'modal.forged' : 'modal.notYet') }}</b></span>
        </div>
        <p>{{ t('modal.pawnHelp') }}</p>
      </template>

      <SkillsPanel v-else-if="modal === 'skills'" />
      <template v-else-if="modal === 'help'">
        <h3>{{ t('sidebar.howToPlay') }}</h3><p>{{ t('sidebar.howToPlay1') }}</p><p>{{ t('sidebar.howToPlay2a') }} {{ t('sidebar.townMap') }} {{ t('sidebar.howToPlay2b') }}</p>
        <h3>{{ t('sidebar.survivalRules') }}</h3><p><b>{{ t('sidebar.stayAwake') }}</b> {{ t('sidebar.stayAwakeRule') }}</p><p><b>{{ t('sidebar.getHurt') }}</b> {{ t('sidebar.getHurtRule') }}</p>
        <h3>{{ t('map.growthTitle') }}</h3><p>{{ t('map.growthDescription') }}</p>
        <p class="game-save-note">{{ t('app.saved') }}</p><button class="modal-secondary" @click="emit('modal', 'restart')">↺ {{ t('modal.restartAction') }}</button>
      </template>

      <template v-else-if="modal === 'restart'">
        <h3>{{ t('modal.restartTitle') }}</h3><p>{{ t('modal.restartHelp') }}</p>
        <button class="modal-primary" @click="emit('reset')">{{ t('modal.restartAction') }}</button>
      </template>

      <template v-else-if="modal === 'event'">
        <h3>{{ t(game.stage === 'drafted' ? 'modal.draftTitle' : 'modal.banditsTitle') }}</h3>
      <DialogueBubble v-if="dialogueText" class="modal-dialogue" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>

      </template>

      <template v-else-if="modal === 'info'">
        <h3>{{ placeName() }}</h3>
      <DialogueBubble v-if="dialogueText" class="modal-dialogue" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
      </template>

      <template v-else-if="modal === 'locked'">
        <h3>{{ placeName() }}</h3>
      <DialogueBubble v-if="dialogueText" class="modal-dialogue" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
      </template>

      <template v-else-if="modal === 'trade'">
        <h3>{{ t(merchantId === MARKET_MERCHANT ? 'modal.tradeTitle' : 'trade.innTitle') }}</h3>

      <DialogueBubble v-if="dialogueText" class="modal-dialogue" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
        <p v-if="tradeFeedback" class="modal-feedback" role="status"><TypewriterText :key="entryText(tradeFeedback)" :text="entryText(tradeFeedback)" spoken /></p>
        <TradingPanel :merchant-id="merchantId" :game="game" :agreement="tradeAgreement" :feedback="tradeFeedback" :ready="dialogueReady" @offer="emit('trade-offer', $event)" @confirm="emit('trade-confirm', $event)" @tip="emit('tip')" />

      </template>

      <template v-else-if="modal === 'tavern'">
        <h3>{{ t('tavern.innkeeper') }}</h3>
        <DialogueBubble class="modal-dialogue" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
        <div v-if="!tavernReply" class="tavern-answers">
          <button v-for="reason in ['bandits', 'father', 'work']" :key="reason" type="button" class="modal-secondary" :disabled="!dialogueReady" @click.stop="emit('tavern-answer', reason)"><SpeakerPortrait speaker="player" compact /><q>{{ t('tavern.answer.' + reason) }}</q></button>
        </div>
        <button v-else type="button" class="modal-primary" :disabled="!dialogueReady" @click.stop="emit('close')">{{ t('tavern.acceptWork') }}</button>
        <button class="modal-secondary" type="button" :disabled="!dialogueReady" @click.stop="emit('modal', 'trade')">{{ t('trade.innTitle') }}</button>
      </template>

      <template v-else-if="modal === 'marketNotice'">
        <h3>{{ t('marketNotice.title') }}</h3>
        <DialogueBubble class="modal-dialogue market-notice-copy" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
        <button class="modal-primary" type="button" :disabled="!dialogueReady" @click.stop="marketStep < 2 ? marketStep++ : emit('market-notice-read')">{{ t(marketScene.actionKey) }}</button>
      </template>

      <template v-else-if="modal === 'woodDone' || modal === 'dishesDone'">
        <h3>{{ t(abandonedWood ? 'tavern.innkeeper' : 'dailyJobs.title') }}</h3>
        <DialogueBubble :speaker="abandonedWood ? 'innkeeper' : 'player'" :thought="!abandonedWood"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
        <button type="button" class="modal-primary" :disabled="!dialogueReady" @click.stop="emit('close')">{{ t(abandonedWood ? 'dailyJobs.leaveScolded' : 'dailyJobs.leave') }}</button>
      </template>

      <template v-else-if="modal === 'wood'">
        <div class="woodcut-title-row">
          <h3>{{ t('modal.woodTitle') }}</h3>
          <CircleIcon icon="i" size="guide" class="woodcut-intro-toggle" :class="{ 'woodcut-intro-toggle--off': game.skipWoodcuttingIntro }" :aria-pressed="!game.skipWoodcuttingIntro" :aria-label="t(game.skipWoodcuttingIntro ? 'woodcut.enableIntro' : 'woodcut.disableIntro')" :title="t(game.skipWoodcuttingIntro ? 'woodcut.enableIntro' : 'woodcut.disableIntro')" @click.stop="emit('update:skipWoodcuttingIntro', !game.skipWoodcuttingIntro)" />
        </div>
        <DialogueBubble v-if="dialogueText && (!woodStarted || !game.skipWoodcuttingIntro)" class="modal-dialogue woodcut-intro-text" :class="{ 'woodcut-intro-text--playing': woodStarted }" :tabindex="woodStarted ? 0 : undefined" @click.capture="!woodStarted && (dialogueReady ? woodStarted = true : writer?.reveal())" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)">
          <TypewriterText v-if="!woodStarted" ref="writer" :text="dialogueText" @complete="dialogueReady = true" />
          <span v-else>{{ dialogueText }}</span>
        </DialogueBubble>
        <button v-if="!woodStarted" type="button" class="modal-primary" :disabled="!dialogueReady" @click.stop="woodStarted = true">{{ t('woodcut.start') }}</button>
        <WoodcuttingGame v-if="woodStarted" :inert="confirmingWoodExit || audioPaused" :paused="confirmingWoodExit || audioPaused" :show-opening-tutorial="hasQuest(game.completedQuests, 'iron_errand_accepted') && !hasQuest(game.completedQuests, 'iron_stock_bought')" @completed="woodCompleted = $event" @finish="emit('wood-finished', $event)" />
      </template>

      <template v-else-if="modal === 'dishes'">
        <h3>{{ t('modal.dishesTitle') }}</h3>
      <DialogueBubble v-if="dialogueText" class="modal-dialogue" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
        <button class="modal-primary" :disabled="!dialogueReady" @click="emit('work', 'dishes')">{{ t('modal.dishesAction') }}</button>
      </template>

      <template v-else-if="modal === 'forge'">
        <h3>{{ t('modal.forgeTitle') }}</h3>
      <DialogueBubble v-if="dialogueText" class="modal-dialogue" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
        <template v-if="game.materials && !game.dagger"><button class="modal-primary" :disabled="!dialogueReady" @click="emit('forge')">{{ t('modal.forgeAction') }}</button></template>
      </template>

      <template v-else-if="modal === 'sleep'">
        <h3>{{ t('modal.sleepTitle') }}</h3>
      <DialogueBubble v-if="dialogueText" class="modal-dialogue" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
        <p class="sleep-rest-details">{{ t('modal.sleepHelp', { need: sleepNeed }) }}</p>
        <p v-if="!canSleep(game)" class="rest-restriction">{{ t('needs.sleepThreshold') }}</p>
        <div v-if="game.location === 'smithy'" class="rest-actions"><label>{{ t('needs.restDuration') }}<select v-model.number="restHours" :disabled="!dialogueReady"><option v-for="hours in [1, 2, 4, 8]" :key="hours" :value="hours">{{ t('needs.hours', { hours }) }}</option></select></label><button type="button" class="modal-secondary" :disabled="!dialogueReady" @click="emit('rest', restHours)">{{ t('needs.rest') }}</button></div>
        <p>{{ t(game.location === 'smithy' ? 'needs.restHelp' : 'needs.homeOnly') }}</p>
        <button v-if="game.location === 'smithy'" class="modal-primary" :disabled="!dialogueReady || !canSleep(game)" @click="emit('sleep')">{{ t('modal.sleepAction') }}</button>

      </template>

      <template v-else-if="modal === 'workbench'">
        <h3>{{ t('modal.workbenchTitle') }}</h3>
      <DialogueBubble v-if="dialogueText" class="modal-dialogue" :speaker="dialogueSpeaker" :thought="isInnerThought" :narration="['event', 'info', 'locked'].includes(modal)"><TypewriterText ref="writer" :text="dialogueText" @complete="dialogueReady = true" /></DialogueBubble>
      </template>
      <div v-if="confirmingWoodExit" class="wood-exit-confirmation" @click.stop @keydown.tab="trapExitFocus" @keydown.esc.stop.prevent="confirmingWoodExit = false">
        <div class="wood-exit-card" role="alertdialog" aria-modal="true" aria-labelledby="wood-exit-title" aria-describedby="wood-exit-warning">
          <h3 id="wood-exit-title">{{ t('dailyJobs.cancelTitle') }}</h3>
          <p id="wood-exit-warning">{{ t('dailyJobs.cancelWarning') }}</p>
          <div class="modal-actions"><button ref="keepWorkingButton" class="modal-primary" type="button" @click.stop="confirmingWoodExit = false">{{ t('dailyJobs.keepWorking') }}</button><button class="modal-secondary" type="button" @click.stop="leaveWoodcutting">{{ t('dailyJobs.leaveUnpaid') }}</button></div>
        </div>
      </div>
    </section>
  </div>
</template>
