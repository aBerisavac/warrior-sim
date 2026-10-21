<script setup>
import { formatCurrency } from '../currency'
import { useI18n } from 'vue-i18n'
import { items } from '../inventory'
defineProps({ title: String, side: String, rows: Array, pending: Array, disabled: Boolean })
const emit = defineEmits(['transfer', 'pending'])
const { t } = useI18n()
</script>
<template>
  <section class="trade-inventory-column" :class="'trade-inventory-column--' + side">
    <h3>{{ title }}</h3>
    <div class="trade-pending-zone">
      <h4>{{ t('trade.pendingReceipt') }}</h4>
      <div class="trade-pending-list">
        <p v-if="!pending.length" class="trade-muted">{{ t('trade.nothingIncoming') }}</p>
        <div v-for="row in pending" :key="row.key" class="trade-item-row trade-item-row--pending">
          <img :src="items[row.itemId].imageSrc" alt="" />
          <div><strong>{{ t(items[row.itemId].nameKey) }}</strong><small>{{ t('trade.notTransferred') }}</small></div>
          <input class="trade-pending-quantity" type="number" min="0" :max="row.max" :value="row.quantity" :disabled="disabled" :aria-label="t('trade.quantityOf', { item: t(items[row.itemId].nameKey) })" @change="emit('pending', row.key, Number($event.target.value))" />
          <button type="button" :disabled="disabled" :aria-label="t('trade.returnOne', { item: t(items[row.itemId].nameKey) })" :title="t('trade.returnOne', { item: t(items[row.itemId].nameKey) })" @click="emit('pending', row.key, row.quantity - 1)">{{ side === 'player' ? '→' : '←' }}</button>
        </div>
      </div>
    </div>
    <h4 class="trade-owned-heading">{{ t('trade.currentInventory') }}</h4>
    <div class="trade-inventory-list">
      <p v-if="!rows.length" class="trade-muted">{{ t('trade.noGoods') }}</p>
      <div v-for="row in rows" :key="row.key" class="trade-item-row" :class="{ 'trade-equipped': row.equipped, 'trade-item-row--empty': row.quantity === 0 }">
        <img :src="items[row.itemId].imageSrc" alt="" />
        <div><strong>{{ t(items[row.itemId].nameKey) }}</strong><small>{{ row.equipped ? t('trade.unequipFirst') : t('trade.unitAvailable', { price: formatCurrency(row.price, t), count: row.quantity }) }}</small></div>
        <button type="button" :disabled="disabled || row.blocked || row.quantity <= 0" :aria-label="t(side === 'player' ? 'trade.moveToMerchant' : 'trade.moveToPlayer', { item: t(items[row.itemId].nameKey) })" :title="t(side === 'player' ? 'trade.moveToMerchant' : 'trade.moveToPlayer', { item: t(items[row.itemId].nameKey) })" @click="emit('transfer', row.key)">{{ side === 'player' ? '→' : '←' }}</button>
      </div>
    </div>
  </section>
</template>
