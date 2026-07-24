import { useState } from 'react';
import { useStore } from '@/store';
import type { IntervalMode } from '@/types';
import { getSupabaseConfig } from '@/lib/supabase';
import { Cloud, CloudOff, Loader2, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, syncStatus, configureSupabase, disconnectSupabase } = useStore();
  const [local, setLocal] = useState(settings);
  const [saved, setSaved] = useState(false);

  const existingConfig = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(existingConfig?.url ?? '');
  const [sbKey, setSbKey] = useState(existingConfig?.anonKey ?? '');
  const [connecting, setConnecting] = useState(false);
  const [sbMessage, setSbMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const updateSrs = (key: string, value: number | IntervalMode) => {
    setLocal(prev => ({ ...prev, srs: { ...prev.srs, [key]: value } }));
  };

  const handleSave = () => {
    updateSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-gray-500 mt-2">Configure your AI model, speech, and review algorithm</p>
      </div>

      <div className="space-y-6">
        {/* Supabase Cloud Sync */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Cloud Sync (Supabase)</h2>
            <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              syncStatus === 'online' ? 'bg-emerald-50 text-emerald-600' :
              syncStatus === 'offline' ? 'bg-amber-50 text-amber-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {syncStatus === 'online' && <Cloud size={14} />}
              {syncStatus === 'offline' && <CloudOff size={14} />}
              {syncStatus === 'unconfigured' && <CloudOff size={14} />}
              {syncStatus === 'online' ? 'Connected' : syncStatus === 'offline' ? 'Offline' : 'Not configured'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Connect a Supabase project to sync your vocabulary and progress across devices. If offline or not configured, the app uses LocalStorage automatically.
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Supabase URL</label>
          <input
            type="text"
            value={sbUrl}
            onChange={e => setSbUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-4"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Supabase Anon Key</label>
          <input
            type="password"
            value={sbKey}
            onChange={e => setSbKey(e.target.value)}
            placeholder="eyJhbGci..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-4"
          />

          {sbMessage && (
            <div className={`text-sm p-3 rounded-xl mb-4 ${
              sbMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}>
              {sbMessage.text}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={async () => {
                if (!sbUrl.trim() || !sbKey.trim()) {
                  setSbMessage({ type: 'error', text: 'Please enter both URL and Anon Key.' });
                  return;
                }
                setConnecting(true);
                setSbMessage(null);
                const ok = await configureSupabase(sbUrl.trim(), sbKey.trim());
                setConnecting(false);
                if (ok) {
                  setSbMessage({ type: 'success', text: 'Connected! Your data will now sync across devices.' });
                } else {
                  setSbMessage({ type: 'error', text: 'Connection failed. Check your URL and Anon Key.' });
                }
              }}
              disabled={connecting}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {connecting && <Loader2 size={16} className="animate-spin" />}
              {connecting ? 'Connecting...' : 'Connect & Sync'}
            </button>
            {syncStatus !== 'unconfigured' && (
              <button
                onClick={() => {
                  disconnectSupabase();
                  setSbUrl('');
                  setSbKey('');
                  setSbMessage(null);
                }}
                className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* AI Model */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Model</h2>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
          <input
            type="password"
            value={local.apiKey}
            onChange={e => setLocal({ ...local, apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-4"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Base URL</label>
          <input
            type="text"
            value={local.baseUrl}
            onChange={e => setLocal({ ...local, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-4"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Model</label>
          <input
            type="text"
            value={local.model}
            onChange={e => setLocal({ ...local, model: e.target.value })}
            placeholder="gpt-4o-mini"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-2">
            Compatible with OpenAI-style APIs (OpenAI, DeepSeek, Moonshot, etc.)
          </p>
        </div>

        {/* SRS Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">SRS Algorithm</h2>
          <p className="text-sm text-gray-400 mb-4">Customize your spaced repetition parameters</p>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Daily New Words Limit: <span className="text-gray-900 font-bold">{local.srs.dailyNewLimit}</span>
          </label>
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={local.srs.dailyNewLimit}
            onChange={e => updateSrs('dailyNewLimit', parseInt(e.target.value))}
            className="w-full mb-4"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Words per Scenario: <span className="text-gray-900 font-bold">{local.srs.wordsPerScenario}</span>
          </label>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={local.srs.wordsPerScenario}
            onChange={e => updateSrs('wordsPerScenario', parseInt(e.target.value))}
            className="w-full mb-4"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Mastery Threshold: <span className="text-gray-900 font-bold">{local.srs.masteryThreshold}</span> consecutive correct
          </label>
          <input
            type="range"
            min="3"
            max="10"
            step="1"
            value={local.srs.masteryThreshold}
            onChange={e => updateSrs('masteryThreshold', parseInt(e.target.value))}
            className="w-full mb-4"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Interval Modifier</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'conservative', label: 'Conservative' },
              { id: 'standard', label: 'Standard' },
              { id: 'aggressive', label: 'Aggressive' },
            ] as { id: IntervalMode; label: string }[]).map(m => (
              <button
                key={m.id}
                onClick={() => updateSrs('intervalMode', m.id)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  local.srs.intervalMode === m.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* TTS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Text-to-Speech</h2>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Cloud Neural TTS Voice</label>
          <p className="text-xs text-gray-400 mb-2">
            优先使用云端 Neural TTS 获取广播级真人发音（需配置 API Key）。若调用失败则自动回退到浏览器内置语音。
          </p>
          <select
            value={local.ttsCloudVoice}
            onChange={e => setLocal({ ...local, ttsCloudVoice: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-4"
          >
            <option value="nova">Nova (女声 · 自然亲切)</option>
            <option value="alloy">Alloy (中性 · 平衡)</option>
            <option value="echo">Echo (男声 · 沉稳)</option>
            <option value="fable">Fable (中性 · 叙事)</option>
            <option value="onyx">Onyx (男声 · 深沉)</option>
            <option value="shimmer">Shimmer (女声 · 清亮)</option>
          </select>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Browser Fallback Voice Language</label>
          <select
            value={local.ttsVoice}
            onChange={e => setLocal({ ...local, ttsVoice: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-4"
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="en-AU">English (Australia)</option>
          </select>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Speed: {local.ttsRate.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={local.ttsRate}
            onChange={e => setLocal({ ...local, ttsRate: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            Save Settings
          </button>
          {saved && <span className="text-emerald-600 text-sm font-medium">Saved!</span>}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-1">Note</h3>
          <p className="text-sm text-amber-700">
            Your API key is stored locally in your browser and sent only to the AI provider you configure. It is never sent to any other server.
          </p>
        </div>

        {syncStatus === 'online' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-emerald-800 mb-1 flex items-center gap-1.5">
              <CheckCircle2 size={16} /> Cloud Sync Active
            </h3>
            <p className="text-sm text-emerald-700">
              Your vocabulary and review progress are synced to Supabase. Changes on this device will appear on other devices automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
