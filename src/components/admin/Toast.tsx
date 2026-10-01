import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { ToastContext, type ToastTone } from "./toastContext";

interface ToastItem {
  id: number;
  message: ReactNode;
  tone: ToastTone;
}

/** Toast stack for the admin area (bottom-right, polite live region, auto-dismiss after 4.5 s). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const schedule = useCallback(
    (id: number, tone: ToastTone) => {
      const old = timers.current.get(id);
      if (old) clearTimeout(old);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4500),
      );
    },
    [dismiss],
  );

  /** Pause auto-dismiss while the toast is hovered or focused (e.g. reaching an Undo button). */
  const pause = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (message: ReactNode, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, message, tone }]);
      schedule(id, tone);
    },
    [schedule],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={(e) => {
              if (!e.currentTarget.contains(document.activeElement)) schedule(t.id, t.tone);
            }}
            onFocus={() => pause(t.id)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !e.currentTarget.matches(":hover")) schedule(t.id, t.tone);
            }}
            className={cx(
              "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg",
              t.tone === "success" && "border-green-200 bg-success-soft text-green-900",
              t.tone === "error" && "border-red-200 bg-danger-soft text-red-900",
              t.tone === "info" && "border-line bg-ink text-white",
            )}
          >
            <div className="min-w-0 flex-1">{t.message}</div>
            <button type="button" onClick={() => dismiss(t.id)} className="-mr-1 rounded px-1 opacity-70 hover:opacity-100" aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
