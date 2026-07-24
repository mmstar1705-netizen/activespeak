import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import type { Word, Group, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { createSM2State, reviewSM2, getProficiency, isDue, isDueToday } from '@/lib/sm2';
import { getSupabase, getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from '@/lib/supabase';

const STORAGE_KEY = 'activespeak_data_v2';

interface AppData {
  words: Word[];
  groups: Group[];
  settings: Settings;
}

interface StoreContextType {
  words: Word[];
  groups: Group[];
  settings: Settings;
  syncStatus: 'online' | 'offline' | 'unconfigured';
  syncing: boolean;
  manualSync: () => Promise<{ success: boolean; wordCount: number; error?: string }>;
  addWords: (words: Word[]) => void;
  clearWords: () => void;
  updateWord: (id: string, updates: Partial<Word>) => void;
  deleteWord: (id: string) => void;
  resetWordProgress: (id: string) => void;
  togglePauseWord: (id: string) => void;
  reviewWord: (id: string, quality: number, score?: number) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  configureSupabase: (url: string, anonKey: string) => Promise<boolean>;
  disconnectSupabase: () => void;
  getGroupWords: (group: Group) => Word[];
  getDueWords: () => Word[];
  getActiveWords: () => Word[];
  getStats: () => { total: number; new: number; familiar: number; mastered: number; due: number; paused: number };
}

const StoreContext = createContext<StoreContextType | null>(null);

// ── LocalStorage helpers ──

function loadLocalData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        words: (parsed.words ?? []).map((w: any) => ({
          ...w,
          proficiency: w.proficiency ?? 'new',
          paused: w.paused ?? false,
          successCount: w.successCount ?? 0,
          sm2: w.sm2 ?? { ef: 2.5, interval: 0, repetitions: 0, nextReview: Date.now(), lastReview: null },
          createdAt: w.createdAt ?? Date.now(),
          updatedAt: w.updatedAt ?? Date.now(),
        })),
        groups: parsed.groups ?? [],
        settings: {
          ...DEFAULT_SETTINGS,
          ...parsed.settings,
          srs: { ...DEFAULT_SETTINGS.srs, ...(parsed.settings?.srs ?? {}) },
          supabase: parsed.settings?.supabase ?? null,
        },
      };
    }
  } catch {
    // ignore
  }
  return { words: [], groups: [], settings: DEFAULT_SETTINGS };
}

