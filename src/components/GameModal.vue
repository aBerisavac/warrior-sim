<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { translateEntry } from '../i18n/messages'
import { activeQuests, hasQuest, primaryQuest } from '../progression'

const props = defineProps({
  modal: { type: String, default: null },
  game: { type: Object, required: true },
  selectedPlace: { type: Object, required: true },
  tripMinutes: { type: Number, required: true },
  stamina: { type: Number, required: true },
  sleepNeed: { type: Number, required: true },
  askingPrice: { type: Number, required: true },
  offeredPrice: { type: Number, required: true },
  offerPercent: { type: Number, required: true },
  moodKey: { type: String, required: true },
  tradeFeedback: { type: Object, default: null },
})
const emit = defineEmits(['close', 'modal', 'update:offerPercent', 'reset', 'bargain', 'tip', 'work', 'forge', 'sleep'])
const { t } = useI18n()
const placeName = () => t('places.' + props.selectedPlace.id + '.name')
const entryText = (entry) => translateEntry(t, entry)
const currentQuests = computed(() => activeQuests(props.game.completedQuests))
const shownQuests = computed(() => currentQuests.value.length ? currentQuests.value : [primaryQuest(props.game.completedQuests)].filter(Boolean))
function titleKey() {
  if (props.modal === 'event') return props.game.stage === 'drafted' ? 'modal.title.eventDraft' : 'modal.title.eventBandits'
  return 'modal.title.' + props.modal
}
</script>

