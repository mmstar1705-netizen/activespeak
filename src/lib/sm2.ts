import type { AppSettings } from '@/types'

const DEFAULT_SETTINGS: AppSettings = {
  daily_new_limit: 10,
  scene_word_count: 3,
  mastery_threshold: 5,
  interval_mode: 'standard',
}

export function getDefaultSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS }
}

const MODE_MULTIPLIERS: Record<string, number> = {
  conservative: 0.8,
  standard: 1.0,
  aggressive: 1.3,
}

export interface SM2Result {
  ef: number
  interval: number
  repetitions: number
  next_review: number
}

export function sm2(
  current: { ef: number; interval: number; repetitions: number },
  quality: number,
  mode: string = 'standard',
): SM2Result {
  const mult = MODE_MULTIPLIERS[mode] ?? 1.0
  let { ef, interval, repetitions } = current

  if (quality < 3) {
    repetitions = 0
    interval = 0
  } else {
    repetitions += 1
    if (repetitions === 1) {
      interval = 1
    } else if (repetitions === 2) {
      interval = 6
    } else {
      interval = Math.round(interval * ef * mult)
    }
  }

  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ef < 1.3) ef = 1.3

  const next_review = Date.now() + interval * 24 * 60 * 60 * 1000

  return { ef, interval, repetitions, next_review }
}

export function qualityFromRating(rating: 'again' | 'hard' | 'good' | 'easy'): number {
  switch (rating) {
    case 'again': return 1
    case 'hard': return 3
    case 'good': return 4
    case 'easy': return 5
  }
}

export function isMastered(repetitions: number, masteryThreshold: number): boolean {
  return repetitions >= masteryThreshold
}
