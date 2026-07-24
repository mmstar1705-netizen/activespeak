export type ProficiencyLevel = 'new' | 'familiar' | 'mastered';

export interface Word {
  id: string;
  word: string;
  meaning: string;
  proficiency: ProficiencyLevel;
  sm2: SM2State;
  paused: boolean;
  successCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SM2State {
  ef: number;
  interval: number;
  repetitions: number;
  nextReview: number;
  lastReview: number | null;
}

export interface Group {
  id: string;
  wordIds: string[];
  index: number;
  createdAt: number;
}

export interface Scenario {
  id: string;
  groupId: string;
  prompt: string;
  wordIds: string[];
  createdAt: number;
}

export interface Feedback {
  score: number;
  grammarCorrections: string[];
  nativePolish: string;
  suggestions: string[];
  raw: string;
}

export type IntervalMode = 'conservative' | 'standard' | 'aggressive';

export interface SrsSettings {
  dailyNewLimit: number;
  wordsPerScenario: number;
  masteryThreshold: number;
  intervalMode: IntervalMode;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface Settings {
  apiKey: string;
  model: string;
  baseUrl: string;
  ttsVoice: string;
  ttsRate: number;
  srs: SrsSettings;
  supabase: SupabaseConfig | null;
}

export const DEFAULT_SRS: SrsSettings = {
  dailyNewLimit: 10,
  wordsPerScenario: 3,
  masteryThreshold: 5,
  intervalMode: 'standard',
};

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
  ttsVoice: 'en-US',
  ttsRate: 1,
  srs: DEFAULT_SRS,
  supabase: null,
};

export interface CachedScenario {
  scenario: string;
  semanticGroups: string[][];
  wordIds: string[];
}
