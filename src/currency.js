export const COPPER_PER_SILVER = 1000
export const COPPER_PER_GOLD = 1000000
export const DISHES_PAY = 40
export const MERCHANT_TIP = 5
export function currencyParts(amount) {
  const value = Math.round(Math.abs(Number.isFinite(amount) ? amount : 0))
  const parts = [{ unit: 'gold', count: Math.floor(value / COPPER_PER_GOLD) }, { unit: 'silver', count: Math.floor(value / COPPER_PER_SILVER) % 1000 }, { unit: 'copper', count: value % 1000 }]
  return parts.filter(part => part.count > 0 || (value === 0 && part.unit === 'copper'))
}
export function formatCurrency(amount, t) {
  return (amount < 0 ? '−' : '') + currencyParts(amount).map(part => t('currency.' + part.unit, { count: part.count })).join(' ')
}
export function sellUnitPrice(item) { return Math.floor(item.basePrice / 2) }
