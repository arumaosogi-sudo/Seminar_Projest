/**
 * Shared UI primitives (Figma "the idea อันล่าสุด…" page). Keep them small and dependency-free.
 * Accent names: "ink" (default dark), "games", "explore", "tests", "danger", "success".
 */
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export type Accent = "ink" | "games" | "explore" | "tests" | "danger" | "success";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

const solid: Record<Accent, string> = {
  ink: "bg-ink text-white hover:bg-zinc-700",
  games: "bg-games text-white hover:bg-violet-700",
  explore: "bg-explore text-white hover:bg-teal-700",
  tests: "bg-tests text-white hover:bg-blue-700",
  danger: "bg-danger text-white hover:bg-red-700",
  success: "bg-success text-white hover:bg-green-800",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost";
  accent?: Accent;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  loading?: boolean;
};

export function Button({ variant = "solid", accent = "ink", size = "md", block, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-base",
        variant === "solid" && solid[accent],
        variant === "outline" && "border border-line bg-surface text-ink hover:bg-zinc-50",
        variant === "ghost" && "text-ink hover:bg-zinc-100",
        block && "w-full",
        className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx("rounded-[var(--radius-card)] border border-line bg-surface", className)} />;
}

const badgeTone: Record<Accent | "neutral", string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  ink: "bg-ink text-white",
  games: "bg-games-soft text-games-ink",
  explore: "bg-explore-soft text-explore-ink",
  tests: "bg-tests-soft text-tests-ink",
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Accent | "neutral"; className?: string; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", badgeTone[tone], className)}>{children}</span>;
}

export function DraftBadge() {
  return <Badge tone="ink" className="tracking-wide">DRAFT</Badge>;
}

type FieldProps = { label?: string; hint?: string; error?: string };

export function Input({ label, hint, error, className, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const inputId = id ?? rest.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1.5 block text-sm font-semibold">{label}</span>}
      <input
        id={inputId}
        {...rest}
        aria-invalid={!!error}
        className={cx(
          "h-11 w-full rounded-xl border bg-surface px-3.5 text-[15px] outline-none transition-colors placeholder:text-faint read-only:bg-zinc-100 read-only:text-muted focus:border-ink",
          error ? "border-danger" : "border-line",
          className,
        )}
      />
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Select({ label, className, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const selectId = id ?? rest.name;
  return (
    <label className="block" htmlFor={selectId}>
      {label && <span className="mb-1.5 block text-sm font-semibold">{label}</span>}
      <select id={selectId} {...rest} className={cx("h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-ink", className)}>
        {children}
      </select>
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className ?? "size-5")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-muted" role="status" aria-live="polite">
      <Spinner className="size-7" />
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-danger-soft px-4 py-3 text-sm text-red-800">{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** App logo: dark rounded square with sarcomere-like bars (matches public/favicon.svg). */
export function Logo({ size = 32, withText = true, sub }: { size?: number; withText?: boolean; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#18181B" />
        <rect x="8" y="7" width="2.5" height="18" rx="1.2" fill="#FAFAFA" />
        <rect x="14.5" y="7" width="3" height="18" rx="1.5" fill="#2DD4BF" />
        <rect x="21.5" y="7" width="2.5" height="18" rx="1.2" fill="#FAFAFA" />
      </svg>
      {withText && (
        <span className="leading-tight">
          <span className="block font-bold">Digital Muscle</span>
          {sub && <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{sub}</span>}
        </span>
      )}
    </span>
  );
}
