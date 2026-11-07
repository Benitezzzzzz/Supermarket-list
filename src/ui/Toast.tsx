import { useCallback, useEffect, useRef, useState } from "react";

const DURATION_MS = 6000;

export interface ToastMessage {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Um aviso por vez; um novo substitui o anterior. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((text: string, action?: { label: string; onAction: () => void }) => {
    clearTimeout(timer.current);
    nextId.current += 1;
    setToast({ id: nextId.current, text, actionLabel: action?.label, onAction: action?.onAction });
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show, dismiss };
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {toast && (
        <div key={toast.id} className="toast" role="status">
          <span className="toast__text">{toast.text}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className="btn btn--accent btn--small"
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
