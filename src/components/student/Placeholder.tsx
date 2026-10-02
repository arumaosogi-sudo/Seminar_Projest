import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge, Card, cx } from "@/components/ui";
import { ArrowLeftIcon, CheckIcon } from "./icons";
import { useDocumentTitle } from "./useDocumentTitle";

type Accent = "games" | "explore" | "tests";

export type PlaceholderLink = { to: string; label: string };

export type PlaceholderProps = {
  /** Page title shown to students, e.g. "Balloon Pop". */
  title: string;
  /** Figma frame name the teammate should match, e.g. "Game – Balloon Pop". */
  figmaFrame: string;
  /** Who builds it (shown on the card). */
  owner?: string;
  /** Requirement IDs from docs/plan/02_REQUIREMENTS.md, e.g. ["GAME-1", "GAME-5"]. */
  requirementIds: string[];
  accent: Accent;
  /** Source file to replace, e.g. "src/pages/games/BalloonPop.tsx". */
  file: string;
  /** What the finished page must do. */
  checklist: string[];
  /** Backend endpoints that already exist for this page. */
  apiReady?: string[];
  /** Useful links (back to hub, related pages). */
  links?: PlaceholderLink[];
  /** Extra working content rendered under the panel (e.g. a minimal live list). */
  children?: ReactNode;
  /** Short intro sentence for students who land here during the draft phase. */
  description?: string;
};

const accentTone: Record<Accent, { bar: string; soft: string; text: string; dot: string }> = {
  games: { bar: "border-games/40", soft: "bg-games-soft", text: "text-games-ink", dot: "bg-games" },
  explore: { bar: "border-explore/40", soft: "bg-explore-soft", text: "text-explore-ink", dot: "bg-explore" },
  tests: { bar: "border-tests/40", soft: "bg-tests-soft", text: "text-tests-ink", dot: "bg-tests" },
};

/**
 * The intentional "empty structure" for pages a teammate will build.
 * Replace the whole page file — the route in src/router.tsx is already wired.
 */
export function Placeholder({
  title,
  figmaFrame,
  owner = "Teammate",
  requirementIds,
  accent,
  file,
  checklist,
  apiReady,
  links,
  children,
  description,
}: PlaceholderProps) {
  const tone = accentTone[accent];
  useDocumentTitle(title);
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={cx("mb-1 text-xs font-bold uppercase tracking-wide", tone.text)}>{figmaFrame}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-[34px]">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
      </div>

      <section
        aria-labelledby="placeholder-heading"
        className={cx("rounded-[var(--radius-card)] border-2 border-dashed bg-surface p-5 sm:p-7", tone.bar)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("grid size-9 place-items-center rounded-xl text-lg", tone.soft)} aria-hidden="true">
            🧩
          </span>
          <h2 id="placeholder-heading" className="text-lg font-bold">
            This page is reserved for a teammate
          </h2>
          <Badge tone={accent}>{owner}</Badge>
        </div>
        <p className="mt-3 text-sm text-muted">
          Replace <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-ink">{file}</code>. The route
          is already wired in <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-ink">src/router.tsx</code>{" "}
          — keep the default export.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Requirements">
          {requirementIds.map((id) => (
            <Badge key={id}>{id}</Badge>
          ))}
        </div>

        <div className={cx("mt-6 grid gap-6", apiReady?.length ? "lg:grid-cols-[1.4fr_1fr]" : "")}>
          <div>
            <h3 className="text-sm font-bold">What to build</h3>
            <ul className="mt-3 space-y-2">
              {checklist.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm">
                  <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {apiReady && apiReady.length > 0 && (
            <div className="rounded-2xl bg-zinc-50 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-success">
                <CheckIcon size={16} /> API ready
              </h3>
              <ul className="mt-3 space-y-1.5">
                {apiReady.map((ep) => (
                  <li key={ep} className="break-words font-mono text-[12.5px] text-ink">
                    {ep}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">Types: shared/contract.ts · details: docs/ARCHITECTURE.md §5</p>
            </div>
          )}
        </div>
      </section>

      {children && <div className="mt-6">{children}</div>}

      <div className="mt-6 flex flex-wrap gap-2">
        {(links ?? [{ to: "/", label: "Back to Home" }]).map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-zinc-50"
          >
            {l.to === "/" && <ArrowLeftIcon size={16} />}
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Re-usable card wrapper for small live widgets rendered under a placeholder. */
export function PlaceholderSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export default Placeholder;
