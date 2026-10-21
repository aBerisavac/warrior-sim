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
    <span class="circle-icon__glyph" aria-hidden="true">{{ icon }}</span>
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
.circle-icon--main{--circle-size:38px;--glyph-size:21px}
.circle-icon--action{--circle-size:34px;--glyph-size:19px}
.circle-icon--job{--circle-size:30px;--glyph-size:17px}
.circle-icon--forge{--circle-size:34px;--glyph-size:19px}
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
  .circle-icon--forge{--circle-size:28px;--glyph-size:16px}
}
</style>
