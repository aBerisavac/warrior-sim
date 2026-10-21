<script setup>
import WeaponPreview from './WeaponPreview.vue'
import WeaponStats from './WeaponStats.vue'
import { statsForEntry, weaponHands } from '../weapon-design'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { items, equipmentSlots, CARRY_CAPACITY_KG, carriedWeight, entryWeight, slotBlocked, equipItem, unequipItem } from '../inventory'
const props = defineProps({ inventory: { type: Array, required: true }, equipment: { type: Object, required: true }, hunger: { type: Number, default: 0 } })
const emit = defineEmits(['equip', 'eat'])
const { t } = useI18n()
const selected = ref(null)
const view = ref(null)
const menu = ref(null)
const menuOpen = ref(false)
const menuPosition = ref({ left: '0px', top: '0px' })
async function openMenu(id, event) {
  selected.value = id
  if (!id) { menuOpen.value = false; return }
  const rect = view.value.getBoundingClientRect()
  const anchor = event.currentTarget.getBoundingClientRect()
  const bounds = view.value.closest('.map-modal').getBoundingClientRect()
  menuPosition.value = { left: `${Math.max(0, Math.min(anchor.left - rect.left, rect.width - 185))}px`, top: `${Math.max(0, Math.min(anchor.bottom - rect.top + 4, bounds.bottom - rect.top - 190))}px` }
  menuOpen.value = true
  await nextTick()
  menu.value?.querySelector('button:not(:disabled)')?.focus()
}
function moveMenuFocus(event, direction) {
  const buttons = [...menu.value.querySelectorAll('button:not(:disabled)')]
  if (!buttons.length) return
  const index = buttons.indexOf(document.activeElement)
  buttons[(index + direction + buttons.length) % buttons.length].focus()
}
function closeMenu() { menuOpen.value = false }
function eat() { emit('eat', selected.value); closeMenu() }

const activeSlot = ref(null)
const category = ref('all')
const weight = computed(() => carriedWeight(props.inventory))
const entryItem = entry => ({ ...items[entry.itemId], hands: entry.craft?.design ? weaponHands(entry.craft.design) : items[entry.itemId].hands })
const entryName = entry => entry.craft?.design?.name || t(entryItem(entry).nameKey)
const slotEntry = slot => props.inventory.find(entry => entry.id === props.equipment[slot])
const equippedSlot = id => equipmentSlots.find(slot => props.equipment[slot] === id)
const selectedEntry = computed(() => props.inventory.find(entry => entry.id === selected.value))
const selectedItem = computed(() => selectedEntry.value ? entryItem(selectedEntry.value) : null)
const bagItems = computed(() => props.inventory.filter(entry => !equippedSlot(entry.id) && (!activeSlot.value || entryItem(entry).equipSlot === activeSlot.value) && (category.value === 'all' || entryItem(entry).category === category.value)))
function selectSlot(slot, event) {
  activeSlot.value = activeSlot.value === slot ? null : slot
  selected.value = slotEntry(slot)?.id || null
  openMenu(selected.value, event)
}
function equip() {
  if (!selectedItem.value) return
  const next = equipItem(props.inventory, props.equipment, selected.value, selectedItem.value.equipSlot)
  if (next) emit('equip', next)
  closeMenu()
}
function unequip() { emit('equip', unequipItem(props.equipment, equippedSlot(selected.value))); closeMenu() }
</script>

