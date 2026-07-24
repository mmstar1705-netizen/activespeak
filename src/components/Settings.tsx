import { useState } from 'react'
import { useStore } from '@/store'
import type { AppSettings } from '@/types'
import { Save, Info } from 'lucide-react'

export function Settings() {
  const { settings, updateSettings, showToast, syncStatus, manualSync } = useStore()
  const [local, setLocal] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(local)
      showToast('success', '设置已保存')
    } catch {
      showToast('error', '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in p-4 pb-6">
      <h2 className="mb-6 text-lg font-bold text-gray-900">Settings</h2>

      {/* Sync section */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-700">Cloud Sync</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              Status: <span className={`font-medium ${syncStatus === 'online' ? 'text-accent-600' : syncStatus === 'syncing' ? 'text-blue-500' : 'text-gray-400'}`}>
                {syncStatus === 'online' ? 'Connected' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
              </span>
            </p>
          </div>
          <button
            onClick={() => manualSync()}
            disabled={syncStatus === 'syncing'}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-transform active:scale-95 disabled:opacity-50"
          >
            Sync Now
          </button>
        </div>
      </div>

      {/* SRS settings */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-700">Spaced Repetition</h3>

        {/* Daily new limit */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-600">Daily New Words Limit</label>
          <input
            type="number"
            min={1}
            max={100}
            value={local.daily_new_limit}
            onChange={(e) => setLocal({ ...local, daily_new_limit: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
          <p className="mt-1 text-xs text-gray-400">Maximum new words introduced per day (default: 10)</p>
        </div>

        {/* Scene word count */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-600">Words Per Scene</label>
          <input
            type="number"
            min={1}
            max={10}
            value={local.scene_word_count}
            onChange={(e) => setLocal({ ...local, scene_word_count: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
          <p className="mt-1 text-xs text-gray-400">Number of words combined in each practice scene (default: 3)</p>
        </div>

        {/* Mastery threshold */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-600">Mastery Threshold</label>
          <input
            type="number"
            min={1}
            max={20}
            value={local.mastery_threshold}
            onChange={(e) => setLocal({ ...local, mastery_threshold: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
          <p className="mt-1 text-xs text-gray-400">Consecutive correct reviews to mark as mastered (default: 5)</p>
        </div>

        {/* Interval mode */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-600">Interval Expansion</label>
          <div className="grid grid-cols-3 gap-2">
            {(['conservative', 'standard', 'aggressive'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLocal({ ...local, interval_mode: mode })}
                className={`rounded-lg border py-2 text-sm font-medium capitalize transition-colors ${
                  local.interval_mode === mode
                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Conservative: slower growth · Standard: balanced · Aggressive: faster growth
          </p>
        </div>
      </div>

      {/* About */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          <div>
            <p className="text-sm text-gray-500">
              ActiveSpeak uses an SM-2 spaced repetition algorithm with a 4:00 AM rollover boundary.
              Practice between midnight and 4 AM counts toward the previous day.
            </p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 font-semibold text-white shadow transition-transform active:scale-95 disabled:opacity-50"
      >
        <Save className="h-5 w-5" />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}
