import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import type { StudentTestItem } from "@shared/contract";
import { Button, cx, EmptyState, ErrorNote, PageLoader } from "@/components/ui";
import { useStudentMe } from "@/components/student/RequireStudent";
import { useStudentTests } from "@/components/student/queries";
import { StudentPageHeader } from "@/components/student/StudentPageHeader";
import { useDocumentTitle } from "@/components/student/useDocumentTitle";
import { InfoIcon, LockIcon } from "@/components/student/icons";
import {
  KIND_LABEL,
  POLICY_LABEL,
  attemptsLeft,
  attemptsValue,
  canStart,
  matchesFilter,
  shortDateTime,
  type ListFilter,
} from "@/components/student/testHelpers";

/**
 * Figma "Tests – List" (Desktop 1440 / Tablet 834 / Phone 390).
 * One card per assignment of the student's section. Start / Resume open the full-screen test page
 * (/tests/:assignmentId/take), which starts or resumes the attempt on the server.
 */
export default function TestsList() {
  useDocumentTitle("Tests");
  const me = useStudentMe();
  const enrolled = me.enrollment?.status === "active";
  const tests = useStudentTests(enrolled);
  const [filter, setFilter] = useState<ListFilter>("all");

  const section = me.enrollment ? me.enrollment.className.split(" · ").reverse().join(" · ") : null;
  const list = tests.data?.filter((t) => matchesFilter(t, filter)) ?? [];

  return (
    <div className="mx-auto max-w-[1200px]">
      <StudentPageHeader
        title="Tests"
        crumbs={[{ to: "/", label: "Home" }, { label: "Tests" }]}
        back="/"
        subtitle={section ? `Pretest and posttest for ${section}` : "Pretest and posttest"}
        phoneSubtitle={section ?? undefined}
        right={tests.data && tests.data.length > 0 ? <FilterPills value={filter} onChange={setFilter} /> : undefined}
      />

      <p className="mt-6 hidden items-center gap-2.5 rounded-xl bg-tests-soft px-4 py-3 text-[13px] font-medium text-tests-ink md:flex">
        <InfoIcon size={18} className="shrink-0" />
        Your answers save automatically. If the connection drops, come back and continue within the remaining time.
      </p>

      <div className="mt-[15px]">
        {!enrolled ? (
          <EmptyState title="You're not in a class yet">Scan your section's QR code to see its tests.</EmptyState>
        ) : tests.isPending ? (
          <PageLoader />
        ) : tests.isError ? (
          <div className="space-y-3">
            <ErrorNote>Couldn't load your tests. Check your connection and try again.</ErrorNote>
            <Button variant="outline" onClick={() => void tests.refetch()} loading={tests.isFetching}>
              Try again
            </Button>
          </div>
        ) : tests.data.length === 0 ? (
          <EmptyState title="No tests assigned to your section yet">Your instructor will open the pretest in class.</EmptyState>
        ) : list.length === 0 ? (
          <EmptyState title={filter === "open" ? "No open tests right now" : "No finished tests yet"} />
        ) : (
          <ul className="space-y-[11px] md:space-y-[15px]">
            {list.map((t) => (
              <TestCard key={t.assignmentId} t={t} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterPills({ value, onChange }: { value: ListFilter; onChange: (f: ListFilter) => void }) {
  const items: { id: ListFilter; label: string; idle: string }[] = [
    { id: "all", label: "All", idle: "bg-[#f0f0f2] text-ink" },
    { id: "open", label: "Open", idle: "bg-tests-soft text-tests" },
    { id: "done", label: "Done", idle: "bg-[#e8f5ec] text-success" },
  ];
  return (
    <div role="group" aria-label="Filter tests" className="flex gap-1.5">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          aria-pressed={value === i.id}
          onClick={() => onChange(i.id)}
          className={cx(
            "h-[25px] rounded-full px-3 text-[12px] font-semibold transition-colors",
            value === i.id ? "bg-ink text-white" : i.idle,
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_CHIP: Record<StudentTestItem["status"], { text: string; className: string }> = {
  not_open: { text: "Not open yet", className: "bg-[#f0f0f2] text-muted" },
  open: { text: "Open", className: "bg-tests text-white" },
  in_progress: { text: "In progress", className: "bg-amber-100 text-amber-800" },
  submitted: { text: "Submitted", className: "bg-[#e8f5ec] text-success" },
  closed: { text: "Closed", className: "bg-[#f0f0f2] text-muted" },
};

function TestCard({ t }: { t: StudentTestItem }) {
  const navigate = useNavigate();
  const chip = STATUS_CHIP[t.status];
  const highlight = t.status === "open" || t.status === "in_progress";
  const left = attemptsLeft(t);
  const startable = canStart(t);
  const hasResult = t.lastSubmittedAttemptId !== null;
  const score = t.countedScore !== null && t.maxScore !== null ? `${t.countedScore} / ${t.maxScore}` : "—";

  const meta: { label: string; value: string }[] = [];
  if (t.status === "not_open") {
    meta.push({ label: "Opens", value: t.opensAt ? shortDateTime(t.opensAt) : "By your instructor" });
    meta.push({ label: "Time limit", value: t.timeLimitMin ? `${t.timeLimitMin} min` : "None" });
  } else if (t.status === "open" || t.status === "in_progress") {
    meta.push({ label: "Time limit", value: t.timeLimitMin ? `${t.timeLimitMin} min` : "None" });
    meta.push({ label: "Attempts", value: attemptsValue(t) });
    if (t.maxAttempts !== 1) meta.push({ label: "Counts", value: POLICY_LABEL[t.scorePolicy] });
    if (t.closesAt) meta.push({ label: "Closes", value: shortDateTime(t.closesAt) });
    if (hasResult) meta.push({ label: "Score", value: score });
  } else {
    meta.push({ label: "Score", value: score });
    meta.push({ label: "Attempts", value: attemptsValue(t) });
    if (t.maxAttempts !== 1) meta.push({ label: "Counts", value: POLICY_LABEL[t.scorePolicy] });
    if (t.closesAt) meta.push({ label: t.status === "closed" ? "Closed" : "Closes", value: shortDateTime(t.closesAt) });
  }

  let note: ReactNode;
  if (t.status === "in_progress") note = "You have an unfinished attempt — your answers were saved.";
  else if (t.status === "open") note = t.timeLimitMin ? "Timer starts when you press Start" : "No time limit — you can leave and come back";
  else if (t.status === "not_open") note = "Opened by your instructor";
  else if (t.status === "submitted" && startable) note = left === null ? "You can try again" : `You can try again (${left} left)`;
  else if (t.status === "closed") note = "This test is closed";

  const goTake = () => navigate(`/tests/${t.assignmentId}/take`);

  let actions: ReactNode;
  if (t.status === "in_progress") {
    actions = <ActionButton onClick={goTake}>Resume</ActionButton>;
  } else if (startable && !hasResult) {
    actions = <ActionButton onClick={goTake}>Start</ActionButton>;
  } else if (hasResult) {
    actions = (
      <>
        <Link
          to={`/tests/result/${t.lastSubmittedAttemptId}`}
          className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-zinc-50 md:h-[43px]"
        >
          View result
        </Link>
        {startable && <ActionButton onClick={goTake}>Try again</ActionButton>}
      </>
    );
  } else {
    actions = (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-faint">
        <LockIcon size={14} /> Locked
      </span>
    );
  }

  return (
    <li
      className={cx(
        "rounded-[20px] border bg-surface px-[15px] py-[15px] md:px-[19px] md:py-[19px]",
        highlight ? "border-tests ring-1 ring-tests" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-[25px] items-center rounded-full bg-tests-soft px-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-tests">
            {KIND_LABEL[t.kind]}
          </span>
          <span className={cx("inline-flex h-[25px] items-center rounded-full px-2.5 text-[12px] font-semibold", chip.className)}>{chip.text}</span>
        </div>
        <span className="hidden shrink-0 pt-1 text-[12px] text-muted sm:block">{t.questionCount} questions</span>
      </div>

      <h2 className="mt-3 text-[17px] font-bold leading-[22px] text-ink md:mt-[13px] md:text-[20px] md:leading-7">{t.title}</h2>

      <dl className="mt-2.5 flex flex-wrap gap-x-[22px] gap-y-2">
        {meta.map((m) => (
          <div key={m.label}>
            <dt className="text-[11.5px] leading-4 text-faint">{m.label}</dt>
            <dd className="text-[13px] font-semibold leading-[18px] text-ink">{m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted">{note}</p>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
    </li>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 min-w-[78px] items-center justify-center rounded-xl bg-tests px-4 text-[15px] font-semibold text-white hover:bg-blue-700"
    >
      {children}
    </button>
  );
}
