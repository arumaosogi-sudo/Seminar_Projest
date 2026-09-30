import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, cx, ErrorNote, Input, type Accent } from "@/components/ui";
import { IconClose } from "./icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Prevent closing via Esc/backdrop (e.g. while a request is running). */
  busy?: boolean;
};

/**
 * Accessible modal dialog: portal, role="dialog" + aria-modal, Esc to close, backdrop click,
 * light focus trap (Tab cycles inside) and focus restore to the opener on close.
 */
export function Modal({ open, onClose, title, description, children, footer, size = "md", busy }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first field (or the panel) once mounted.
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-zinc-950/40" aria-hidden="true" onClick={() => !busy && onClose()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[92vh] w-full flex-col rounded-t-[20px] border border-line bg-surface shadow-xl outline-none sm:rounded-[20px]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          size === "xl" && "sm:max-w-4xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-sm text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="-mr-2 rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-ink disabled:opacity-40"
            aria-label="Close dialog"
          >
            <IconClose />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

type ConfirmProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<unknown>;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  accent?: Accent;
  loading?: boolean;
  error?: string | null;
  /** When set, the user must type this exact text before confirming (type-to-confirm). */
  confirmText?: string;
  confirmTextLabel?: string;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  accent = "ink",
  loading,
  error,
  confirmText,
  confirmTextLabel,
}: ConfirmProps) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const blocked = confirmText !== undefined && typed.trim() !== confirmText;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={loading}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button accent={accent} onClick={() => void onConfirm()} loading={loading} disabled={blocked}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-zinc-700">
        {children}
        {confirmText !== undefined && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!blocked && !loading) void onConfirm();
            }}
          >
            <Input
              id={inputId}
              label={confirmTextLabel ?? `Type ${confirmText} to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              data-autofocus
            />
          </form>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Modal>
  );
}
