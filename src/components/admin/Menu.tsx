import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/components/ui";
import { IconMore } from "./icons";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const MENU_WIDTH = 192;
const GAP = 4;

/**
 * "⋯" row menu: button + role="menu" popup, arrow-key navigation, Esc / outside click to close.
 * The popup is portalled to <body> with fixed positioning so a table's scroll box can't clip it;
 * it opens upward when there isn't room below, and closes on scroll / resize.
 */
export function RowMenu({
  label,
  items,
  active = false,
}: {
  label: string;
  items: MenuItem[];
  /** Figma: the selected row's ⋯ button sits on a grey tile. */ active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const menuId = useId();
  const enabledIdx = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);

  useLayoutEffect(() => {
    if (!open || !btn.current) {
      setPos(null);
      return;
    }
    const r = btn.current.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? items.length * 40 + 8;
    const below = r.bottom + GAP + height <= window.innerHeight - 8;
    const top = below ? r.bottom + GAP : Math.max(8, r.top - GAP - height);
    const left = Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPos({ top, left });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[enabledIdx[0] ?? 0]?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrap.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const onMove = (e: Event) => {
      if (menu.current && e.target instanceof Node && menu.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
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
        className={cx(
          "grid size-[26px] place-items-center rounded-lg hover:bg-[#f0f0f2] hover:text-ink",
          active || open ? "bg-[#f0f0f2] text-ink" : "text-muted",
        )}
      >
        <IconMore size={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: MENU_WIDTH,
              opacity: pos ? 1 : 0,
            }}
            className="z-50 rounded-xl border border-line bg-surface p-1 shadow-lg"
          >
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
                  // Focus the trigger first so a dialog opened by onSelect records it as the opener
                  // (and returns focus there when it closes).
                  close(true);
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
          </div>,
          document.body,
        )}
    </div>
  );
}
