import { useEffect, useId, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router";
import type { StudentStatus } from "@shared/contract";
import { cx, DraftBadge } from "@/components/ui";
import { useStudentMe } from "@/components/student/RequireStudent";
import { joinNoticeStore } from "@/components/student/authHelpers";
import { useStudentStatus } from "@/components/student/queries";
import { useDocumentTitle } from "@/components/student/useDocumentTitle";
import { BalloonIcon, ChecklistIcon, CubeIcon, InfoIcon, LockIcon } from "@/components/student/icons";

type Accent = "games" | "explore" | "tests";

const tone: Record<Accent, { soft: string; icon: string; button: string }> = {
  games: { soft: "bg-games-soft", icon: "text-games", button: "bg-games hover:bg-violet-700" },
  explore: { soft: "bg-explore-soft", icon: "text-explore", button: "bg-explore hover:bg-teal-700" },
  tests: { soft: "bg-tests-soft", icon: "text-tests", button: "bg-tests hover:bg-blue-700" },
};

export default function Home() {
  const me = useStudentMe();
  useDocumentTitle("Home");
  const enrolled = !!me.enrollment && me.enrollment.status === "active";

  const status = useStudentStatus(enrolled);

  // One-shot notice from the login response (read once, then forget it).
  const [notice, setNotice] = useState<string | undefined>(() => me.joinNotice ?? joinNoticeStore.get());
  useEffect(() => {
    joinNoticeStore.clear();
  }, []);

  const pretestLocked = enrolled && status.data?.menusLocked === true;
  // Fail-closed: if the status can't be loaded, keep Games / 3D locked until a retry succeeds.
  const locked = pretestLocked || (enrolled && status.isError);
  const lockHint = status.isError ? "Couldn't check your status" : "Finish the Pretest first";
  // Until the status is known we don't know if menus are locked — keep their buttons inactive briefly.
  const statusUnknown = enrolled && status.isPending;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight sm:text-[40px] sm:leading-tight">
            Hi, {me.student.firstName ?? "there"}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {me.student.studentCode}
            {me.enrollment && ` · ${me.enrollment.className}`}
          </p>
        </div>
        <DraftBadge />
      </div>

      <div className="mt-6 space-y-3 empty:hidden">
        {!enrolled && (
          <Notice tone="warning" title="You're not in a class yet — scan your section's QR code.">
            Ask your instructor for the QR code of your section. After scanning it, sign in again to join.
          </Notice>
        )}
        {notice && (
          <Notice tone="info" onDismiss={() => setNotice(undefined)}>
            {notice}
          </Notice>
        )}
        {status.isError && (
          <Notice tone="warning" title="We couldn't load your test status, so Games and 3D Explore are locked for now.">
            <button
              type="button"
              className="font-semibold underline disabled:opacity-50"
              disabled={status.isFetching}
              onClick={() => void status.refetch()}
            >
              {status.isFetching ? "Retrying…" : "Retry"}
            </button>
          </Notice>
        )}
        {pretestLocked && (
          <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-tests-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="flex items-start gap-2.5 text-[15px] font-medium text-tests-ink">
              <LockIcon size={20} className="mt-px shrink-0" />
              Finish the Pretest to unlock Games and 3D Explore
            </p>
            <Link
              to="/tests"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-tests px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Start pretest
            </Link>
          </div>
        )}
      </div>

      <h2 className="mb-4 mt-8 text-xl font-bold">Start learning</h2>
      <ul className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <MenuCard
          accent="games"
          icon={BalloonIcon}
          title="Games"
          subtitle="Practice with quick 2D games"
          chips={["Balloon Pop", "Group Sort", "Diameter"]}
          lo="OL1–OL3"
          action="Play"
          to="/games"
          locked={locked}
          lockHint={lockHint}
          pending={statusUnknown}
        />
        <MenuCard
          accent="explore"
          icon={CubeIcon}
          title="3D Explore"
          subtitle="Zoom from muscle to sarcomere"
          chips={["Muscle", "Fascicle", "Fiber", "Myofibril", "Sarcomere"]}
          lo="OL2–OL5"
          action="Explore"
          to="/explore"
          locked={locked}
          lockHint={lockHint}
          pending={statusUnknown}
        />
        <MenuCard
          accent="tests"
          icon={ChecklistIcon}
          title="Tests"
          subtitle="Pretest and posttest"
          chips={testChips(status.data, enrolled, status.isPending)}
          lo="Assessment"
          action="Open"
          to="/tests"
        />
      </ul>
    </div>
  );
}

