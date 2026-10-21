import { formatCurrency } from '../currency'
export function translateEntry(t, entry) {
  if (!entry?.key) return ''
  if (entry.key === 'events.bandits' && !Number.isFinite(entry.params?.coins)) return t('events.banditsLegacy')
  const params = { ...entry.params }
  if (params.placeId) {
    params.place = t('places.' + params.placeId + '.name').toLowerCase()
    delete params.placeId
  }
  for (const key of ['coins', 'price', 'paid', 'received']) if (Number.isFinite(params[key])) params[key] = formatCurrency(params[key], t)
  return t(entry.key, params)
}