<template>
  <div ref="view" class="inventory-view" @click="closeMenu" @keydown.esc.stop="closeMenu">
    <header class="inventory-heading"><h3>{{ t('inventory.title') }}</h3><span :class="{ 'inventory-overweight': weight > CARRY_CAPACITY_KG }">{{ t('inventory.weight', { weight: weight.toFixed(2), capacity: CARRY_CAPACITY_KG }) }}</span></header>
    <p class="inventory-hunger">{{ t('needs.hungerValue', { hunger: Math.round(hunger) }) }}</p>
    <div class="inventory-columns">
      <section class="inventory-equipment" :aria-label="t('inventory.equipment')">
        <div class="inventory-paperdoll">
          <svg class="inventory-silhouette" viewBox="0 0 200 320" aria-hidden="true">
            <ellipse cx="100" cy="44" rx="22" ry="28"/><path d="M86 67h28l9 17 23 8 17 80-15 8-22-59-3 82-6 98H99l-3-96-3 96H75l-3-98 5-82-25 59-15-8 22-80 23-8Z"/>
          </svg>
          <button v-for="slot in equipmentSlots.filter(slot => slot !== 'tool')" :key="slot" type="button" class="inventory-slot" :class="['inventory-slot--' + slot, { 'inventory-slot--selected': activeSlot === slot }]" :disabled="slotBlocked(inventory, equipment, slot)" :aria-label="t('inventory.slots.' + slot) + (slotEntry(slot) ? ': ' + t(entryItem(slotEntry(slot)).nameKey) : '')" :title="slotBlocked(inventory, equipment, slot) ? t(slot === 'shield' ? 'inventory.bothHands' : 'inventory.bowRequired') : t('inventory.slots.' + slot)" @click.stop="selectSlot(slot, $event)" @contextmenu.prevent.stop="selectSlot(slot, $event)">
            <WeaponPreview v-if="slotEntry(slot)?.craft?.design" :design="slotEntry(slot).craft.design"/><img v-else-if="slotEntry(slot)" :src="entryItem(slotEntry(slot)).imageSrc" alt="" />
            <span v-else class="inventory-empty-symbol" aria-hidden="true">{{ slotBlocked(inventory, equipment, slot) ? '×' : '+' }}</span>
            <small>{{ t('inventory.slots.' + slot) }}</small>
          </button>
        </div>
        <div class="inventory-tools"><span>{{ t('inventory.tools') }}</span><button type="button" class="inventory-slot inventory-tool-slot" :class="{ 'inventory-slot--selected': activeSlot === 'tool' }" :aria-label="t('inventory.slots.tool')" @click.stop="selectSlot('tool', $event)" @contextmenu.prevent.stop="selectSlot('tool', $event)"><img v-if="slotEntry('tool')" :src="entryItem(slotEntry('tool')).imageSrc" alt="" /><span v-else>+</span></button></div>
      </section>
      <section class="inventory-bag" :aria-label="t('inventory.carried')">
        <label>{{ t('workshop.category') }} <select v-model="category"><option v-for="id in ['all', 'apparel', 'weapons', 'tools', 'materials', 'food']" :key="id" :value="id">{{ t('workshop.' + id) }}</option></select></label>
        <div class="inventory-bag-heading"><strong>{{ activeSlot ? t('inventory.slots.' + activeSlot) : t('inventory.carried') }}</strong><button v-if="activeSlot" type="button" @click="activeSlot = null">{{ t('inventory.showAll') }}</button></div>
        <div class="inventory-item-grid">
          <button v-for="entry in bagItems" :key="entry.id" type="button" :class="{ selected: selected === entry.id }" :aria-label="entryName(entry)" :title="entryName(entry)" @click.stop="openMenu(entry.id, $event)" @contextmenu.prevent.stop="openMenu(entry.id, $event)"><WeaponPreview v-if="entry.craft?.design" :design="entry.craft.design"/><img v-else :src="entryItem(entry).imageSrc" alt="" /><small>{{ entryName(entry) }}</small><span v-if="entry.quantity > 1">×{{ entry.quantity }}</span></button>
        </div>
        <p v-if="!bagItems.length" class="inventory-empty">{{ t(activeSlot ? 'inventory.noMatching' : 'inventory.emptyBag') }}</p>
        <div v-if="selectedItem" class="inventory-item-details">
          <strong>{{ selectedEntry.craft?.design?.name || t(selectedItem.nameKey) }}</strong><WeaponPreview v-if="selectedEntry.craft?.design" :design="selectedEntry.craft.design"/><WeaponStats :stats="statsForEntry(selectedEntry)"/><p>{{ t(selectedItem.descriptionKey) }}</p>
          <span>{{ t('inventory.itemWeight', { weight: entryWeight(selectedEntry) }) }}</span>
          <span v-if="selectedEntry.craft">{{ t('workshop.savedCraft', { quality: selectedEntry.craft.quality }) }}</span>
          <span v-if="selectedItem.hands === 2">{{ t('inventory.twoHanded') }}</span>
          <button v-if="selectedItem.category === 'food'" class="modal-primary" type="button" :disabled="hunger <= 0 && selectedItem.useAction !== 'drink'" @click="eat">{{ t(selectedItem.useAction === 'drink' ? 'inventory.drink' : 'inventory.eat') }}</button>
          <button v-else-if="equippedSlot(selected)" class="modal-secondary" type="button" @click="unequip">{{ t('inventory.unequip') }}</button>
          <button v-else-if="equipmentSlots.includes(selectedItem.equipSlot)" class="modal-primary" type="button" :disabled="slotBlocked(inventory, equipment, selectedItem.equipSlot)" @click="equip">{{ t('inventory.equip') }}</button>
          <p v-if="slotBlocked(inventory, equipment, selectedItem.equipSlot)">{{ t(selectedItem.equipSlot === 'waist' ? 'inventory.bowRequired' : 'inventory.bothHands') }}</p>
        </div>
        <p v-else class="inventory-empty">{{ t('inventory.selectHint') }}</p>
      </section>
    </div>
    <div v-if="menuOpen && selectedItem" ref="menu" class="inventory-context-menu" :style="menuPosition" role="menu" :aria-label="t(selectedItem.nameKey)" @keydown.down.prevent="moveMenuFocus($event, 1)" @keydown.up.prevent="moveMenuFocus($event, -1)" @click.stop>
      <strong>{{ entryName(selectedEntry) }}</strong>
      <button v-if="selectedItem.category === 'food'" type="button" role="menuitem" :disabled="hunger <= 0 && selectedItem.useAction !== 'drink'" @click="eat">{{ t(selectedItem.useAction === 'drink' ? 'inventory.drink' : 'inventory.eat') }} <small>{{ t('needs.foodRestore', { amount: selectedItem.hungerRestore }) }}</small></button>
      <button v-if="equippedSlot(selected)" type="button" role="menuitem" @click="unequip">{{ t('inventory.unequip') }}</button>
      <button v-else-if="equipmentSlots.includes(selectedItem.equipSlot)" type="button" role="menuitem" :disabled="slotBlocked(inventory, equipment, selectedItem.equipSlot)" @click="equip">{{ t('inventory.equip') }}</button>
      <button type="button" role="menuitem" @click="closeMenu">{{ t('inventory.inspect') }}</button>
    </div>
  </div>
