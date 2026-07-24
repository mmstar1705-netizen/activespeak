import { useStore } from '@/store'
import { Cloud, CloudOff, Loader2, Check } from 'lucide-react'

export function SyncStatusIcon() {
  const { syncStatus, manualSync } = useStore()

  const handleClick = () => {
    if (syncStatus !== 'syncing') {
      manualSync()
    }
  }

  if (syncStatus === 'syncing') {
    return (
      <button
        onClick={handleClick}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-400"
        aria-label="Syncing"
      >
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </button>
    )
  }

  if (syncStatus === 'online') {
    return (
      <button
        onClick={handleClick}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-accent-600 transition-colors hover:bg-accent-50"
        aria-label="Cloud connected — tap to sync"
      >
        <Cloud className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full border border-white bg-accent-500" />
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100"
      aria-label="Offline — tap to retry sync"
    >
      <CloudOff className="h-5 w-5" />
    </button>
  )
}
