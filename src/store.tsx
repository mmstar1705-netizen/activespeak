import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import type { Word, Review, AppSettings, SyncStatus, ToastMsg } from '@/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getDefaultSettings } from '@/lib/sm2'
import { getCurrentDayStart } from '@/lib/rollover'

const LS_WORDS = 'activespeak_words'
const LS_REVIEWS = 'activespeak_reviews'
const LS_SETTINGS = 'activespeak_settings'
const LS_LAST_SYNC = 'activespeak_last_sync'

interface StoreContextValue {
  words: Word[]
  reviews: Review[]
  settings: AppSettings
  syncStatus: SyncStatus
  toasts: ToastMsg[]
  isOnline: boolean
  addWords: (words: { word: string; meaning: string }[]) => Promise<void>
  updateWord: (id: string, updates: Partial<Word>) => Promise<void>
  deleteWord: (id: string) => Promise<void>
  resetWordProgress: (id: string) => Promise<void>
  togglePauseWord: (id: string) => Promise<void>
  addReview: (review: Omit<Review, 'id' | 'reviewed_at'>) => Promise<void>
  updateSettings: (settings: AppSettings) => Promise<void>
  manualSync: () => Promise<void>
  showToast: (type: ToastMsg['type'], message: string) => void
  dismissToast: (id: string) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveToLS<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or unavailable
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [words, setWords] = useState<Word[]>(() => loadFromLS(LS_WORDS, []))
  const [reviews, setReviews] = useState<Review[]>(() => loadFromLS(LS_REVIEWS, []))
  const [settings, setSettings] = useState<AppSettings>(() => loadFromLS(LS_SETTINGS, getDefaultSettings()))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline')
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const syncingRef = useRef(false)

