import { useState } from 'react';
import { useStore } from '@/store';
import { parseWordlist } from '@/lib/parser';

const SAMPLE = `abandon - 放弃
absolute - 绝对的
academic - 学术的
accelerate - 加速
accomplish - 完成
accumulate - 积累
accurate - 精确的
achieve - 达到
acquire - 获得
adapt - 适应`;

export default function WordImport({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { addWords, words } = useStore();
  const [text, setText] = useState('');
  const [imported, setImported] = useState(0);
  const [error, setError] = useState('');

  const handleImport = () => {
    if (!text.trim()) {
      setError('Please paste your wordlist first.');
      return;
    }
    try {
      const parsed = parseWordlist(text);
      if (parsed.length === 0) {
        setError('No words found. Check the format.');
        return;
      }
      addWords(parsed);
      setImported(parsed.length);
      setText('');
      setError('');
    } catch (e) {
      setError('Failed to parse wordlist.');
    }
  };

  const handleSample = () => {
    setText(SAMPLE);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          Import Wordlist
        </h1>
        <p className="text-gray-500 mt-2">
          Paste your words below. Format: <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">word - meaning</code> (one per line)
        </p>
      </div>

      {imported > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 mb-6 flex items-center justify-between">
          <span>Successfully imported {imported} words.</span>
          <button
            onClick={() => onNavigate('practice')}
            className="text-sm font-medium text-emerald-700 underline"
          >
            Start Practice →
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="abandon - 放弃&#10;absolute - 绝对的&#10;academic - 学术的&#10;..."
          className="w-full h-64 p-4 border border-gray-200 rounded-xl text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={handleSample}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Load Sample
          </button>
          <div className="flex gap-3">
            {words.length > 0 && (
              <button
                onClick={() => onNavigate('dashboard')}
                className="px-5 py-2.5 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleImport}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
            >
              Import
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-gray-50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Supported Formats</h3>
        <ul className="text-sm text-gray-500 space-y-1">
          <li><code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">word - meaning</code> (dash)</li>
          <li><code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">word	meaning</code> (tab)</li>
          <li><code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">word|meaning</code> (pipe)</li>
          <li><code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">word meaning</code> (space)</li>
        </ul>
      </div>
    </div>
  );
}
