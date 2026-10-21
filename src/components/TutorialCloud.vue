<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TypewriterText from './TypewriterText.vue'
import DialogueBubble from './DialogueBubble.vue'
import SpeakerPortrait from './SpeakerPortrait.vue'
import CircleIcon from './CircleIcon.vue'

const props = defineProps({
  quest: { type: Object, default: null },
  markerOpen: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
})
const emit = defineEmits(['accept', 'ready'])
const writer = ref(null)
const introWriter = ref(null)
const spokenWriter = ref(null)
const spokenReady = ref(false)
const introReady = ref(!props.quest?.cloud?.introKey)
const ready = ref(false)
const showingReply = ref(false)
const conversationIndex = ref(0)
const conversationLine = computed(() => props.quest?.cloud?.conversation?.[conversationIndex.value])
watch(() => props.quest?.id, () => { conversationIndex.value = 0 })
watch(() => props.quest?.id, () => { spokenReady.value = false; introReady.value = !props.quest?.cloud?.introKey; showingReply.value = false; ready.value = false; emit('ready', false) })
function accept() {
  if (!ready.value) return
  if (props.quest?.cloud?.conversation) {
    if (conversationIndex.value < props.quest.cloud.conversation.length - 1) { ready.value = false; emit('ready', false); conversationIndex.value++ }
    else emit('accept')
    return
  }
  if (props.quest?.cloud.replyKey && !showingReply.value) {
    ready.value = false
    emit('ready', false)
    showingReply.value = true
  } else emit('accept')
}
function complete() { ready.value = true; emit('ready', true) }
const { t } = useI18n()
</script>

<template>
  <Transition name="quest-cloud">
    <div v-if="quest?.cloud" v-show="!hidden" :key="quest.id" class="tutorial-cloud"
      :class="{ 'tutorial-cloud-forge': quest.cloud.mode === 'forge' }" role="status" aria-live="polite" @click="(!introReady ? introWriter : quest.cloud.spokenKey && !spokenReady ? spokenWriter : writer)?.reveal()">
      <span class="tutorial-cloud-kicker">✧ {{ t('sidebar.currentObjective') }}</span>
      <h3>{{ t(quest.cloud.titleKey) }}</h3>
      <DialogueBubble v-if="conversationLine" variant="parchment" :speaker="conversationLine.speaker" :thought="conversationLine.thought"><TypewriterText ref="writer" :key="conversationIndex" :text="t(conversationLine.textKey)" @complete="complete" /></DialogueBubble>
      <DialogueBubble variant="parchment" v-if="quest.cloud.introKey" speaker="father"><TypewriterText ref="introWriter" :text="t(quest.cloud.introKey)" @complete="introReady = true" /></DialogueBubble>
      <DialogueBubble v-if="introReady && quest.cloud.spokenKey" variant="parchment" speaker="player" mixed>
        <q><TypewriterText ref="spokenWriter" :delay="1500" spoken :text="t(quest.cloud.spokenKey)" @complete="spokenReady = true" /></q>
        <em v-if="spokenReady" class="dialogue-inner-thought"><TypewriterText ref="writer" :spoken="false" :text="t(quest.cloud.thoughtKey)" @complete="complete" /></em>
      </DialogueBubble>
      <DialogueBubble variant="parchment" v-if="!conversationLine && introReady && !quest.cloud.spokenKey" :speaker="quest.cloud.speaker || (quest.cloud.mode === 'forge' ? 'father' : 'player')" :thought="quest.cloud.mode === 'town'"><TypewriterText ref="writer" :text="t(showingReply ? quest.cloud.replyKey : quest.cloud.messageKey)" @complete="complete" /></DialogueBubble>
      <div v-if="quest.cloud.mode === 'town'" class="tutorial-cloud-guide">
        <CircleIcon as="span" size="guide" class="guide-symbol" icon="⚒" />
        <span>{{ t(markerOpen ? quest.cloud.guideOpenKey : quest.cloud.guideClosedKey) }}</span>
        <CircleIcon as="span" size="guide" class="guide-symbol" icon="⌂" />
      </div>
      <button v-else type="button" :disabled="!ready" @click.stop="accept"><template v-if="conversationLine"><span v-if="conversationIndex < quest.cloud.conversation.length - 1">{{ t('tutorial.continue') }}</span><template v-else><SpeakerPortrait speaker="player" compact /><q>{{ t('tutorial.leaveForIron') }}</q></template></template><template v-else><SpeakerPortrait speaker="player" compact /><q>{{ t(showingReply ? quest.cloud.replyAcceptKey : quest.cloud.acceptKey) }}</q></template><span aria-hidden="true">➜</span></button>
    </div>
  </Transition>
</template>