<template>
  <div v-if="modal" class="map-modal-scrim" @click.self="emit('close')">
    <section class="map-modal" role="dialog" aria-modal="true" :aria-label="t(titleKey())">
      <div class="modal-top"><span>{{ t(titleKey()) }}</span><button @click="emit('close')" :aria-label="t('modal.close')">×</button></div>

      <template v-if="modal === 'objective'">
        <h3>{{ t('sidebar.currentObjective') }}</h3>
        <p v-if="!shownQuests.length">{{ t('sidebar.objectivePendingHint') }}</p>
        <div v-for="quest in shownQuests" :key="quest.id" class="modal-quest">
          <strong>{{ t(hasQuest(game.completedQuests, quest.id) && quest.completedTitleKey ? quest.completedTitleKey : quest.titleKey) }}</strong>
          <p>{{ t(hasQuest(game.completedQuests, quest.id) && quest.completedDescriptionKey ? quest.completedDescriptionKey : quest.descriptionKey) }}</p>
          <ul v-if="!hasQuest(game.completedQuests, quest.id)"><li v-for="step in quest.objectives" :key="step.textKey">{{ t(step.textKey) }}</li></ul>
        </div>
      </template>

      <template v-else-if="modal === 'pawn'">
        <h3>{{ t('modal.pawnTitle') }}</h3>
        <p>{{ t('modal.pawnSummary', { age: game.stage === 'drafted' ? 16 : 15, coins: game.coins }) }}</p>
        <div class="modal-facts">
          <span>{{ t('sidebar.health') }} <b>{{ game.health }}/100</b></span>
          <span>{{ t('sidebar.stamina') }} <b>{{ stamina }}/100</b></span>
          <span>{{ t('modal.awake') }} <b>{{ t('modal.hours', { hours: Math.floor((game.minutes - game.awakeSince) / 60) }) }}</b></span>
          <span>{{ t('modal.ironStock') }} <b>{{ t(game.materials ? 'modal.owned' : 'modal.needed') }}</b></span>
          <span>{{ t('modal.dagger') }} <b>{{ t(game.dagger ? 'modal.forged' : 'modal.notYet') }}</b></span>
        </div>
        <p>{{ t('modal.pawnHelp') }}</p>
      </template>

      <template v-else-if="modal === 'journal'">
        <h3>{{ t('sidebar.fieldNotes') }}</h3>
        <ul class="modal-journal"><li v-for="(entry, i) in game.journal" :key="i">{{ entryText(entry) }}</li></ul>
        <button class="modal-secondary" @click="emit('modal', 'restart')">↺ {{ t('modal.restartAction') }}</button>
      </template>

      <template v-else-if="modal === 'restart'">
        <h3>{{ t('modal.restartTitle') }}</h3><p>{{ t('modal.restartHelp') }}</p>
        <button class="modal-primary" @click="emit('reset')">{{ t('modal.restartAction') }}</button>
      </template>

      <template v-else-if="modal === 'event'">
        <h3>{{ t(game.stage === 'drafted' ? 'modal.draftTitle' : 'modal.banditsTitle') }}</h3>
        <p>{{ entryText(game.event) }}</p>
        <p v-if="game.stage !== 'drafted'">{{ t('modal.injury', { health: game.health, stamina }) }}</p>
      </template>

      <template v-else-if="modal === 'info'">
        <h3>{{ placeName() }}</h3><p>{{ t('places.' + selectedPlace.id + '.description') }}</p>
        <p v-if="!selectedPlace.available">{{ t('modal.lockedHelp') }}</p>
        <p v-else>{{ game.location === selectedPlace.id ? t('actions.here') : t('modal.walkingHere', { minutes: tripMinutes }) }}</p>
      </template>

      <template v-else-if="modal === 'locked'">
        <h3>{{ placeName() }}</h3><p>{{ t('modal.lockedFuture') }}</p>
      </template>

      <template v-else-if="modal === 'trade'">
        <h3>{{ t('modal.tradeTitle') }}</h3>
        <p v-if="game.materials">{{ t('modal.alreadyBought') }}</p>
        <template v-else-if="game.stage === 'robbed'">
          <p>{{ t('modal.sellerAsks', { price: askingPrice, mood: t('modal.mood.' + moodKey).toLowerCase() }) }}</p>
          <label class="offer-label" for="map-offer">{{ t('modal.yourOffer') }} <strong>{{ t('modal.offerValue', { price: offeredPrice, percent: offerPercent }) }}</strong></label>
          <input id="map-offer" :value="offerPercent" @input="emit('update:offerPercent', Number($event.target.value))" type="range" min="75" max="150" step="5" />
          <div class="range-ends"><span>{{ t('modal.marketFloor') }}</span><span>{{ t('modal.marketCeiling') }}</span></div>
          <div class="modal-actions"><button class="modal-primary" @click="emit('bargain')">{{ t('modal.makeOffer') }}</button><button class="modal-secondary" @click="emit('tip')">{{ t('modal.tip') }}</button></div>
          <p v-if="tradeFeedback" class="modal-feedback">{{ entryText(tradeFeedback) }}</p>
        </template>
        <p v-else>{{ t('modal.fatherAsked') }}</p>
      </template>

      <template v-else-if="modal === 'wood'">
        <h3>{{ t('modal.woodTitle') }}</h3><p>{{ t('modal.woodHelp') }}</p>
        <button class="modal-primary" @click="emit('work', 'wood')">{{ t('modal.woodAction') }}</button>
      </template>

      <template v-else-if="modal === 'dishes'">
        <h3>{{ t('modal.dishesTitle') }}</h3><p>{{ t('modal.dishesHelp') }}</p>
        <button class="modal-primary" @click="emit('work', 'dishes')">{{ t('modal.dishesAction') }}</button>
      </template>

      <template v-else-if="modal === 'forge'">
        <h3>{{ t('modal.forgeTitle') }}</h3>
        <p v-if="!game.materials">{{ t('modal.forgeNeed') }}</p>
        <p v-else-if="game.dagger">{{ t('modal.forgeDone') }}</p>
        <template v-else><p>{{ t('modal.forgeHelp') }}</p><button class="modal-primary" @click="emit('forge')">{{ t('modal.forgeAction') }}</button></template>
      </template>

      <template v-else-if="modal === 'sleep'">
        <h3>{{ t('modal.sleepTitle') }}</h3><p>{{ t('modal.sleepHelp', { need: sleepNeed }) }}</p>
        <button v-if="game.location === 'smithy'" class="modal-primary" @click="emit('sleep')">{{ t('modal.sleepAction') }}</button>
        <p v-else>{{ t('modal.sleepAway') }}</p>
      </template>

      <template v-else-if="modal === 'workbench'">
        <h3>{{ t('modal.workbenchTitle') }}</h3><p>{{ t('modal.workbenchHelp') }}</p>
      </template>
    </section>
  </div>
</template>
