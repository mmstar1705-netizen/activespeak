import { useState } from 'react'
import { useStore } from '@/store'
import { parseWordList } from '@/lib/parser'
import { ArrowLeft, Upload, FileText, Check } from 'lucide-react'

interface WordImportProps {
  onClose: () => void
}

export function WordImport({ onClose }: WordImportProps) {
  const { addWords, showToast } = useStore()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<{ word: string; meaning: string }[]>([])
  const [importing, setImporting] = useState(false)

  const handleParse = () => {
    const result = parseWordList(text)
    setParsed(result)
    if (result.length === 0) {
      showToast('error', 'No valid words found. Check your format.')
    }
  }

  const handleImport = async () => {
    if (parsed.length === 0) return
    setImporting(true)
    try {
      await addWords(parsed)
      showToast('success', `成功导入 ${parsed.length} 个单词`)
      onClose()
    } catch {
      showToast('error', '导入失败，请重试')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="animate-fade-in p-4 pb-6">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">Import Words</h2>
      </div>

      <div className="mb-4 rounded-xl bg-blue-50 p-3">
        <p className="text-sm text-blue-700">
          <strong>Supported formats:</strong> One word per line, or "word,meaning", or "word - meaning", or "word: meaning"
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'abandon, to give up completely\nbenefit - an advantage\ncontribute: to help cause a result'}
        className="mb-4 h-48 w-full resize-none rounded-xl border border-gray-200 bg-white p-4 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      />

      <div className="mb-4 flex gap-3">
        <button
          onClick={handleParse}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <FileText className="h-5 w-5" />
          Preview
        </button>
        <button
          onClick={handleImport}
          disabled={parsed.length === 0 || importing}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white shadow transition-transform active:scale-95 disabled:opacity-50"
        >
          {importing ? (
            <Check className="h-5 w-5" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
          Import {parsed.length > 0 ? `${parsed.length} words` : ''}
        </button>
      </div>

      {parsed.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-semibold text-gray-700">Preview ({parsed.length} words)</h3>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {parsed.map((w, i) => (
              <div key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-gray-800">{w.word}</span>
                <span className="text-gray-500">{w.meaning || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