  const showToast = useCallback((type: ToastMsg['type'], message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Online/offline detection
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Persist to localStorage on every change
  useEffect(() => { saveToLS(LS_WORDS, words) }, [words])
  useEffect(() => { saveToLS(LS_REVIEWS, reviews) }, [reviews])
  useEffect(() => { saveToLS(LS_SETTINGS, settings) }, [settings])

  // Cloud sync: pull from Supabase
  const pullFromCloud = useCallback(async (): Promise<{ words: Word[]; reviews: Review[]; settings: AppSettings } | null> => {
    if (!isSupabaseConfigured) return null
    try {
      const [wordsRes, reviewsRes, settingsRes] = await Promise.all([
        supabase.from('words').select('*'),
        supabase.from('reviews').select('*'),
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      ])

      if (wordsRes.error) throw wordsRes.error
      if (reviewsRes.error) throw reviewsRes.error

      const cloudWords = (wordsRes.data || []) as Word[]
      const cloudReviews = (reviewsRes.data || []) as Review[]
      const cloudSettings: AppSettings = settingsRes.data?.data
        ? { ...(getDefaultSettings()), ...(settingsRes.data.data as object) }
        : getDefaultSettings()

      return { words: cloudWords, reviews: cloudReviews, settings: cloudSettings }
    } catch (err) {
      console.error('Pull failed:', err)
      return null
    }
  }, [])

  // Cloud sync: push to Supabase
  const pushToCloud = useCallback(async (): Promise<number> => {
    if (!isSupabaseConfigured) throw new Error('Cloud not configured')

    // Upsert words
    if (words.length > 0) {
      const { error: wErr } = await supabase
        .from('words')
        .upsert(words, { onConflict: 'id' })
      if (wErr) throw new Error(`Words sync failed: ${wErr.message}`)
    }

    // Upsert reviews
    if (reviews.length > 0) {
      const { error: rErr } = await supabase
        .from('reviews')
        .upsert(reviews, { onConflict: 'id' })
      if (rErr) throw new Error(`Reviews sync failed: ${rErr.message}`)
    }

    // Upsert settings
    const { error: sErr } = await supabase
      .from('settings')
      .upsert({ id: 1, data: settings, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (sErr) throw new Error(`Settings sync failed: ${sErr.message}`)

    saveToLS(LS_LAST_SYNC, Date.now())
    return words.length
  }, [words, reviews, settings])

  // Merge cloud data with local (cloud takes precedence for new items, local keeps unsynced)
  const mergeData = useCallback((
    cloud: { words: Word[]; reviews: Review[]; settings: AppSettings },
    localWords: Word[],
    localReviews: Review[],
    localSettings: AppSettings,
  ): { words: Word[]; reviews: Review[]; settings: AppSettings } => {
    const wordMap = new Map<string, Word>()
    // Start with local (in case there are unsynced local items)
    localWords.forEach((w) => wordMap.set(w.id, w))
    // Cloud overrides (newer updated_at wins)
    cloud.words.forEach((w) => {
      const existing = wordMap.get(w.id)
      if (!existing || new Date(w.updated_at) >= new Date(existing.updated_at)) {
        wordMap.set(w.id, w)
      }
    })

    const reviewMap = new Map<string, Review>()
    localReviews.forEach((r) => reviewMap.set(r.id, r))
    cloud.reviews.forEach((r) => {
      const existing = reviewMap.get(r.id)
      if (!existing || new Date(r.reviewed_at) >= new Date(existing.reviewed_at)) {
        reviewMap.set(r.id, r)
      }
    })

    // Settings: cloud wins if updated_at is newer
    const cloudSettingsTime = cloud.settings ? Date.now() : 0
    const localSettingsTime = loadFromLS(LS_LAST_SYNC, 0)
    const mergedSettings = cloudSettingsTime >= localSettingsTime ? cloud.settings : localSettings

    return {
      words: Array.from(wordMap.values()),
      reviews: Array.from(reviewMap.values()),
      settings: mergedSettings,
    }
  }, [])

  // Auto sync on app load and when coming online
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSyncStatus('offline')
      return
    }
    if (!isOnline) {
      setSyncStatus('offline')
      return
    }

    let cancelled = false
    const doInitialSync = async () => {
      if (syncingRef.current) return
      syncingRef.current = true
      setSyncStatus('syncing')
      try {
        const cloud = await pullFromCloud()
        if (cloud && !cancelled) {
          const merged = mergeData(cloud, words, reviews, settings)
          setWords(merged.words)
          setReviews(merged.reviews)
          setSettings(merged.settings)
        }
        if (!cancelled) setSyncStatus('online')
      } catch {
        if (!cancelled) setSyncStatus('offline')
      } finally {
        syncingRef.current = false
      }
    }
    doInitialSync()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  const manualSync = useCallback(async () => {
    if (!isSupabaseConfigured) {
      showToast('error', 'Cloud not configured — running in local-only mode.')
      return
    }
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncStatus('syncing')
    try {
      // First pull, then push
      const cloud = await pullFromCloud()
      if (cloud) {
        const merged = mergeData(cloud, words, reviews, settings)
        setWords(merged.words)
        setReviews(merged.reviews)
        setSettings(merged.settings)
      }
      const count = await pushToCloud()
      setSyncStatus('online')
      showToast('success', `已成功同步 ${count} 个单词`)
    } catch (err: any) {
      setSyncStatus('offline')
      showToast('error', `同步失败: ${err.message || 'Unknown error'}`)
    } finally {
      syncingRef.current = false
    }
  }, [words, reviews, settings, pullFromCloud, pushToCloud, mergeData, showToast])

  // --- CRUD operations (write to local state + attempt cloud write) ---

  const addWords = useCallback(async (newWords: { word: string; meaning: string }[]) => {
    const now = Date.now()
    const dayStart = getCurrentDayStart()
    const wordRows: Word[] = newWords.map((w, i) => ({
      id: crypto.randomUUID(),
      word: w.word,
      meaning: w.meaning,
      proficiency: 'new' as const,
      ef: 2.5,
      interval: 0,
      repetitions: 0,
      next_review: dayStart,
      last_review: null,
      paused: false,
      success_count: 0,
      created_at: new Date(now + i).toISOString(),
      updated_at: new Date(now + i).toISOString(),
    }))
    setWords((prev) => [...prev, ...wordRows])

    // Cloud insert (fire and forget)
    if (isSupabaseConfigured && isOnline) {
      try {
        await supabase.from('words').insert(wordRows)
      } catch { /* will sync later */ }
    }
  }, [isOnline])

  const updateWord = useCallback(async (id: string, updates: Partial<Word>) => {
    const updateData = { ...updates, updated_at: new Date().toISOString() }
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, ...updateData } : w)))
    if (isSupabaseConfigured && isOnline) {
      try {
        await supabase.from('words').update(updateData).eq('id', id)
      } catch { /* will sync later */ }
    }
  }, [isOnline])

  const deleteWord = useCallback(async (id: string) => {
    setWords((prev) => prev.filter((w) => w.id !== id))
    setReviews((prev) => prev.filter((r) => r.word_id !== id))
    if (isSupabaseConfigured && isOnline) {
      try {
        await supabase.from('words').delete().eq('id', id)
      } catch { /* will sync later */ }
    }
  }, [isOnline])

  const resetWordProgress = useCallback(async (id: string) => {
    await updateWord(id, {
      ef: 2.5,
      interval: 0,
      repetitions: 0,
      next_review: getCurrentDayStart(),
      last_review: null,
      proficiency: 'new',
      success_count: 0,
    })
  }, [updateWord])

  const togglePauseWord = useCallback(async (id: string) => {
    setWords((prev) => {
      const word = prev.find((w) => w.id === id)
      if (!word) return prev
      const newPaused = !word.paused
      const updateData = {
        paused: newPaused,
        proficiency: newPaused ? 'paused' as const : 'new' as const,
        updated_at: new Date().toISOString(),
      }
      if (isSupabaseConfigured && isOnline) {
        supabase.from('words').update(updateData).eq('id', id).then(() => {})
      }
      return prev.map((w) => (w.id === id ? { ...w, ...updateData } : w))
    })
  }, [isOnline])

  const addReview = useCallback(async (review: Omit<Review, 'id' | 'reviewed_at'>) => {
    const fullReview: Review = {
      ...review,
      id: crypto.randomUUID(),
      reviewed_at: new Date().toISOString(),
    }
    setReviews((prev) => [...prev, fullReview])
    if (isSupabaseConfigured && isOnline) {
      try {
        await supabase.from('reviews').insert(fullReview)
      } catch { /* will sync later */ }
    }
  }, [isOnline])

  const updateSettings = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings)
    if (isSupabaseConfigured && isOnline) {
      try {
        await supabase
          .from('settings')
          .upsert({ id: 1, data: newSettings, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      } catch { /* will sync later */ }
    }
  }, [isOnline])

  const value: StoreContextValue = {
    words,
    reviews,
    settings,
    syncStatus,
    toasts,
    isOnline,
    addWords,
    updateWord,
    deleteWord,
    resetWordProgress,
    togglePauseWord,
    addReview,
    updateSettings,
    manualSync,
    showToast,
    dismissToast,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