function saveLocalData(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// ── Supabase mappers ──

function dbWordToWord(row: any): Word {
  const now = Date.now();
  return {
    id: row.id,
    word: row.word ?? '',
    meaning: row.meaning ?? '',
    proficiency: row.proficiency ?? 'new',
    sm2: {
      ef: row.ef ?? 2.5,
      interval: row.interval ?? 0,
      repetitions: row.repetitions ?? 0,
      nextReview: row.next_review ? new Date(row.next_review).getTime() : now,
      lastReview: row.last_review ? new Date(row.last_review).getTime() : null,
    },
    paused: row.paused ?? false,
    successCount: row.success_count ?? 0,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : now,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : now,
  };
}

function wordToDbWord(word: Word) {
  return {
    id: word.id,
    word: word.word,
    meaning: word.meaning,
    proficiency: word.proficiency,
    ef: word.sm2.ef,
    interval: word.sm2.interval,
    repetitions: word.sm2.repetitions,
    next_review: new Date(word.sm2.nextReview).toISOString(),
    last_review: word.sm2.lastReview ? new Date(word.sm2.lastReview).toISOString() : null,
    paused: word.paused,
    success_count: word.successCount,
  };
}

// ── Group helpers (in-memory only, derived from words) ──

function buildGroups(words: Word[]): Group[] {
  const groups: Group[] = [];
  const chunkSize = 10;
  for (let i = 0; i < words.length; i += chunkSize) {
    groups.push({
      id: crypto.randomUUID(),
      wordIds: words.slice(i, i + chunkSize).map(w => w.id),
      index: groups.length,
      createdAt: Date.now(),
    });
  }
  return groups;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadLocalData);
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'unconfigured'>('unconfigured');
  const [syncing, setSyncing] = useState(false);
  const isInitialized = useRef(false);
  const skipNextLocalSave = useRef(false);

  // ── Determine sync status on mount ──
  useEffect(() => {
    const config = getSupabaseConfig();
    if (!config) {
      setSyncStatus('unconfigured');
      return;
    }

    // Try to connect and load from Supabase
    (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setSyncStatus('offline');
        return;
      }

      try {
        // Test connection by fetching words
        const { error } = await supabase.from('words').select('id').limit(1);
        if (error) throw error;

        setSyncStatus('online');

        // Load words from Supabase
        const { data: wordRows, error: wordError } = await supabase
          .from('words')
          .select('*')
          .order('created_at', { ascending: true });

        if (wordError) throw wordError;

        // Load settings from Supabase
        const { data: settingsRow } = await supabase
          .from('settings')
          .select('data')
          .eq('id', 1)
          .maybeSingle();

        const supabaseWords = (wordRows ?? []).map(dbWordToWord);
        const supabaseSettings = settingsRow?.data
          ? { ...DEFAULT_SETTINGS, ...settingsRow.data, srs: { ...DEFAULT_SETTINGS.srs, ...(settingsRow.data.srs ?? {}) } }
          : data.settings;

        skipNextLocalSave.current = true;
        setData(prev => ({
          words: supabaseWords.length > 0 ? supabaseWords : prev.words,
          groups: buildGroups(supabaseWords.length > 0 ? supabaseWords : prev.words),
          settings: { ...supabaseSettings, supabase: config },
        }));
      } catch {
        setSyncStatus('offline');
      } finally {
        isInitialized.current = true;
      }
    })();
  }, []);

  // ── Save to LocalStorage on data change ──
  useEffect(() => {
    if (skipNextLocalSave.current) {
      skipNextLocalSave.current = false;
      return;
    }
    saveLocalData(data);
  }, [data]);

  // ── Supabase sync helper ──
  const syncToSupabase = useCallback(async (operation: () => Promise<void>) => {
    if (syncStatus !== 'online') return;
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await operation();
    } catch (err) {
      console.warn('Supabase sync failed, falling back to LocalStorage', err);
      setSyncStatus('offline');
    }
  }, [syncStatus]);

  // ── CRUD operations ──

  const addWords = useCallback((newWords: Word[]) => {
    setData(prev => {
      const allWords = [...prev.words, ...newWords];
      const newGroups = buildGroups(allWords);
      return { ...prev, words: allWords, groups: newGroups };
    });

    syncToSupabase(async () => {
      const supabase = getSupabase()!;
      const rows = newWords.map(wordToDbWord);
      const { error } = await supabase.from('words').insert(rows);
      if (error) throw error;
    });
  }, [syncToSupabase]);

  const clearWords = useCallback(() => {
    setData(prev => ({ ...prev, words: [], groups: [] }));

    syncToSupabase(async () => {
      const supabase = getSupabase()!;
      const { error } = await supabase.from('words').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    });
  }, [syncToSupabase]);

  const updateWord = useCallback((id: string, updates: Partial<Word>) => {
    setData(prev => ({
      ...prev,
      words: prev.words.map(w =>
        w.id === id ? { ...w, ...updates, updatedAt: Date.now() } : w
      ),
    }));

    syncToSupabase(async () => {
      const supabase = getSupabase()!;
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.meaning !== undefined) patch.meaning = updates.meaning;
      if (updates.paused !== undefined) patch.paused = updates.paused;
      if (updates.proficiency !== undefined) patch.proficiency = updates.proficiency;
      if (updates.successCount !== undefined) patch.success_count = updates.successCount;
      if (updates.sm2) {
        patch.ef = updates.sm2.ef;
        patch.interval = updates.sm2.interval;
        patch.repetitions = updates.sm2.repetitions;
        patch.next_review = new Date(updates.sm2.nextReview).toISOString();
        patch.last_review = updates.sm2.lastReview ? new Date(updates.sm2.lastReview).toISOString() : null;
      }
      const { error } = await supabase.from('words').update(patch).eq('id', id);
      if (error) throw error;
    });
  }, [syncToSupabase]);

  const deleteWord = useCallback((id: string) => {
    setData(prev => {
      const words = prev.words.filter(w => w.id !== id);
      const groups = buildGroups(words);
      return { ...prev, words, groups };
    });

    syncToSupabase(async () => {
      const supabase = getSupabase()!;
      const { error } = await supabase.from('words').delete().eq('id', id);
      if (error) throw error;
    });
  }, [syncToSupabase]);

  const resetWordProgress = useCallback((id: string) => {
    const freshSm2 = createSM2State();
    setData(prev => ({
      ...prev,
      words: prev.words.map(w =>
        w.id === id
          ? { ...w, sm2: freshSm2, proficiency: 'new' as const, successCount: 0, updatedAt: Date.now() }
          : w
      ),
    }));

    syncToSupabase(async () => {
      const supabase = getSupabase()!;
      const { error } = await supabase.from('words').update({
        ef: freshSm2.ef,
        interval: freshSm2.interval,
        repetitions: freshSm2.repetitions,
        next_review: new Date(freshSm2.nextReview).toISOString(),
        last_review: null,
        proficiency: 'new',
        success_count: 0,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    });
  }, [syncToSupabase]);

  const togglePauseWord = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      words: prev.words.map(w =>
        w.id === id ? { ...w, paused: !w.paused, updatedAt: Date.now() } : w
      ),
    }));

    syncToSupabase(async () => {
      const supabase = getSupabase()!;
      // Need to read current paused state to toggle
      const { data: row, error: fetchErr } = await supabase.from('words').select('paused').eq('id', id).maybeSingle();
      if (fetchErr || !row) throw fetchErr ?? new Error('Word not found');
      const { error } = await supabase.from('words').update({
        paused: !row.paused,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    });
  }, [syncToSupabase]);

  const reviewWord = useCallback((id: string, quality: number, score?: number) => {
    let updatedWord: Word | null = null;
    setData(prev => ({
      ...prev,
      words: prev.words.map(w => {
        if (w.id !== id) return w;
        const sm2 = reviewSM2(w.sm2, quality, prev.settings.srs.intervalMode);
        const proficiency = getProficiency(sm2, prev.settings.srs.masteryThreshold);
        const successCount = quality >= 3 ? w.successCount + 1 : w.successCount;
        updatedWord = { ...w, sm2, proficiency, successCount, updatedAt: Date.now() };
        return updatedWord;
      }),
    }));

    syncToSupabase(async () => {
      const supabase = getSupabase()!;
      if (!updatedWord) return;

      // Update word
      const { error: wordErr } = await supabase.from('words').update({
        ef: updatedWord.sm2.ef,
        interval: updatedWord.sm2.interval,
        repetitions: updatedWord.sm2.repetitions,
        next_review: new Date(updatedWord.sm2.nextReview).toISOString(),
        last_review: updatedWord.sm2.lastReview ? new Date(updatedWord.sm2.lastReview).toISOString() : null,
        proficiency: updatedWord.proficiency,
        success_count: updatedWord.successCount,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (wordErr) throw wordErr;

      // Insert review log
      const { error: reviewErr } = await supabase.from('reviews').insert({
        word_id: id,
        quality,
        score: score ?? null,
      });
      if (reviewErr) throw reviewErr;
    });
  }, [syncToSupabase]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...updates,
        srs: { ...prev.settings.srs, ...(updates.srs ?? {}) },
      },
    }));

    syncToSupabase(async () => {
      const supabase = getSupabase()!;
      const merged = { ...data.settings, ...updates, srs: { ...data.settings.srs, ...(updates.srs ?? {}) } };
      // Remove supabase config from the stored data — it's stored separately
      const { supabase: _sb, ...storeData } = merged;
      const { error } = await supabase.from('settings').upsert({
        id: 1,
        data: storeData,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    });
  }, [syncToSupabase, data.settings]);

  const configureSupabase = useCallback(async (url: string, anonKey: string): Promise<boolean> => {
    saveSupabaseConfig(url, anonKey);
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('words').select('id').limit(1);
      if (error) throw error;

      setSyncStatus('online');

      // Load data from Supabase
      const { data: wordRows } = await supabase.from('words').select('*').order('created_at', { ascending: true });
      const { data: settingsRow } = await supabase.from('settings').select('data').eq('id', 1).maybeSingle();

      const supabaseWords = (wordRows ?? []).map(dbWordToWord);
      const supabaseSettings = settingsRow?.data
        ? { ...DEFAULT_SETTINGS, ...settingsRow.data, srs: { ...DEFAULT_SETTINGS.srs, ...(settingsRow.data.srs ?? {}) } }
        : data.settings;

      skipNextLocalSave.current = true;
      setData(prev => ({
        words: supabaseWords.length > 0 ? supabaseWords : prev.words,
        groups: buildGroups(supabaseWords.length > 0 ? supabaseWords : prev.words),
        settings: { ...supabaseSettings, supabase: { url, anonKey } },
      }));

      // If local words exist but Supabase is empty, push local words up
      if (data.words.length > 0 && supabaseWords.length === 0) {
        const rows = data.words.map(wordToDbWord);
        await supabase.from('words').insert(rows);
      }

      // Push settings up if none exist
      if (!settingsRow) {
        const { supabase: _sb, ...storeData } = data.settings;
        await supabase.from('settings').upsert({ id: 1, data: storeData, updated_at: new Date().toISOString() });
      }

      return true;
    } catch {
      setSyncStatus('offline');
      return false;
    }
  }, [data]);

  const disconnectSupabase = useCallback(() => {
    clearSupabaseConfig();
    setSyncStatus('unconfigured');
    setData(prev => ({ ...prev, settings: { ...prev.settings, supabase: null } }));
  }, []);

  // ── Manual full sync: push all local words + settings to Supabase ──
  const manualSync = useCallback(async (): Promise<{ success: boolean; wordCount: number; error?: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, wordCount: 0, error: '未配置云端同步，请在 Settings 中连接 Supabase。' };
    }
    setSyncing(true);
    try {
      const wordsToSync = data.words;

      // Push all words: upsert by id
      if (wordsToSync.length > 0) {
        const rows = wordsToSync.map(wordToDbWord);
        const { error: upsertErr } = await supabase.from('words').upsert(rows, { onConflict: 'id' });
        if (upsertErr) throw upsertErr;
      }

      // Push settings
      const { supabase: _sb, ...storeData } = data.settings;
      const { error: settingsErr } = await supabase.from('settings').upsert({
        id: 1,
        data: storeData,
        updated_at: new Date().toISOString(),
      });
      if (settingsErr) throw settingsErr;

      setSyncStatus('online');
      return { success: true, wordCount: wordsToSync.length };
    } catch (err: any) {
      setSyncStatus('offline');
      return { success: false, wordCount: 0, error: err?.message || '同步失败，请检查网络连接。' };
    } finally {
      setSyncing(false);
    }
  }, [data.words, data.settings]);

  const getGroupWords = useCallback(
    (group: Group) => data.words.filter(w => group.wordIds.includes(w.id)),
    [data.words]
  );

  const getDueWords = useCallback(
    () => data.words.filter(w => !(w?.paused) && w?.sm2 && isDueToday(w.sm2)),
    [data.words]
  );

  const getActiveWords = useCallback(
    () => data.words.filter(w => !(w?.paused) && w?.sm2),
    [data.words]
  );

  const getStats = useCallback(() => {
    let newCount = 0, familiar = 0, mastered = 0, paused = 0, due = 0;
    for (const w of data.words) {
      if (!w) continue;
      if (w.paused) { paused++; continue; }
      if (w.proficiency === 'new') newCount++;
      else if (w.proficiency === 'familiar') familiar++;
      else mastered++;
      if (w.sm2 && isDueToday(w.sm2)) due++;
    }
    return { total: data.words.length, new: newCount, familiar, mastered, due, paused };
  }, [data.words]);

  return (
    <StoreContext.Provider
      value={{
        words: data.words,
        groups: data.groups,
        settings: data.settings,
        syncStatus,
        syncing,
        manualSync,
        addWords,
        clearWords,
        updateWord,
        deleteWord,
        resetWordProgress,
        togglePauseWord,
        reviewWord,
        updateSettings,
        configureSupabase,
        disconnectSupabase,
        getGroupWords,
        getDueWords,
        getActiveWords,
        getStats,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
