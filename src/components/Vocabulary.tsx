import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { getCurrentDayStart } from '@/lib/rollover'
import type { Word, WordStatus } from '@/types'
import { Search, Pause, Play, RotateCcw, Trash2, Edit3, Plus, X, Check } from 'lucide-react'
import { WordImport } from './WordImport'

export function Vocabulary() {
  const { words, updateWord, deleteWord, resetWordProgress, togglePauseWord, showToast } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<WordStatus | 'all' | 'due'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMeaning, setEditMeaning] = useState('')
  const [showImport, setShowImport] = useState(false)
  const dayStart = getCurrentDayStart()

  const filtered = useMemo(() => {
    let result = words
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter((w) => w.word.toLowerCase().includes(lower) || w.meaning.toLowerCase().includes(lower))
    }
    if (filter === 'due') {
      result = result.filter((w) => !w.paused && w.next_review <= dayStart && w.proficiency !== 'mastered')
    } else if (filter !== 'all') {
      result = result.filter((w) => (filter === 'paused' ? w.paused : w.proficiency === filter && !w.paused))
    }
    return result.sort((a, b) => a.next_review - b.next_review)
  }, [words, search, filter, dayStart])

  const stats = useMemo(() => {
    const active = words.filter((w) => !w.paused)
    return {
      due: active.filter((w) => w.next_review <= dayStart && w.proficiency !== 'mastered').length,
      new: active.filter((w) => w.proficiency === 'new').length,
      learning: active.filter((w) => w.proficiency === 'learning').length,
      mastered: active.filter((w) => w.proficiency === 'mastered').length,
      paused: words.filter((w) => w.paused).length,
    }
  }, [words, dayStart])

  const handleEdit = (word: Word) => {
    setEditingId(word.id)
    setEditMeaning(word.meaning)
  }

  const handleSaveEdit = async () => {
    if (editingId) {
      await updateWord(editingId, { meaning: editMeaning })
      setEditingId(null)
      showToast('success', '释义已更新')
    }
  }

  const handleDelete = async (word: Word) => {
    await deleteWord(word.id)
    showToast('success', `已删除 "${word.word}"`)
  }

  const handleReset = async (word: Word) => {
    await resetWordProgress(word.id)
    showToast('success', `已重置 "${word.word}" 的进度`)
  }

  const handleTogglePause = async (word: Word) => {
    await togglePauseWord(word.id)
    showToast('info', word.paused ? `已恢复 "${word.word}"` : `已暂停 "${word.word}"`)
  }

  const statusFilters: { id: WordStatus | 'all' | 'due'; label: string; count: number }[] = [
    { id: 'due', label: 'Due', count: stats.due },
    { id: 'new', label: 'New', count: stats.new },
    { id: 'learning', label: 'Learning', count: stats.learning },
    { id: 'mastered', label: 'Mastered', count: stats.mastered },
    { id: 'paused', label: 'Paused', count: stats.paused },
  ]

  if (showImport) {
    return <WordImport onClose={() => setShowImport(false)} />
  }

  return (
    <div className="animate-fade-in p-4 pb-6">
      {/* Stat cards */}
      <div className="mb-4 grid grid-cols-5 gap-2">
        {statusFilters.map((s) => (
          <button
            key={s.id}
            onClick={() => setFilter(s.id)}
            className={`rounded-xl border p-3 text-center transition-colors ${
              filter === s.id ? 'border-primary-400 bg-primary-50' : 'border-gray-100 bg-white'
            }`}
          >
            <p className="text-xl font-bold text-gray-900">{s.count}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {/* Word list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-gray-400">No words found. Tap "Add" to import vocabulary!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((word) => {
            const isOverdue = !word.paused && word.next_review <= dayStart && word.proficiency !== 'mastered'
            const dueDate = new Date(word.next_review)
            const dueStr = dueDate.toISOString().slice(0, 10)
            const todayStr = new Date(dayStart).toISOString().slice(0, 10)
            const isToday = dueStr === todayStr

            return (
              <div key={word.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold text-gray-900 ${word.paused ? 'line-through opacity-50' : ''}`}>
                        {word.word}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        word.paused ? 'bg-gray-100 text-gray-400' :
                        word.proficiency === 'mastered' ? 'bg-accent-100 text-accent-700' :
                        word.proficiency === 'new' ? 'bg-blue-100 text-blue-700' :
                        word.proficiency === 'learning' ? 'bg-amber-100 text-amber-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {word.paused ? 'Paused' : word.proficiency}
                      </span>
                    </div>
                    {editingId === word.id ? (
                      <div className="mt-1 flex gap-2">
                        <input
                          value={editMeaning}
                          onChange={(e) => setEditMeaning(e.target.value)}
                          className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary-400"
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="rounded-lg bg-accent-500 p-1.5 text-white">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="rounded-lg bg-gray-100 p-1.5 text-gray-500">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {word.meaning || <span className="italic text-gray-300">No definition</span>}
                      </p>
                    )}
                    {!word.paused && word.proficiency !== 'mastered' && (
                      <p className={`mt-1 text-xs ${isOverdue ? 'font-medium text-error-500' : 'text-gray-400'}`}>
                        {isToday ? 'Due today' : isOverdue ? 'Overdue' : `Due ${dueStr}`}
                        {' · '}Rep: {word.repetitions} · EF: {word.ef.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>
                {/* Action buttons */}
                <div className="mt-3 flex gap-2 border-t border-gray-50 pt-2">
                  <button
                    onClick={() => handleEdit(word)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleTogglePause(word)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    {word.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    {word.paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={() => handleReset(word)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                  <button
                    onClick={() => handleDelete(word)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-error-500 hover:bg-error-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
