import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { ToastContext, type ToastKind } from './toast-context';

type Toast = { id: number; message: string; kind: ToastKind };

const DISMISS_AFTER_MS = 5000;

// A short message after an action, such as "Example created". It sits in a live region, so a screen reader
// announces it without moving the focus, and it goes away by itself.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;

    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, kind }]);

    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, DISMISS_AFTER_MS);
    timers.current.add(timer);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
        {toasts.map((toast) => {
          const Icon = toast.kind === 'success' ? CircleCheck : CircleAlert;

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-body-md shadow-lg ${
                toast.kind === 'success' ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-error-container text-on-error-container'
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              {toast.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
