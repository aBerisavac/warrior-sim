<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { activeQuests, hasQuest, primaryQuest } from '../progression'
const props = defineProps({
  game: { type: Object, required: true },
  mapView: { type: String, required: true },
  stamina: { type: Number, required: true },
  fatigue: { type: Number, required: true },
  injury: { type: Number, required: true },
  day: { type: Number, required: true },
  clock: { type: String, required: true },
  awakeHours: { type: Number, required: true },
})
const { t } = useI18n()
const quest = computed(() => primaryQuest(props.game.completedQuests))
const currentQuests = computed(() => activeQuests(props.game.completedQuests))
const questComplete = computed(() => quest.value && hasQuest(props.game.completedQuests, quest.value.id))
</script>

<template>
  <aside class="left-panel">
    <section class="profile panel">
      <div class="panel-kicker">{{ t('sidebar.yourPawn') }} <span>{{ t('sidebar.age', { age: game.stage === 'drafted' ? 16 : 15 }) }}</span></div>
      <div class="profile-main">
        <div class="portrait"><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="44" fill="#b8aa83"/><path d="M15 84q6-29 30-29t30 29" fill="#4b5644"/><path d="M30 45q-2-26 15-28 19 0 16 27l-5 15H35z" fill="#3e3029"/><ellipse cx="45" cy="43" rx="18" ry="24" fill="#d9b88c"/><path d="M26 39q2-25 20-25 17 0 20 23-9-3-14-12-8 11-26 14" fill="#3c2d25"/><path d="M38 44h2m10 0h2" stroke="#332c25" stroke-width="3" stroke-linecap="round"/><path d="M42 55q4 3 8 0" fill="none" stroke="#865c49" stroke-width="2"/></svg></div>
        <div><div class="profile-name">{{ t('app.smithSon') }}</div><div class="profile-role">{{ t('app.peasantTown') }}</div><div class="profile-coins">◈ <strong>{{ game.coins }}</strong> {{ t('app.coinUnit') }}</div></div>
      </div>
      <div class="stat"><div class="stat-top"><span>{{ t('sidebar.health') }} <small>{{ t('sidebar.wounds') }}</small></span><strong>{{ game.health }} / 100</strong></div><div class="meter"><div class="meter-fill health-fill" :style="{ width: game.health + '%' }"></div></div></div>
      <div class="stat"><div class="stat-top"><span>{{ t('sidebar.stamina') }} <small>{{ t('sidebar.activityStamina') }}</small></span><strong>{{ stamina }} / 100</strong></div><div class="meter"><div class="meter-fill stamina-fill" :style="{ width: stamina + '%' }"></div></div></div>
      <div class="modifier-row"><span>{{ t('sidebar.fatigueCap') }} <b>{{ fatigue }}%</b></span><span>{{ t('sidebar.injuryEffect') }} <b>{{ injury }}%</b></span></div>
    </section>
    <section class="clock-panel panel">
      <div class="panel-kicker">{{ t('sidebar.townTime') }}</div>
      <div class="clock-row"><div><strong>{{ t('sidebar.day', { day }) }}</strong><span>{{ clock }} · {{ t('sidebar.awakeHours', { hours: awakeHours }) }}</span></div><span class="sun-icon">☼</span></div>
      <p>{{ t('sidebar.timeHelp') }}</p>
    </section>
    <section class="objective-panel panel" :class="{ 'tutorial-card-locked': game.stage === 'intro' }">
      <div class="panel-kicker">{{ t('sidebar.currentObjective') }}</div><div class="objective-icon">✧</div>
      <h2>{{ quest ? t(questComplete && quest.completedTitleKey ? quest.completedTitleKey : quest.titleKey) : t('sidebar.objectivePending') }}</h2>
      <p>{{ quest ? t(questComplete && quest.completedDescriptionKey ? quest.completedDescriptionKey : quest.descriptionKey) : t('sidebar.objectivePendingHint') }}</p>
      <ul v-if="quest && !questComplete" class="quest-steps"><li v-for="step in quest.objectives" :key="step.textKey">{{ t(step.textKey) }}</li></ul>
      <div v-if="currentQuests.length > 1" class="quest-more">{{ t('quests.moreActive', { count: currentQuests.length - 1 }) }}</div>
    </section>
    <section class="rules-panel panel">
      <div class="panel-kicker">{{ t('sidebar.survivalRules') }}</div>
      <p><b>{{ t('sidebar.stayAwake') }}</b> {{ t('sidebar.stayAwakeRule') }}</p>
      <p><b>{{ t('sidebar.getHurt') }}</b> {{ t('sidebar.getHurtRule') }}</p>
    </section>
    <section class="skills-panel panel">
      <div class="panel-kicker">{{ t('sidebar.skillTree') }} <span>{{ t('sidebar.comingNext') }}</span></div>
      <div class="skill-node">♡ <span>{{ t('sidebar.vitality') }}</span><i>{{ t('sidebar.locked') }}</i></div>
      <div class="skill-node">◈ <span>{{ t('sidebar.endurance') }}</span><i>{{ t('sidebar.locked') }}</i></div>
      <div class="skill-node">⚔ <span>{{ t('sidebar.melee') }}</span><i>{{ t('sidebar.locked') }}</i></div>
      <div class="skill-node">⬡ <span>{{ t('sidebar.defense') }}</span><i>{{ t('sidebar.locked') }}</i></div>
    </section>
  </aside>
</template>
