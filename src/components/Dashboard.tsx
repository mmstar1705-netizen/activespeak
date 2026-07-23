import { useStore } from '@/store';

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { getStats, groups } = useStore();
  const stats = getStats();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-gray-500 mt-2">Track your speaking practice progress</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Words" value={stats.total} color="bg-blue-50 text-blue-600" />
        <StatCard label="New" value={stats.new} color="bg-amber-50 text-amber-600" />
        <StatCard label="Familiar" value={stats.familiar} color="bg-teal-50 text-teal-600" />
        <StatCard label="Mastered" value={stats.mastered} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Review Due</h2>
          <span
            className={`text-sm font-medium px-3 py-1 rounded-full ${
              stats.due > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {stats.due} due
          </span>
        </div>
        <p className="text-gray-500 text-sm mb-4">
          Words scheduled for review by the SM-2 algorithm.
        </p>
        <button
          onClick={() => onNavigate('practice')}
          disabled={stats.due === 0 && stats.total === 0}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {stats.due > 0 ? 'Start Review' : 'No words due'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Groups</h2>
          <span className="text-sm text-gray-400">{groups.length} groups</span>
        </div>
        {groups.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">No words imported yet</p>
            <button
              onClick={() => onNavigate('import')}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
            >
              Import Wordlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => onNavigate('practice')}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-gray-900">Group {g.index + 1}</p>
                  <p className="text-sm text-gray-400">{g.wordIds.length} words</p>
                </div>
                <span className="text-gray-300 text-sm">Practice →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${color} mb-3`}>
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
