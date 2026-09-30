import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";
import { IconMore } from "./icons";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** "⋯" row menu: button + role="menu" popup, arrow-key navigation, Esc / outside click to close. */
export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const enabledIdx = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[enabledIdx[0] ?? 0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) btn.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const pos = enabledIdx.indexOf(current);
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      close(e.key === "Escape");
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      const next = enabledIdx[(pos + d + enabledIdx.length) % enabledIdx.length];
      itemRefs.current[next]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      itemRefs.current[e.key === "Home" ? enabledIdx[0] : enabledIdx[enabledIdx.length - 1]]?.focus();
    }
  };

  return (
    <div ref={wrap} className="relative inline-block" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-ink"
      >
        <IconMore />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKey} className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-surface p-1 shadow-lg">
          {items.map((it, i) => (
            <button
              key={it.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={it.disabled}
              onClick={() => {
                close(false);
                it.onSelect();
              }}
              className={cx(
                "block w-full rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-zinc-100 focus:bg-zinc-100 disabled:opacity-40",
                it.danger && "text-danger",
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
