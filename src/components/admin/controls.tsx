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
    <div role="radiogroup" aria-label={label} className={cx("inline-flex rounded-xl bg-[#f0f0f2] p-1", className)}>
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
              // Figma: 44 px grey track, 36 px white active segment with blue text.
              "rounded-[9px] transition-colors disabled:opacity-40",
              size === "sm" ? "px-2.5 py-1 text-xs" : "h-9 px-[15px] text-[14px]",
              active ? "bg-surface font-semibold text-tests" : "font-medium text-muted hover:text-ink",
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
  /** Put the visible label before the switch (Figma "Required ⏺"). */
  labelFirst?: boolean;
};

/** Figma switch: 40×24 track (blue when on, zinc-300 off) with an 18 px white knob. */
export function Switch({ checked, onChange, label, showLabel, disabled, accent = "tests", labelFirst }: SwitchProps) {
  const on = { ink: "bg-ink", tests: "bg-tests", success: "bg-success" }[accent];
  const text = showLabel && <span className={cx(labelFirst ? "text-[12px] text-muted" : "text-sm font-medium")}>{label}</span>;
  return (
    <label className={cx("inline-flex items-center gap-2.5", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      {labelFirst && text}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={showLabel ? undefined : label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? on : "bg-zinc-300")}
      >
        <span className={cx("absolute left-[3px] top-[3px] size-[18px] rounded-full bg-white shadow-sm transition-transform", checked && "translate-x-4")} />
      </button>
      {!labelFirst && text}
    </label>
  );
}

/* ───────── Settings row (label + helper left, control right) ───────── */

export function SettingRow({ label, helper, children, htmlFor }: { label: string; helper?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    // Figma assign rows: no dividers, 14 px semibold label + 12 px helper on the left, control right-aligned.
    <div className="flex flex-col gap-3 py-[18px] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[14px] font-semibold leading-5 text-ink">
            {label}
          </label>
        ) : (
          <p className="text-[14px] font-semibold leading-5 text-ink">{label}</p>
        )}
        {helper && <p className="mt-1 text-[12px] leading-4 text-muted">{helper}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{children}</div>
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
  // Figma stat card: 131 px tall, 24 px padding, 12 px label · 30 px value · 12 px note.
  return (
    <div className="rounded-[20px] border border-line bg-surface px-6 pb-5 pt-[22px]">
      <p className="text-[12px] font-semibold uppercase leading-4 text-muted">{label}</p>
      <p className={cx("mt-3 text-[30px] font-bold leading-9 tabular-nums", color)}>{value}</p>
      {sub && <p className="mt-2.5 text-[12px] leading-4 text-muted">{sub}</p>}
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
      <h2 className="text-[12px] font-semibold uppercase leading-4 text-faint">{children}</h2>
      {right}
    </div>
  );
}

/* ───────── Search box ───────── */

/** Figma admin search field: 43 px tall, 11.5 px radius, zinc-200 border, no icon, 14 px text. */
export function SearchBox({ value, onChange, placeholder = "Search", label = "Search" }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[43px] w-full rounded-[11.5px] border border-line bg-surface px-[15px] text-[14px] text-ink outline-none placeholder:text-faint focus:border-gray-800"
      />
    </div>
  );
}

/** Figma filter pills ("Active (4)" / "Archived (2)"): dark pill when selected, grey otherwise. */
export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex h-[25px] items-center rounded-full px-[11px] text-[12px] transition-colors",
              active ? "bg-ink font-semibold text-white" : "bg-[#f0f0f2] font-medium text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Figma filter field: white 43 px box, "Label: **value**" and a small chevron.
 * A transparent native <select> sits on top so keyboard / screen-reader behaviour stays native.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  display,
  children,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  display: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("relative flex h-[43px] items-center gap-1.5 rounded-[11.5px] border border-line bg-surface pl-4 pr-9 focus-within:border-gray-800", className)}>
      <span className="text-[13px] text-muted">{label}:</span>
      <span className="truncate text-[14px] font-semibold text-ink">{display}</span>
      <svg className="pointer-events-none absolute right-3.5 size-3 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        {children}
      </select>
    </div>
  );
}

/** Figma status chip: 25 px pill, 12 px semibold. */
export function StatusChip({ tone, children }: { tone: "success" | "neutral" | "danger" | "tests"; children: ReactNode }) {
  const t = {
    success: "bg-[#e8f5ec] text-success",
    neutral: "bg-[#f0f0f2] text-muted",
    danger: "bg-danger-soft text-danger",
    tests: "bg-tests-soft text-tests",
  }[tone];
  return <span className={cx("inline-flex h-[25px] items-center whitespace-nowrap rounded-full px-3 text-[12px] font-semibold", t)}>{children}</span>;
}
