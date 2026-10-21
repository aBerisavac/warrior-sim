export function translateEntry(t, entry) {
  if (!entry?.key) return ''
  const params = { ...entry.params }
  if (params.placeId) {
    params.place = t('places.' + params.placeId + '.name').toLowerCase()
    delete params.placeId
  }
  return t(entry.key, params)
}
