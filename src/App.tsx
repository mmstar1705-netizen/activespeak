import { useState } from 'react'
import { StoreProvider } from '@/store'
import { Layout } from '@/components/Layout'
import type { Tab } from '@/components/Layout'
import { Dashboard } from '@/components/Dashboard'
import { Practice } from '@/components/Practice'
import { Vocabulary } from '@/components/Vocabulary'
import { Settings } from '@/components/Settings'
import { ToastContainer } from '@/components/Toast'

function AppContent() {
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <Layout activeTab={tab} onTabChange={setTab}>
      {tab === 'dashboard' && <Dashboard onTabChange={setTab} />}
      {tab === 'practice' && <Practice />}
      {tab === 'vocabulary' && <Vocabulary />}
      {tab === 'settings' && <Settings />}
    </Layout>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
      <ToastContainer />
    </StoreProvider>
  )
}
