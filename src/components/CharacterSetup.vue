<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import avatars from '../data/avatars.json'
import DialogueBubble from './DialogueBubble.vue'
import TypewriterText from './TypewriterText.vue'
const emit = defineEmits(['complete'])
const { t } = useI18n()
const step = ref('thought')
const ready = ref(false)
const name = ref('')
const avatar = ref(avatars[0])
const writer = ref(null)
function next() { if (!ready.value) { writer.value?.reveal(); return } step.value = 'choose' }
function finish() { emit('complete', { playerName: name.value.trim().slice(0, 32) || t('speakers.player'), avatarSrc: avatar.value }) }
</script>

<template>
  <div class="character-setup-scrim" role="dialog" aria-modal="true" :aria-label="t('character.title')">
    <section class="character-setup">
      <template v-if="step === 'thought'">
        <DialogueBubble speaker="player" thought><TypewriterText ref="writer" :text="t('character.reflection')" @complete="ready = true" /></DialogueBubble>
        <button type="button" @click="next">{{ t('character.continue') }}</button>
      </template>
      <template v-else>
        <h2>{{ t('character.title') }}</h2>
        <label>{{ t('character.name') }}<input v-model="name" maxlength="32" autocomplete="off" :placeholder="t('speakers.player')" /></label>
        <p>{{ t('character.portrait') }}</p>
        <img class="character-avatar-preview" :src="avatar" :alt="t('character.selectedPortrait')" />
        <div class="character-avatar-list" role="group" :aria-label="t('character.portrait')">
          <button v-for="src in avatars" :key="src" type="button" :class="{ selected: avatar === src }" :aria-label="t('character.avatarNumber', { n: avatars.indexOf(src) + 1 })" :aria-pressed="avatar === src" @click="avatar = src"><img :src="src" alt="" loading="lazy" /></button>
        </div>
        <button type="button" class="character-confirm" @click="finish">{{ t('character.begin') }}</button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.character-setup-scrim{position:absolute;inset:0;z-index:120;display:grid;place-items:center;padding:12px;background:#152017d9}.character-setup{width:min(600px,100%);max-height:100%;overflow:auto;padding:20px;background:#2b392c;color:#eadbb9;border:2px solid #a08a5d;border-radius:8px;box-shadow:0 10px 35px #10160de0}.character-setup h2{font:26px Georgia,serif;margin:0 0 16px}.character-setup label{display:grid;gap:7px;font-size:13px}.character-setup input{padding:10px;color:#f3e7c8;background:#1d2c22;border:1px solid #a08a5d;border-radius:4px}.character-setup p{font-size:12px}.character-avatar-preview{display:block;width:160px;height:160px;max-height:24vh;object-fit:contain;margin:0 auto 8px;border:2px solid #bba375;border-radius:7px;background:#1d2c22}.character-avatar-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;max-height:min(40vh,270px);overflow:auto;padding:4px}.character-avatar-list button{padding:0;border:3px solid transparent;background:#1d2c22;border-radius:7px;overflow:hidden;aspect-ratio:1}.character-avatar-list button.selected{border-color:#d7bb7b}.character-avatar-list img{width:100%;height:100%;object-fit:contain}.character-setup>button,.character-confirm{display:block;margin:14px 0 0 auto;padding:10px 17px;background:#8d2630;color:#fff0d2;border:1px solid #caa776;border-radius:5px}.character-setup :focus-visible{outline:2px solid #e9d19c;outline-offset:2px}@media(max-width:570px){.character-setup{padding:12px}.character-avatar-list{grid-template-columns:repeat(4,1fr);max-height:45vh}}
</style>
