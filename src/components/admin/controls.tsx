import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Button, cx, ErrorNote } from "@/components/ui";
import { errorMessage } from "./format";

/* ───────── Segmented control (radiogroup with roving focus) ───────── */

type SegmentedProps<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  label: string; // accessible name
  size?: "sm" | "md";
  className?: string;
};

export function Segmented<T extends string>({ value, onChange, options, label, size = "md", className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);
  const hasActive = options.some((o) => o.value === value);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir || enabled.length === 0) return;
    e.preventDefault();
    const idx = enabled.findIndex((o) => o.value === value);
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex rounded-xl bg-zinc-100 p-1", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (!hasActive && o === enabled[0]) ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={onKey}
            className={cx(
              "rounded-lg font-semibold transition-colors disabled:opacity-40",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── Switch ───────── */

type SwitchProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string; // accessible name (visually hidden unless showLabel)
  showLabel?: boolean;
  disabled?: boolean;
  accent?: "ink" | "tests" | "success";
};

export function Switch({ checked, onChange, label, showLabel, disabled, accent = "ink" }: SwitchProps) {
  const on = { ink: "bg-ink", tests: "bg-tests", success: "bg-success" }[accent];
  return (
    <label className={cx("inline-flex items-center gap-2.5", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={showLabel ? undefined : label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? on : "bg-zinc-300")}
      >
        <span className={cx("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </button>
      {showLabel && <span className="text-sm font-medium">{label}</span>}
    </label>
  );
}

/* ───────── Settings row (label + helper left, control right) ───────── */

export function SettingRow({ label, helper, children, htmlFor }: { label: string; helper?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 sm:max-w-[48%]">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-semibold">
            {label}
          </label>
        ) : (
          <p className="text-sm font-semibold">{label}</p>
        )}
        {helper && <p className="mt-0.5 text-xs text-muted">{helper}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>
    </div>
  );
}

/* ───────── Stat card ───────── */

export function StatCard({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "ink" | "tests" | "success" | "muted";
}) {
  const color = { ink: "text-ink", tests: "text-tests", success: "text-success", muted: "text-muted" }[tone];
  return (
    <div className="rounded-[20px] border border-line bg-surface p-5">
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className={cx("mt-2 text-3xl font-bold tracking-tight tabular-nums", color)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/* ───────── Query error with retry ───────── */

export function QueryError({ error, onRetry, what = "data" }: { error: unknown; onRetry?: () => void; what?: string }) {
  return (
    <ErrorNote>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          Couldn’t load {what}. {errorMessage(error)}
        </span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </ErrorNote>
  );
}

/* ───────── Card header helper ───────── */

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold tracking-wider text-muted uppercase">{children}</h2>
      {right}
    </div>
  );
}

/* ───────── Search box ───────── */

export function SearchBox({ value, onChange, placeholder = "Search", label = "Search" }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <svg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm outline-none focus:border-ink"
      />
    </div>
  );
}
