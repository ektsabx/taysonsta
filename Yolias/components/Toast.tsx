"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

// Claude-style toasts: a small dark card at the bottom of the screen that
// confirms an action ("Strategy renamed") or reports a failure, then fades.
type Kind = "success" | "error";
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children, closeLabel }: { children: React.ReactNode; closeLabel: string }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (text: string, kind: Kind = "success") => {
      const id = next.current++;
      setToasts((all) => [...all.slice(-2), { id, kind, text }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "error" ? <CircleAlert /> : <CircleCheck />}
            <span>{t.text}</span>
            <button type="button" aria-label={closeLabel} onClick={() => dismiss(t.id)}><X /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
