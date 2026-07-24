/**
 * Anki-style rollover: the "new day" boundary is 04:00, not 00:00.
 * If the user practices between 00:00 and 03:59, it still counts as
 * the previous day's practice — it does NOT consume the new day's quota.
 */

export function getRolloverTime(date: Date = new Date()): Date {
  const rollover = new Date(date)
  rollover.setHours(4, 0, 0, 0)
  if (date.getHours() < 4) {
    rollover.setDate(rollover.getDate() - 1)
  }
  return rollover
}

export function getCurrentDayStart(date: Date = new Date()): number {
  return getRolloverTime(date).getTime()
}

export function isSamePracticeDay(timestamp: number, date: Date = new Date()): boolean {
  const dayStart = getCurrentDayStart(date)
  return timestamp >= dayStart && timestamp < dayStart + 24 * 60 * 60 * 1000
}

export function getTodayDateStr(date: Date = new Date()): string {
  return getRolloverTime(date).toISOString().slice(0, 10)
}
