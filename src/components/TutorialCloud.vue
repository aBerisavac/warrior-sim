<script setup>
import { useI18n } from 'vue-i18n'
import CircleIcon from './CircleIcon.vue'

defineProps({
  quest: { type: Object, default: null },
  markerOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['accept'])
const { t } = useI18n()
</script>

<template>
  <Transition name="quest-cloud">
    <div v-if="quest?.cloud" class="tutorial-cloud"
      :class="{ 'tutorial-cloud-forge': quest.cloud.mode === 'forge' }" role="status" aria-live="polite">
      <span class="tutorial-cloud-kicker">✧ {{ t('sidebar.currentObjective') }}</span>
      <h3>{{ t(quest.cloud.titleKey) }}</h3>
      <p>{{ t(quest.cloud.messageKey) }}</p>
      <div v-if="quest.cloud.mode === 'town'" class="tutorial-cloud-guide">
        <CircleIcon as="span" size="guide" class="guide-symbol" icon="⚒" />
        <span>{{ t(markerOpen ? quest.cloud.guideOpenKey : quest.cloud.guideClosedKey) }}</span>
        <CircleIcon as="span" size="guide" class="guide-symbol" icon="⌂" />
      </div>
      <button v-else type="button" @click="emit('accept')">{{ t(quest.cloud.acceptKey) }} <span aria-hidden="true">➜</span></button>
    </div>
  </Transition>
</template>
