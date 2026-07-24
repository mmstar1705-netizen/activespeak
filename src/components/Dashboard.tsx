import { useStore } from '@/store'
import { getCurrentDayStart } from '@/lib/rollover'
import { Mic, BookOpen, Flame, TrendingUp, Calendar } from 'lucide-react'
import type { Tab } from './Layout'

interface DashboardProps {
  onTabChange: (tab: Tab) => void
}

export function Dashboard({ onTabChange }: DashboardProps) {
  const { words, reviews } = useStore()
  const dayStart = getCurrentDayStart()

  const dueWords = words.filter(
    (w) => !w.paused && w.next_review <= dayStart && w.proficiency !== 'mastered',
  )
  const newWords = words.filter((w) => w.proficiency === 'new' && !w.paused)
  const learningWords = words.filter((w) => w.proficiency === 'learning' && !w.paused)
  const reviewingWords = words.filter((w) => w.proficiency === 'reviewing' && !w.paused)
  const masteredWords = words.filter((w) => w.proficiency === 'mastered')
  const pausedWords = words.filter((w) => w.paused)

  const todayReviews = reviews.filter((r) => new Date(r.reviewed_at).getTime() >= dayStart)
  const avgScore = todayReviews.length > 0
    ? Math.round(todayReviews.reduce((sum, r) => sum + (r.score || 0), 0) / todayReviews.length)
    : 0

  const stats = [
    { label: 'Due Today', value: dueWords.length, icon: <Calendar className="h-5 w-5" />, color: 'text-orange-500 bg-orange-50' },
    { label: 'New', value: newWords.length, icon: <BookOpen className="h-5 w-5" />, color: 'text-blue-500 bg-blue-50' },
    { label: 'Learning', value: learningWords.length, icon: <TrendingUp className="h-5 w-5" />, color: 'text-purple-500 bg-purple-50' },
    { label: 'Mastered', value: masteredWords.length, icon: <Flame className="h-5 w-5" />, color: 'text-accent-500 bg-accent-50' },
    { label: 'Paused', value: pausedWords.length, icon: <BookOpen className="h-5 w-5" />, color: 'text-gray-400 bg-gray-50' },
  ]

  return (
    <div className="animate-fade-in p-4 pb-6">
      {/* Hero */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold">Welcome back</h2>
        <p className="mt-1 text-primary-100">
          {dueWords.length > 0
            ? `${dueWords.length} words waiting for review`
            : 'All caught up — add new words to keep learning!'}
        </p>
        <button
          onClick={() => onTabChange('practice')}
          className="mt-4 flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-primary-700 shadow transition-transform active:scale-95"
        >
          <Mic className="h-5 w-5" />
          Start Practice
        </button>
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
            <TrendingUp className="h-5 w-5" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgScore}</p>
          <p className="text-sm text-gray-500">Avg Score Today</p>
        </div>
      </div>

      {/* Today's reviews */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-900">Today's Activity</h3>
        {todayReviews.length === 0 ? (
          <p className="text-sm text-gray-400">No practice yet today. Tap "Start Practice" to begin!</p>
        ) : (
          <div className="space-y-2">
            {todayReviews.slice(-5).reverse().map((review) => {
              const word = words.find((w) => w.id === review.word_id)
              return (
                <div key={review.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="font-medium text-gray-700">{word?.word || 'Unknown'}</span>
                  <span className={`text-sm font-semibold ${review.score && review.score >= 80 ? 'text-accent-600' : review.score && review.score >= 50 ? 'text-amber-500' : 'text-error-500'}`}>
                    {review.score || '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