</template>

<style scoped>
.inventory-heading,.inventory-bag-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.inventory-heading span{font-size:11px;color:#d3bc82}.inventory-heading h3{margin:8px 0 12px}.inventory-overweight{color:#e9977e!important}.inventory-columns{display:grid;grid-template-columns:1.1fr 1fr;gap:16px}.inventory-equipment{background:radial-gradient(ellipse,#69705230,transparent 75%),#1e2d24;border:1px solid #6d715144;border-radius:5px;padding:6px}.inventory-paperdoll{height:345px;position:relative}.inventory-silhouette{position:absolute;left:25%;top:12px;width:50%;height:310px;fill:#61705a;stroke:#a5a27a;stroke-width:1;opacity:.65}.inventory-slot{position:absolute;width:49px;height:49px;border:1px solid #93825a;border-radius:5px;background:linear-gradient(145deg,#45503a,#26362b);color:#a6ad8f;padding:3px;box-shadow:inset 0 0 10px #101b1466}.inventory-slot img{width:100%;height:100%;object-fit:contain}.inventory-slot small{position:absolute;left:50%;top:100%;transform:translateX(-50%);font-size:9px;color:#c5c6a8;white-space:nowrap;line-height:14px}.inventory-slot--selected{border-color:#e9ca87;box-shadow:0 0 0 2px #c8a35b55}.inventory-slot:disabled{opacity:.38}.inventory-empty-symbol{font-size:23px}.inventory-slot--helmet{top:5px;left:12%}.inventory-slot--amulet{top:66px;right:10%}.inventory-slot--weapon{top:128px;left:3%}.inventory-slot--shield{top:128px;right:3%}.inventory-slot--armor{top:97px;left:calc(50% - 24px)}.inventory-slot--back{top:5px;right:10%}.inventory-slot--waist{top:204px;right:3%}.inventory-slot--shoes{top:278px;left:12%}.inventory-tools{display:flex;gap:12px;align-items:center;justify-content:center;border-top:1px solid #7c795044;padding:10px;font-size:10px;color:#b9bc9e}.inventory-tool-slot{position:static}.inventory-bag{min-width:0}.inventory-bag-heading{min-height:28px;color:#dcc58f;font-size:11px}.inventory-bag-heading button{background:none;border:0;color:#cdbb8b;font-size:10px;text-decoration:underline}.inventory-item-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px}.inventory-item-grid button{position:relative;min-height:83px;padding:5px;border:1px solid #697454;border-radius:4px;background:#203026;color:#cbd1b8}.inventory-item-grid button.selected{border-color:#dec48a;background:#454c33}.inventory-item-grid img{width:45px;height:45px}.inventory-item-grid small{display:block;font-size:9px}.inventory-item-grid span{position:absolute;top:3px;right:3px;font-size:9px}.inventory-item-details{display:grid;gap:7px;padding:12px 0;border-top:1px solid #75826455;margin-top:12px;font-size:11px;color:#d7c28e}.inventory-item-details p{margin:0;font-size:11px}.inventory-empty{font-size:11px!important;color:#9fae96!important}.inventory-bag{overflow-wrap:anywhere}@media(max-width:520px){.inventory-columns{grid-template-columns:1fr}.inventory-paperdoll{height:330px}.inventory-equipment{max-width:340px;width:100%;margin:auto}}
.inventory-view{position:relative}.inventory-hunger{font-size:11px!important;margin:0 0 10px!important;color:#c7b788!important}.inventory-context-menu{position:absolute;z-index:80;width:185px;padding:8px;border:1px solid #ae955f;border-radius:5px;background:#26382bf7;box-shadow:0 5px 18px #09150dbb;display:grid;gap:4px}.inventory-context-menu>strong{color:#e0c58b;font-size:11px;padding:3px 5px 6px;border-bottom:1px solid #8e80534d}.inventory-context-menu button{text-align:left;padding:8px;background:#3c4c36;border:1px solid #71805b66;border-radius:3px;color:#e1d5b3;font-size:11px}.inventory-context-menu button:hover:not(:disabled){background:#596047}.inventory-context-menu small{display:block;color:#b9c3a5;font-size:9px;margin-top:3px}
</style>



<style scoped>.inventory-item-grid .weapon-preview{height:48px;max-width:100%;overflow:hidden}.inventory-slot .weapon-preview{height:32px;max-width:100%;overflow:hidden}</style>