function testChips(s: StudentStatus | undefined, enrolled: boolean, pending: boolean): string[] {
  if (!enrolled) return ["Join a class to see tests"];
  if (pending || !s) return ["Loading…"];
  const chips: string[] = [];
  const done = (score: number | null, max: number | null) => (score !== null && max !== null ? `Done ${score}/${max}` : "Done");
  if (s.pretest) chips.push(`Pretest · ${s.pretest.submitted ? done(s.pretest.score, s.pretest.maxScore) : "Not done"}`);
  if (s.posttest) {
    const p = s.posttest;
    chips.push(`Posttest · ${p.submitted ? done(p.score, p.maxScore) : p.isOpen ? "Open" : "Not open yet"}`);
  }
  return chips.length ? chips : ["No tests assigned yet"];
}

type MenuCardProps = {
  accent: Accent;
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  chips: string[];
  lo: string;
  action: string;
  to: string;
  locked?: boolean;
  lockHint?: string;
  pending?: boolean;
};

function MenuCard({ accent, icon: Icon, title, subtitle, chips, lo, action, to, locked = false, lockHint = "Finish the Pretest first", pending = false }: MenuCardProps) {
  const t = tone[accent];
  const lockHintId = useId();
  const inactive = locked || pending;

  return (
    <li
      className={cx(
        "flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface md:flex-row lg:flex-col",
        locked && "bg-zinc-50",
      )}
    >
      {/* Cover: band on phone · square tile on tablet · 160px cover on desktop */}
      <div
        className={cx(
          "relative flex h-24 items-center justify-center md:m-4 md:mr-0 md:h-auto md:w-28 md:shrink-0 md:rounded-2xl lg:m-0 lg:h-40 lg:w-auto lg:rounded-none",
          locked ? "bg-zinc-100 text-faint" : cx(t.soft, t.icon),
        )}
      >
        <span className="lg:hidden">
          <Icon size={44} />
        </span>
        <span className="hidden lg:block">
          <Icon size={72} />
        </span>
        {locked && (
          <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-surface text-muted shadow-sm">
            <LockIcon size={16} />
            <span className="sr-only">Locked</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 md:flex-row md:items-center md:gap-6 lg:flex-col lg:items-stretch lg:gap-0">
        <div className="min-w-0 flex-1">
          <h3 className={cx("text-xl font-bold", locked && "text-muted")}>{title}</h3>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${title} includes`}>
            {chips.map((c) => (
              <li key={c} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 md:mt-0 md:flex-col md:items-end lg:mt-auto lg:flex-row lg:items-center lg:pt-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">{lo}</span>
          {inactive ? (
            <span className="flex flex-col items-end" title={locked ? lockHint : undefined}>
              <button
                type="button"
                disabled
                aria-describedby={locked ? lockHintId : undefined}
                className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-xl bg-zinc-200 px-5 text-sm font-semibold text-muted"
              >
                {locked && <LockIcon size={14} />}
                {action}
              </button>
              {locked && (
                <span id={lockHintId} className="mt-1 text-[11px] text-muted">
                  {lockHint}
                </span>
              )}
            </span>
          ) : (
            <Link
              to={to}
              aria-label={`${action} — ${title}`}
              className={cx("inline-flex h-10 items-center rounded-xl px-5 text-sm font-semibold text-white transition-colors", t.button)}
            >
              {action}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function Notice({
  tone: kind,
  title,
  children,
  onDismiss,
}: {
  tone: "info" | "warning";
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role={kind === "warning" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm",
        kind === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line bg-surface text-ink",
      )}
    >
      <InfoIcon size={18} className="mt-px shrink-0" />
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", kind === "info" && "text-muted")}>{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="rounded px-1 text-muted hover:text-ink" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}
