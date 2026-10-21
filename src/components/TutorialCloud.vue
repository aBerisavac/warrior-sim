<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TypewriterText from './TypewriterText.vue'
import CircleIcon from './CircleIcon.vue'

const props = defineProps({
  quest: { type: Object, default: null },
  markerOpen: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
})
const emit = defineEmits(['accept', 'ready'])
const writer = ref(null)
const ready = ref(false)
watch(() => props.quest?.id, () => { ready.value = false; emit('ready', false) })
function complete() { ready.value = true; emit('ready', true) }
const { t } = useI18n()
</script>

<template>
  <Transition name="quest-cloud">
    <div v-if="quest?.cloud" v-show="!hidden" :key="quest.id" class="tutorial-cloud"
      :class="{ 'tutorial-cloud-forge': quest.cloud.mode === 'forge' }" role="status" aria-live="polite" @click="writer?.reveal()">
      <span class="tutorial-cloud-kicker">✧ {{ t('sidebar.currentObjective') }}</span>
      <h3>{{ t(quest.cloud.titleKey) }}</h3>
      <p><TypewriterText ref="writer" :text="t(quest.cloud.messageKey)" @complete="complete" /></p>
      <div v-if="quest.cloud.mode === 'town'" class="tutorial-cloud-guide">
        <CircleIcon as="span" size="guide" class="guide-symbol" icon="⚒" />
        <span>{{ t(markerOpen ? quest.cloud.guideOpenKey : quest.cloud.guideClosedKey) }}</span>
        <CircleIcon as="span" size="guide" class="guide-symbol" icon="⌂" />
      </div>
      <button v-else type="button" :disabled="!ready" @click.stop="emit('accept')">{{ t(quest.cloud.acceptKey) }} <span aria-hidden="true">➜</span></button>
    </div>
  </Transition>
</template>
