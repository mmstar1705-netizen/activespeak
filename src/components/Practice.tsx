import { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '@/store'
import { SpeechController, isSpeechRecognitionSupported } from '@/lib/speech'
import { sm2, qualityFromRating, isMastered } from '@/lib/sm2'
import { generateSceneAsync, streamScore, scoreResponse } from '@/lib/llm'
import { speak, stopSpeaking } from '@/lib/tts'
import { getCurrentDayStart } from '@/lib/rollover'
import type { Scene, Word } from '@/types'
import { Mic, Square, Send, SkipForward, Volume2, RotateCcw, Loader2 } from 'lucide-react'

const LS_CURRENT_SCENE = 'activespeak_current_scene'
const LS_PRACTICE_TEXT = 'activespeak_practice_text'

export function Practice() {
  const { words, reviews, settings, addReview, updateWord, showToast } = useStore()
  const [scene, setScene] = useState<Scene | null>(null)
  const [nextScene, setNextScene] = useState<Scene | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [editableText, setEditableText] = useState('')
  const [phase, setPhase] = useState<'prompt' | 'recording' | 'editing' | 'scoring' | 'result'>('prompt')
  const [scoredScore, setScoredScore] = useState<number | null>(null)
  const [streamingFeedback, setStreamingFeedback] = useState('')
  const [sceneWords, setSceneWords] = useState<Word[]>([])
  const speechRef = useRef<SpeechController | null>(null)
  const streamingRef = useRef(false)

  // Load saved scene from localStorage (breakpoint resume)
  useEffect(() => {
    const saved = localStorage.getItem(LS_CURRENT_SCENE)
    const savedText = localStorage.getItem(LS_PRACTICE_TEXT)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Scene
        setScene(parsed)
        const matched = words.filter((w) => parsed.words.includes(w.word))
        setSceneWords(matched)
        if (savedText) {
          setEditableText(savedText)
          setPhase('editing')
        } else {
          setPhase('prompt')
        }
      } catch {
        // corrupted, fall through to generate new
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pick words for practice and generate scene
  const pickWords = useCallback((): Word[] => {
    const dayStart = getCurrentDayStart()
    const available = words.filter((w) => !w.paused)
    const due = available.filter((w) => w.next_review <= dayStart && w.proficiency !== 'mastered')
    const newWords = available.filter((w) => w.proficiency === 'new')

    // Count today's new words already practiced
    const todayReviews = reviews.filter((r) => new Date(r.reviewed_at).getTime() >= dayStart)
    const newWordsToday = new Set(
      todayReviews.map((r) => r.word_id).filter((wid) => {
        const w = words.find((w) => w.id === wid)
        return w && w.proficiency === 'new'
      }),
    )
    const newQuotaLeft = Math.max(0, settings.daily_new_limit - newWordsToday.size)

    // Prioritize due reviews, then new words (up to quota)
    const pool: Word[] = []
    const dueFirst = due.filter((w) => w.proficiency !== 'new')
    pool.push(...dueFirst.slice(0, settings.scene_word_count))

    const needed = settings.scene_word_count - pool.length
    if (needed > 0) {
      const newPool = newWords.slice(0, Math.min(needed, newQuotaLeft))
      pool.push(...newPool)
      // Fill remaining with any due new words
      if (pool.length < settings.scene_word_count) {
        const remaining = due.filter((w) => w.proficiency === 'new' && !pool.includes(w))
        pool.push(...remaining.slice(0, settings.scene_word_count - pool.length))
      }
    }

    return pool.slice(0, settings.scene_word_count)
  }, [words, reviews, settings])

  // Generate a new scene
  const generateNewScene = useCallback(async (): Promise<{ scene: Scene; words: Word[] } | null> => {
    const picked = pickWords()
    if (picked.length === 0) {
      return null
    }
    const newScene = await generateSceneAsync(picked.map((w) => w.word))
    return { scene: newScene, words: picked }
  }, [pickWords])

  // Initialize scene if none loaded
  useEffect(() => {
    if (!scene) {
      generateNewScene().then((result) => {
        if (result) {
          setScene(result.scene)
          setSceneWords(result.words)
          localStorage.setItem(LS_CURRENT_SCENE, JSON.stringify(result.scene))
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  // Pre-generate next scene in background
  useEffect(() => {
    if (scene && !nextScene) {
      generateNewScene().then((result) => {
        if (result) {
          setNextScene(result.scene)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, nextScene])

  // Start recording
  const handleStartRecording = useCallback(async () => {
    if (!isSpeechRecognitionSupported()) {
      showToast('error', '当前浏览器不支持语音识别，建议使用 Android Chrome 或 Edge 浏览器打开。')
      return
    }

    setPhase('recording')
    setIsRecording(true)
    setRecognizedText('')

    const controller = new SpeechController()
    speechRef.current = controller
    controller.setCallbacks(
      (text) => setRecognizedText(text),
      () => {
        setIsRecording(false)
      },
    )

    try {
      await controller.start('en-US')
    } catch (err: any) {
      setIsRecording(false)
      setPhase('prompt')
      if (err.message === 'NOT_ALLOWED') {
        showToast('error', '无法使用麦克风，请在手机设置中开启浏览器的麦克风权限。')
      } else if (err.message === 'UNSUPPORTED') {
        showToast('error', '当前浏览器不支持语音识别，建议使用 Android Chrome 或 Edge 浏览器打开。')
      } else {
        showToast('error', '麦克风启动失败，请重试。')
      }
    }
  }, [showToast])

  // Stop recording
  const handleStopRecording = useCallback(() => {
    const controller = speechRef.current
    if (controller) {
      controller.stop()
      const text = controller.getText() || recognizedText
      setEditableText(text)
      localStorage.setItem(LS_PRACTICE_TEXT, text)
    }
    setIsRecording(false)
    setPhase('editing')
  }, [recognizedText])

  // Submit for scoring
  const handleSubmit = useCallback(async () => {
    if (!editableText.trim() || !scene) return
    setPhase('scoring')
    setScoredScore(null)
    setStreamingFeedback('')
    streamingRef.current = true

    const wordData = sceneWords.map((w) => ({ word: w.word, meaning: w.meaning }))

    // Stream feedback
    let feedback = ''
    for await (const token of streamScore(editableText, scene, wordData)) {
      if (!streamingRef.current) break
      feedback += token
      setStreamingFeedback(feedback)
    }

    // Calculate final score
    const result = scoreResponse(editableText, scene, wordData)
    setScoredScore(result.score)
    setPhase('result')

    // Update word progress (SM-2)
    const quality = result.score >= 80 ? 4 : result.score >= 50 ? 3 : 1
    const rating = result.score >= 80 ? 'good' : result.score >= 50 ? 'hard' : 'again'

    for (const word of sceneWords) {
      const sm2Result = sm2(
        { ef: word.ef, interval: word.interval, repetitions: word.repetitions },
        quality,
        settings.interval_mode,
      )
      const mastered = isMastered(sm2Result.repetitions, settings.mastery_threshold)
      await updateWord(word.id, {
        ef: sm2Result.ef,
        interval: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        next_review: sm2Result.next_review,
        last_review: Date.now(),
        proficiency: mastered ? 'mastered' : sm2Result.repetitions >= 2 ? 'reviewing' : 'learning',
        success_count: quality >= 3 ? word.success_count + 1 : 0,
      })
    }

    // Save review
    await addReview({
      word_id: sceneWords[0]?.id || '',
      quality,
      score: result.score,
      feedback: result.feedback,
      scene: scene.prompt,
      user_text: editableText,
    })

    // Async TTS (non-blocking)
    if (result.score >= 50) {
      speak(editableText, 'en-US')
    }
  }, [editableText, scene, sceneWords, settings, addReview, updateWord])

  // Skip / Next scene
  const handleSkip = useCallback(() => {
    stopSpeaking()
    streamingRef.current = false
    localStorage.removeItem(LS_PRACTICE_TEXT)

    if (nextScene) {
      setScene(nextScene)
      const matched = words.filter((w) => nextScene.words.includes(w.word))
      setSceneWords(matched)
      localStorage.setItem(LS_CURRENT_SCENE, JSON.stringify(nextScene))
      setNextScene(null)
    } else {
      setScene(null)
    }
    setEditableText('')
    setRecognizedText('')
    setScoredScore(null)
    setStreamingFeedback('')
    setPhase('prompt')
  }, [nextScene, words])

  // Restart recording
  const handleRestart = useCallback(() => {
    setPhase('prompt')
    setEditableText('')
    setRecognizedText('')
    setScoredScore(null)
    setStreamingFeedback('')
    localStorage.removeItem(LS_PRACTICE_TEXT)
  }, [])

  if (!scene) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary-500" />
          <p className="text-gray-500">No words due for review. Add words in the Vocabulary tab to start practicing!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in flex h-full flex-col p-4 pb-6">
      {/* Scene prompt */}
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-2 flex flex-wrap gap-2">
          {sceneWords.map((w) => (
            <span key={w.id} className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
              {w.word}
            </span>
          ))}
        </div>
        <p className="text-gray-700">{scene.prompt}</p>
      </div>

      {/* Recording phase */}
      {phase === 'prompt' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <button
            onClick={handleStartRecording}
            onTouchStart={(e) => { e.preventDefault(); handleStartRecording() }}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-600 text-white shadow-xl transition-transform active:scale-95"
          >
            <Mic className="h-10 w-10" />
          </button>
          <p className="text-gray-500">Tap to start speaking</p>
        </div>
      )}

      {phase === 'recording' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <button
            onClick={handleStopRecording}
            onTouchStart={(e) => { e.preventDefault(); handleStopRecording() }}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-error-500 text-white shadow-xl transition-transform active:scale-95"
          >
            <Square className="h-10 w-10" />
          </button>
          <div className="w-full max-w-md rounded-xl bg-gray-50 p-4 text-center">
            <p className="text-gray-700">
              {recognizedText || <span className="text-gray-400">Listening...</span>}
            </p>
          </div>
          <p className="text-gray-500">Tap to stop</p>
        </div>
      )}

      {/* Editing phase */}
      {phase === 'editing' && (
        <div className="flex flex-1 flex-col gap-4">
          <label className="text-sm font-medium text-gray-600">Review and edit your response:</label>
          <textarea
            value={editableText}
            onChange={(e) => {
              setEditableText(e.target.value)
              localStorage.setItem(LS_PRACTICE_TEXT, e.target.value)
            }}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-white p-4 text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            placeholder="Your spoken text will appear here. Edit if needed..."
            rows={6}
          />
          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <RotateCcw className="h-5 w-5" />
              Redo
            </button>
            <button
              onClick={handleSubmit}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white shadow transition-transform active:scale-95"
            >
              <Send className="h-5 w-5" />
              Submit
            </button>
          </div>
        </div>
      )}

      {/* Scoring phase */}
      {phase === 'scoring' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <p className="text-gray-500">Analyzing your response...</p>
          {streamingFeedback && (
            <div className="w-full max-w-md rounded-xl bg-gray-50 p-4">
              <p className="typewriter-cursor text-gray-700">{streamingFeedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Result phase */}
      {phase === 'result' && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Your Score</p>
            <p className={`text-5xl font-bold ${scoredScore && scoredScore >= 80 ? 'text-accent-600' : scoredScore && scoredScore >= 50 ? 'text-amber-500' : 'text-error-500'}`}>
              {scoredScore}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-gray-700">{streamingFeedback}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="mb-2 text-sm font-medium text-gray-500">Your response:</p>
            <p className="text-gray-700">{editableText}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Volume2 className="h-5 w-5" />
              Play
            </button>
            <button
              onClick={handleSkip}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white shadow transition-transform active:scale-95"
            >
              <SkipForward className="h-5 w-5" />
              Next Scene
            </button>
          </div>
        </div>
      )}

      {/* Skip button (always available except during scoring) */}
      {phase !== 'scoring' && phase !== 'result' && (
        <button
          onClick={handleSkip}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 font-medium text-gray-500 transition-colors hover:bg-gray-50"
        >
          <SkipForward className="h-5 w-5" />
          Skip Scene
        </button>
      )}
    </div>
  )
}
