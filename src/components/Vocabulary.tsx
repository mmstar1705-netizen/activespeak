import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { isDueToday, isOverdue, formatNextReview, formatLastReview } from '@/lib/sm2';
import type { Word } from '@/types';
import { Search, Edit2, RotateCcw, Pause, Play, Trash2, X, Check, CheckSquare, Square } from 'lucide-react';

type Filter = 'all' | 'due' | 'new' | 'mastered' | 'paused';

export default function Vocabulary({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { words, getStats, updateWord, deleteWord, deleteWords, setPausedWords, resetWordProgress, togglePauseWord } = useStore();
  const stats = getStats();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editWord, setEditWord] = useState<Word | null>(null);
  const [editWordText, setEditWordText] = useState('');
  const [editMeaning, setEditMeaning] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  const filtered = useMemo(() => {
    let result = words;
    if (filter === 'due') result = result.filter(w => !w.paused && isDueToday(w.sm2));
    else if (filter === 'new') result = result.filter(w => !w.paused && w.proficiency === 'new');
    else if (filter === 'mastered') result = result.filter(w => !w.paused && w.proficiency === 'mastered');
    else if (filter === 'paused') result = result.filter(w => w.paused);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(w =>
        w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
      );
    }
    return result;
  }, [words, filter, search]);

  const filteredIds = filtered.map(w => w.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const someSelected = filteredIds.some(id => selected.has(id));
  const selectedCount = filteredIds.filter(id => selected.has(id)).length;
  const selectedIds = filteredIds.filter(id => selected.has(id));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filteredIds.forEach(id => next.delete(id));
      } else {
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleOpenEdit = (word: Word) => {
    setEditWord(word);
    setEditWordText(word.word);
    setEditMeaning(word.meaning);
  };

  const handleSaveEdit = () => {
    if (editWord) {
      updateWord(editWord.id, { word: editWordText.trim(), meaning: editMeaning.trim() });
      setEditWord(null);
    }
  };

  const handleDelete = (id: string) => {
    deleteWord(id);
    setDeleteConfirm(null);
  };

  const handleBatchDelete = () => {
    deleteWords(selectedIds);
    clearSelection();
    setBatchDeleteConfirm(false);
  };

  const handleBatchPause = () => {
    setPausedWords(selectedIds, true);
    clearSelection();
  };

  const handleBatchResume = () => {
    setPausedWords(selectedIds, false);
    clearSelection();
  };

  if (words.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 mb-4">No words in your vocabulary yet.</p>
        <button
          onClick={() => onNavigate('import')}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
        >
          Import Wordlist
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">Vocabulary</h1>
        <p className="text-gray-500 mt-2">Manage your word library and review schedule</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <StatCard label="Due Today" value={stats.due} color="bg-orange-50 text-orange-600" />
        <StatCard label="New" value={stats.new} color="bg-amber-50 text-amber-600" />
        <StatCard label="Learning" value={stats.familiar} color="bg-teal-50 text-teal-600" />
        <StatCard label="Mastered" value={stats.mastered} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Paused" value={stats.paused} color="bg-gray-100 text-gray-500" />
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search words..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {([
            { id: 'all', label: 'All' },
            { id: 'due', label: 'Due Today' },
            { id: 'new', label: 'New' },
            { id: 'mastered', label: 'Mastered' },
            { id: 'paused', label: 'Paused' },
          ] as { id: Filter; label: string }[]).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Batch action bar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-gray-900 rounded-2xl">
          <span className="text-sm font-medium text-white">{selectedCount} selected</span>
          <div className="flex-1" />
          <button
            onClick={handleBatchPause}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
          >
            <Pause size={14} /> Pause
          </button>
          <button
            onClick={handleBatchResume}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
          >
            <Play size={14} /> Resume
          </button>
          <button
            onClick={() => setBatchDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1.5 px-3 py-2 text-gray-300 hover:text-white text-sm"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-900 transition-colors">
                    {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Word</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Meaning</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Correct</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Last Review</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Next Review</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(word => {
                const isSelected = selected.has(word.id);
                return (
                  <tr key={word.id} className={`border-b border-gray-50 transition-colors ${isSelected ? 'bg-blue-50/40' : 'hover:bg-gray-50/30'}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(word.id)} className="text-gray-400 hover:text-gray-900 transition-colors">
                        {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{word.word}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{word.meaning}</td>
                    <td className="px-4 py-3">
                      {word.paused ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Paused</span>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          word.proficiency === 'new' ? 'bg-amber-100 text-amber-700' :
                          word.proficiency === 'familiar' ? 'bg-teal-100 text-teal-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {word.proficiency}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center hidden sm:table-cell">{word.successCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{formatLastReview(word.sm2)}</td>
                    <td className="px-4 py-3 text-sm">
                      {word.paused ? (
                        <span className="text-gray-400">—</span>
                      ) : isOverdue(word.sm2) ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">Due</span>
                      ) : isDueToday(word.sm2) ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-600">Today</span>
                      ) : (
                        <span className="text-gray-500">{formatNextReview(word.sm2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(word)}
                          title="Edit word"
                          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => resetWordProgress(word.id)}
                          title="Reset progress"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <RotateCcw size={15} />
                        </button>
                        <button
                          onClick={() => togglePauseWord(word.id)}
                          title={word.paused ? 'Resume' : 'Pause'}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          {word.paused ? <Play size={15} /> : <Pause size={15} />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(word.id)}
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No words match your filter.</div>
        )}
      </div>

      {/* Edit modal */}
      {editWord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setEditWord(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Word</h3>
              <button onClick={() => setEditWord(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Word (English)</label>
                <input
                  type="text"
                  value={editWordText}
                  onChange={e => setEditWordText(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="English word"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Meaning (Chinese)</label>
                <input
                  type="text"
                  value={editMeaning}
                  onChange={e => setEditMeaning(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="中文释义"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditWord(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editWordText.trim()}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete this word?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently remove "{words.find(w => w.id === deleteConfirm)?.word}" and all its progress. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch delete confirmation modal */}
      {batchDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setBatchDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete {selectedCount} words?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently remove {selectedCount} selected words and all their progress. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setBatchDeleteConfirm(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchDelete}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors text-sm"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${color} mb-2`}>
        <span className="text-base font-bold">{value}</span>
      </div>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
