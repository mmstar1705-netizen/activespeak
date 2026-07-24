import { Home, Upload, Mic, Settings as SettingsIcon, BookOpen, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useStore } from '@/store';
import { useToast } from '@/components/Toast';

interface LayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'practice', label: 'Practice', icon: Mic },
  { id: 'vocabulary', label: 'Vocabulary', icon: BookOpen },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { syncStatus, syncing, manualSync } = useStore();
  const { showToast } = useToast();

  const handleSync = async () => {
    const result = await manualSync();
    if (result.success) {
      showToast('success', `已成功同步 ${result.wordCount} 个单词`);
    } else {
      showToast('error', result.error || '同步失败，请稍后重试。');
    }
  };

  const renderSyncIcon = () => {
    if (syncing) {
      return <RefreshCw size={18} className="text-blue-500 animate-spin" />;
    }
    if (syncStatus === 'online') {
      return (
        <span className="relative">
          <Cloud size={18} className="text-emerald-500" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
        </span>
      );
    }
    return <CloudOff size={18} className="text-gray-400" />;
  };

  const syncTitle = syncing ? '正在同步...' : syncStatus === 'online' ? '云端已连接，点击立即同步' : syncStatus === 'offline' ? '离线模式，点击尝试同步' : '未配置云端，点击尝试同步';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Mic size={16} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">ActiveSpeak</span>
          </div>
          <div className="flex items-center gap-1">
            <nav className="hidden sm:flex items-center gap-1 mr-1">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === item.id
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            {/* Cloud sync status button */}
            <button
              onClick={handleSync}
              disabled={syncing}
              title={syncTitle}
              aria-label={syncTitle}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-60 flex items-center justify-center"
            >
              {renderSyncIcon()}
            </button>
            {/* Settings button (mobile visible) */}
            <button
              onClick={() => onNavigate('settings')}
              className={`sm:hidden p-2 rounded-lg transition-colors ${
                currentPage === 'settings' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
              aria-label="Settings"
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 sm:pb-0">{children}</main>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 z-10" style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <div className="flex items-center justify-around h-16">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
                  currentPage === item.id ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                <Icon size={20} />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
