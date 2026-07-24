import React from 'react'
import { useStore } from '@/store'
import { SyncStatusIcon } from './SyncStatusIcon'
import { Mic, BookOpen, BarChart3, Settings, Plus } from 'lucide-react'

export type Tab = 'dashboard' | 'practice' | 'vocabulary' | 'settings'

interface LayoutProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  children: React.ReactNode
}

export function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  const { isOnline } = useStore()

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Home', icon: <BarChart3 className="h-5 w-5" /> },
    { id: 'practice', label: 'Practice', icon: <Mic className="h-5 w-5" /> },
    { id: 'vocabulary', label: 'Words', icon: <BookOpen className="h-5 w-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ]

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50">
      {/* Header */}
      <header className="safe-top flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Mic className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">ActiveSpeak</h1>
        </div>
        <div className="flex items-center gap-1">
          <SyncStatusIcon />
          <button
            onClick={() => onTabChange('settings')}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              activeTab === 'settings' ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="safe-bottom flex items-center justify-around border-t border-gray-200 bg-white px-2 py-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
              activeTab === tab.id ? 'text-primary-600' : 'text-gray-400'
            }`}
          >
            {tab.icon}
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
