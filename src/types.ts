export type WordStatus = 'new' | 'learning' | 'reviewing' | 'mastered' | 'paused';

export interface Word {
  id: string;
  word: string;
  meaning: string;
  proficiency: WordStatus;
  ef: number;
  interval: number;
  repetitions: number;
  next_review: number;
  last_review: number | null;
  paused: boolean;
  success_count: number;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  word_id: string;
  quality: number;
  score: number | null;
  feedback?: string | null;
  scene?: string | null;
  user_text?: string | null;
  reviewed_at: string;
}

export interface AppSettings {
  daily_new_limit: number;
  scene_word_count: number;
  mastery_threshold: number;
  interval_mode: 'conservative' | 'standard' | 'aggressive';
}

export type SyncStatus = 'online' | 'offline' | 'syncing';

export interface ToastMsg {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface Scene {
  id: string;
  words: string[];
  prompt: string;
  nativeText: string;
}

export interface ScoreResult {
  score: number;
  feedback: string;
  corrections: string[];
}
