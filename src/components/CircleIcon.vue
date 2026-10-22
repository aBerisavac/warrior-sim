<script setup>
defineProps({
  as: { type: String, default: 'button' },
  icon: { type: String, required: true },
  size: { type: String, default: 'action' },
  tone: { type: String, default: 'default' },
})
</script>

<template>
  <component :is="as" class="circle-icon" :class="['circle-icon--' + size, 'circle-icon--' + tone]"
    :type="as === 'button' ? 'button' : undefined">
    <span class="circle-icon__glyph" aria-hidden="true">
      <svg v-if="['beer', 'scales', 'chat', 'woodcutting', 'skills', 'sound', 'muted'].includes(icon)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="icon === 'beer'"><path d="M5 7h11v14H5zM16 9h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3M8 10v7m5-7v7"/><path d="M4 7V5a2 2 0 0 1 3-1.7 3 3 0 0 1 5-1 3 3 0 0 1 5 2.5V7Z"/></template>
        <template v-else-if="icon === 'scales'"><path d="M12 3v17m-5 1h10M4 6h16M5 6l-3 7h6Zm14 0-3 7h6Z"/><path d="M2 13a3 3 0 0 0 6 0m8 0a3 3 0 0 0 6 0"/></template>
        <template v-else-if="icon === 'chat'"><path d="M20 4H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3v4l5-4h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/><circle cx="7" cy="11" r=".7" fill="currentColor"/><circle cx="12" cy="11" r=".7" fill="currentColor"/><circle cx="17" cy="11" r=".7" fill="currentColor"/></template>
        <template v-else-if="icon === 'skills'"><circle cx="12" cy="4" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="12" cy="21" r="2"/><path d="M12 6v3M5 10V8h14v2M5 14v3h14v-3m-7 3v2"/></template>
        <template v-else-if="icon === 'sound' || icon === 'muted'"><path d="M3 9h5l5-4v14l-5-4H3Z"/><path v-if="icon === 'muted'" d="m17 9 5 6m0-6-5 6"/><path v-else d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></template>
        <template v-else><path d="M4 13h12l1 9H3Z" fill="#85623e"/><ellipse cx="10" cy="13" rx="6" ry="2.5" fill="#b9965b"/><path d="M6 16v4m7-4v4M11 13l6-11" stroke="#d6b477" stroke-width="2.5"/><path d="m14 4 5 3 4-4-7-2Z" fill="#a9b6a3" stroke="#c8d1bb"/></template>
      </svg><template v-else>{{ icon }}</template>
    </span>
    <slot />
  </component>
</template>

<style scoped>
.circle-icon{
  --circle-size:34px;
  --glyph-size:19px;
  display:grid;
  place-items:center;
  flex:none;
  width:var(--circle-size);
  height:var(--circle-size);
  min-width:var(--circle-size);
  min-height:var(--circle-size);
  aspect-ratio:1;
  padding:0;
  border:2px solid #eedcad;
  border-radius:50%;
  background:#334638;
  color:#f2e3b7;
  box-shadow:0 2px 0 #34402f,0 0 0 3px #62563d70;
  line-height:1;
  text-align:center;
  vertical-align:middle;
}
.circle-icon__glyph{
  display:grid;
  place-items:center;
  width:100%;
  height:100%;
  margin:0;
  padding:0;
  font-family:"Segoe UI Symbol","Segoe UI",sans-serif;
  font-size:var(--glyph-size);
  font-weight:400;
  line-height:1;
  text-align:center;
  transform:translate(var(--glyph-x,0px),var(--glyph-y,0px));
}
.circle-icon__glyph svg{width:var(--glyph-size);height:var(--glyph-size);display:block}
.circle-icon--main{--circle-size:38px;--glyph-size:21px}
.circle-icon--action{--circle-size:34px;--glyph-size:19px}
.circle-icon--job{--circle-size:30px;--glyph-size:17px}
.circle-icon--forge{--circle-size:24px;--glyph-size:14px;border-width:1px;box-shadow:0 1px 2px #18251c80,0 0 0 1px #62563d70}
.circle-icon--guide{--circle-size:25px;--glyph-size:16px}
.circle-icon--avatar{--circle-size:42px;--glyph-size:24px}
.circle-icon--ring{
  --circle-size:46px;--glyph-size:22px;
  border:0;background:transparent;box-shadow:none;
}
@media(max-width:570px){
  .circle-icon--main{--circle-size:32px;--glyph-size:18px}
  .circle-icon--action{--circle-size:29px;--glyph-size:17px}
  .circle-icon--job{--circle-size:26px;--glyph-size:15px}
  .circle-icon--forge{--circle-size:24px;--glyph-size:14px}
}
</style>
