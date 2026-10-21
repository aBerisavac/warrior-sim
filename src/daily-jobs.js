export const DAILY_JOBS = ['wood', 'dishes']
export const jobDay = minutes => Math.floor(minutes / 1440) + 1
export function normalizeDailyJobs(saved, minutes) {
  const result = {}
  for (const id of DAILY_JOBS) {
    const entry = saved?.[id]
    if (entry && Number.isInteger(entry.day) && entry.day > 0 && entry.day <= jobDay(minutes) && ['started', 'completed', 'cancelled'].includes(entry.status)) result[id] = { day: entry.day, status: entry.status }
  }
  return result
}
export function canStartDailyJob(state, id) {
  return DAILY_JOBS.includes(id) && (!state.dailyJobs[id] || state.dailyJobs[id].day < jobDay(state.minutes))
}
export function canResumeDailyJob(state, id) {
  return DAILY_JOBS.includes(id) && state.dailyJobs[id]?.day === jobDay(state.minutes) && state.dailyJobs[id]?.status === 'started'
}
export function startDailyJob(state, id) {
  if (!canStartDailyJob(state, id)) return false
  state.dailyJobs[id] = { day: jobDay(state.minutes), status: 'started' }
  return true
}
export function endDailyJob(state, id, status = 'completed') {
  if (!['completed', 'cancelled'].includes(status) || state.dailyJobs[id]?.status !== 'started') return false
  state.dailyJobs[id].status = status
  return true
}
