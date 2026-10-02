import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { StudentStatus } from "@shared/contract";
import { cx } from "@/components/ui";
import { useStudentMe } from "@/components/student/RequireStudent";
import { joinNoticeStore } from "@/components/student/authHelpers";
import { useStudentStatus } from "@/components/student/queries";
import { useDocumentTitle } from "@/components/student/useDocumentTitle";
import { InfoIcon } from "@/components/student/icons";

type Accent = "games" | "explore" | "tests";

const tone: Record<Accent, { soft: string; text: string; button: string }> = {
  games: { soft: "bg-games-soft", text: "text-games", button: "md:bg-games md:hover:bg-violet-700" },
  explore: { soft: "bg-explore-soft", text: "text-explore", button: "md:bg-explore md:hover:bg-teal-700" },
  tests: { soft: "bg-tests-soft", text: "text-tests", button: "md:bg-tests md:hover:bg-blue-700" },
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

  return (
    <div>
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-8 text-ink md:text-[33px] md:leading-10 lg:text-[41px] lg:leading-[48px]">
          Hi, {me.student.firstName ?? "there"}
        </h1>
        <p className="mt-1 text-[13px] leading-[18px] text-muted md:mt-1.5 md:text-[15px] md:leading-[22px] lg:mt-2.5 lg:text-[16px] lg:leading-6">
          {me.student.studentCode}
          {me.enrollment && ` · ${sectionLabel(me.enrollment.className)}`}
        </p>
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
          <Notice tone="warning" title="We couldn't load your test status.">
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
      </div>

      <h2 className="mt-[35px] text-[17px] font-semibold leading-6 text-ink md:mt-[47px] md:text-[22px] md:leading-7 lg:mt-[62px]">Start learning</h2>
      <ul className="mt-4 grid gap-[13px] md:mt-[23px] md:gap-[21px] lg:mt-[26px] lg:grid-cols-3 lg:gap-[25px]">
        <MenuCard
          accent="games"
          image="/images/menu-games.png"
          title="Games"
          subtitle="Practice with quick 2D games"
          chips={["Balloon Pop", "Group Sort", "Diameter"].map((label) => ({ label, tone: "games" }))}
          lo="OL1–OL3"
          action="Play"
          to="/games"
        />
        <MenuCard
          accent="explore"
          image="/images/menu-explore.png"
          title="3D Explore"
          subtitle="Zoom from muscle to sarcomere"
          chips={["Muscle", "Fascicle", "Fiber", "Myofibril", "Sarcomere"].map((label) => ({ label, tone: "explore" }))}
          compactChips="path"
          lo="OL2–OL5"
          action="Explore"
          to="/explore"
        />
        <MenuCard
          accent="tests"
          image="/images/menu-tests.png"
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

/** "2569/1 · Section 1" → "Section 1 (2569/1)" (Figma greeting line). */
function sectionLabel(className: string) {
  const m = /^(\d{4}\/\d)\s*·\s*(.+)$/.exec(className);
  return m ? `${m[2]} (${m[1]})` : className;
}

type ChipTone = "games" | "explore" | "done" | "neutral";
type Chip = { label: string; tone: ChipTone };

const chipTone: Record<ChipTone, string> = {
  games: "bg-games-soft text-games-ink",
  explore: "bg-explore-soft text-explore",
  done: "bg-[#e8f5ec] text-success",
  neutral: "bg-[#f0f0f2] text-muted",
};

function testChips(s: StudentStatus | undefined, enrolled: boolean, pending: boolean): Chip[] {
  const neutral = (label: string): Chip => ({ label, tone: "neutral" });
  if (!enrolled) return [neutral("Join a class to see tests")];
  if (pending || !s) return [neutral("Loading…")];
  const chips: Chip[] = [];
  const done = (score: number | null, max: number | null) => (score !== null && max !== null ? `Done ${score}/${max}` : "Done");
  if (s.pretest) {
    const p = s.pretest;
    chips.push({ label: `Pretest · ${p.submitted ? done(p.score, p.maxScore) : "Not done"}`, tone: p.submitted ? "done" : "neutral" });
  }
  if (s.posttest) {
    const p = s.posttest;
    chips.push({
      label: `Posttest · ${p.submitted ? done(p.score, p.maxScore) : p.isOpen ? "Open" : "Not open yet"}`,
      tone: p.submitted ? "done" : "neutral",
    });
  }
  return chips.length ? chips : [neutral("No tests assigned yet")];
}

type MenuCardProps = {
  accent: Accent;
  image: string;
  title: string;
  subtitle: string;
  chips: Chip[];
  /** Phone only: show the chips as one "A › B › C" line instead (Figma 3D Explore card). */
  compactChips?: "path";
  lo: string;
  action: string;
  to: string;
};

/*
 * Figma "Home" menu card.
 *   Phone  : 48 px tile + title row, chips below, "Action →" text link
 *   Tablet : 88 px tile on the left, everything else in the right column, 132×44 button
 *   Desktop: 180 px tinted cover with an 84 px icon, body below, 132×44 button pinned to the bottom
 */
function MenuCard({ accent, image, title, subtitle, chips, compactChips, lo, action, to }: MenuCardProps) {
  const t = tone[accent];
  const art = (size: string) => <img src={image} alt="" width={168} height={168} draggable={false} className={size} />;

  return (
    <li className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface lg:min-h-[453px]">
      {/* Desktop cover */}
      <div className={cx("relative hidden h-[180px] shrink-0 items-center justify-center lg:flex", t.soft)}>{art("size-[84px]")}</div>

      <div className="grid flex-1 grid-cols-[48px_1fr] gap-x-[15px] px-[17px] pb-4 pt-4 md:grid-cols-[88px_1fr] md:gap-x-[29px] md:p-7 lg:flex lg:flex-col lg:gap-x-0">
        {/* Phone / tablet tile */}
        <div
          className={cx(
            "relative col-start-1 row-start-1 grid size-12 place-items-center rounded-[14px] md:row-span-3 md:size-[88px] md:rounded-[20px] lg:hidden",
            t.soft,
          )}
        >
          {art("size-7 md:size-12")}
        </div>

        <div className="col-start-2 row-start-1 min-w-0 self-center md:self-start">
          <h3 className="text-[17px] font-semibold leading-[22px] text-ink md:text-[22px] md:leading-7 lg:text-[26px] lg:leading-8">
            {title}
          </h3>
          <p className="mt-0.5 text-[12px] leading-4 text-muted md:mt-[7px] md:text-[13px] md:leading-[18px] lg:mt-[9px] lg:text-[15px] lg:leading-[22px]">
            {subtitle}
          </p>
        </div>

        {compactChips === "path" && (
          <p className="col-span-2 mt-3 text-[12px] font-semibold leading-4 text-explore md:hidden">
            {chips.map((c) => c.label).join(" › ")}
          </p>
        )}
        <ul
          className={cx(
            "col-span-2 mt-3 flex flex-wrap gap-x-2 gap-y-2 md:col-span-1 md:col-start-2 md:mt-3.5 lg:mt-[17px]",
            compactChips === "path" && "hidden md:flex",
          )}
          aria-label={`${title} includes`}
        >
          {chips.map((c) => (
            <li key={c.label} className={cx("inline-flex h-[25px] items-center rounded-full px-3 text-[12px] font-semibold", chipTone[c.tone])}>
              {c.label}
            </li>
          ))}
        </ul>

        <div className="col-span-2 mt-4 flex items-center justify-between gap-3 md:col-span-1 md:col-start-2 md:mt-[21px] lg:mt-auto lg:pt-[35px]">
          <span className="text-[12px] font-semibold text-faint lg:text-[13px]">{lo}</span>
          <Link
            to={to}
            aria-label={`${action} — ${title}`}
            className={cx(
              "inline-flex items-center text-[15px] font-semibold transition-colors md:h-11 md:w-[132px] md:justify-center md:rounded-xl md:text-[15px] md:text-white",
              t.text,
              t.button,
            )}
          >
            {action}
            <span aria-hidden="true" className="ml-1 md:hidden">
              →
            </span>
          </Link>
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
