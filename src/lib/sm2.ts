import type { SM2State, ProficiencyLevel, IntervalMode } from '@/types';

/** Hour (0-23) at which a new "review day" begins. 4 AM means late-night sessions count as the previous day. */
export const REVIEW_CUTOFF_HOUR = 4;

/**
 * Returns the timestamp at which the current review-day started.
 * Between 00:00 and 03:59 the current review-day is still the previous calendar day.
 */
export function startOfReviewDay(now: number = Date.now()): number {
  const d = new Date(now);
  const h = d.getHours();
  const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate(), REVIEW_CUTOFF_HOUR, 0, 0, 0);
  if (h < REVIEW_CUTOFF_HOUR) {
    // Before 4 AM → the review-day boundary was yesterday's 4 AM
    cutoff.setDate(cutoff.getDate() - 1);
  }
  return cutoff.getTime();
}

/** End of the current review-day (next 4 AM boundary). */
export function endOfReviewDay(now: number = Date.now()): number {
  return startOfReviewDay(now) + 24 * 60 * 60 * 1000;
}

export function createSM2State(): SM2State {
  return {
    ef: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: Date.now(),
    lastReview: null,
  };
}

const INTERVAL_MULTIPLIERS: Record<IntervalMode, number> = {
  conservative: 0.8,
  standard: 1.0,
  aggressive: 1.4,
};

export function reviewSM2(
  state: SM2State,
  quality: number,
  intervalMode: IntervalMode = 'standard'
): SM2State {
  const q = Math.max(0, Math.min(5, quality));
  let { ef, interval, repetitions } = state;
  const modifier = INTERVAL_MULTIPLIERS[intervalMode];

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(interval * ef * modifier));
    }
    repetitions += 1;
  }

  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < 1.3) ef = 1.3;

  const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    ef,
    interval,
    repetitions,
    nextReview,
    lastReview: Date.now(),
  };
}

export function getProficiency(
  state: SM2State,
  masteryThreshold: number = 5
): ProficiencyLevel {
  if (state.repetitions === 0) return 'new';
  if (state.repetitions < masteryThreshold - 2) return 'familiar';
  return 'mastered';
}

export function isDue(state: SM2State): boolean {
  return Date.now() >= state.nextReview;
}

/** Due within the current review-day (ending at next 4 AM). */
export function isDueToday(state: SM2State): boolean {
  return state.nextReview <= endOfReviewDay();
}

export function isOverdue(state: SM2State): boolean {
  return state.nextReview < Date.now();
}

export function formatNextReview(state: SM2State): string {
  const diff = state.nextReview - Date.now();
  if (diff <= 0) return 'Due now';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 30) return `In ${days} days`;
  return new Date(state.nextReview).toLocaleDateString();
}

export function formatLastReview(state: SM2State): string {
  if (!state.lastReview) return 'Never';
  const diff = Date.now() - state.lastReview;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(state.lastReview).toLocaleDateString();
}
