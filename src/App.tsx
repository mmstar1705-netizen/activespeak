import { useState, Component, ReactNode } from 'react';
import { StoreProvider } from '@/store';
import { ToastProvider } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from '@/components/Layout';
import Dashboard from '@/components/Dashboard';
import Practice from '@/components/Practice';
import Vocabulary from '@/components/Vocabulary';
import WordImport from '@/components/WordImport';
import Settings from '@/components/Settings';

function App() {
  const [page, setPage] = useState('dashboard');

  const navigate = (p: string) => setPage(p);

  let content: ReactNode;
  switch (page) {
    case 'practice':
      content = (
        <ErrorBoundary>
          <Practice onNavigate={navigate} />
        </ErrorBoundary>
      );
      break;
    case 'vocabulary':
      content = <Vocabulary onNavigate={navigate} />;
      break;
    case 'import':
      content = <WordImport onNavigate={navigate} />;
      break;
    case 'settings':
      content = <Settings />;
      break;
    default:
      content = <Dashboard onNavigate={navigate} />;
  }

  return (
    <StoreProvider>
      <ToastProvider>
        <Layout currentPage={page} onNavigate={navigate}>
          {content}
        </Layout>
      </ToastProvider>
    </StoreProvider>
  );
}

export default App;
