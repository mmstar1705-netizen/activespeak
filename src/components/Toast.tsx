import { useStore } from '@/store'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

export function ToastContainer() {
  const { toasts, dismissToast } = useStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 safe-bottom">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-slide-up flex items-start gap-3 rounded-xl p-4 shadow-lg ${
            toast.type === 'success'
              ? 'bg-accent-50 text-accent-800 border border-accent-200'
              : toast.type === 'error'
                ? 'bg-error-50 text-error-600 border border-error-100'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="h-5 w-5 flex-shrink-0 text-accent-500" />}
          {toast.type === 'error' && <XCircle className="h-5 w-5 flex-shrink-0 text-error-500" />}
          {toast.type === 'info' && <Info className="h-5 w-5 flex-shrink-0 text-blue-500" />}
          <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
          <button onClick={() => dismissToast(toast.id)} className="flex-shrink-0 opacity-50 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
