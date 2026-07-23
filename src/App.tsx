import { useState } from 'react';
import { StoreProvider } from '@/store';
import { ToastProvider } from '@/components/Toast';
import Layout from '@/components/Layout';
import Dashboard from '@/components/Dashboard';
import WordImport from '@/components/WordImport';
import Practice from '@/components/Practice';
import Settings from '@/components/Settings';
import Vocabulary from '@/components/Vocabulary';

function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <ToastProvider>
      <StoreProvider>
        <Layout currentPage={page} onNavigate={setPage}>
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'import' && <WordImport onNavigate={setPage} />}
          {page === 'practice' && <Practice onNavigate={setPage} />}
          {page === 'vocabulary' && <Vocabulary onNavigate={setPage} />}
          {page === 'settings' && <Settings />}
        </Layout>
      </StoreProvider>
    </ToastProvider>
  );
}

export default App;
