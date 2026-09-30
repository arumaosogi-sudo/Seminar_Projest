import type { StudentTestItem } from "@shared/contract";
import { Badge, Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { Placeholder, PlaceholderSection } from "@/components/student/Placeholder";
import { useStudentMe } from "@/components/student/RequireStudent";
import { useStudentTests } from "@/components/student/queries";

const TESTS_API = [
  "GET /api/me/tests → StudentTestItem[]",
  "GET /api/me/status → StudentStatus",
  "POST /api/attempts { assignmentId } → AttemptInProgress (resumes an in-progress attempt)",
  "GET /api/attempts/:id → AttemptInProgress | AttemptResult",
  "PUT /api/attempts/:id/answers { answers } → { savedAt } (merge)",
  "POST /api/attempts/:id/submit → AttemptResult",
];

/** 🧩 Teammate page — replace this file (route: /tests). Includes a minimal live list so Home → "Start pretest" lands somewhere useful. */
export default function TestsList() {
  return (
    <Placeholder
      title="Tests"
      description="Pretest and posttest for your section."
      figmaFrame="Tests – List"
      accent="tests"
      file="src/pages/tests/TestsList.tsx"
      requirementIds={["TEST-1", "TEST-5"]}
      checklist={[
        "One card per assignment: title, kind (Pretest / Posttest), status (Not open yet / Open / In progress / Submitted / Closed), questions + time limit",
        "Attempts: “Attempts 1 / 3” or “Unlimited attempts”; counted score per policy (highest / latest / first)",
        "Primary button: “Start” (open) · “Resume” (inProgressAttemptId) · disabled when not open, closed or no attempts left",
        "Start/Resume: POST /api/attempts { assignmentId } → navigate to /tests/:assignmentId/take",
        "“View result” → /tests/result/:lastSubmittedAttemptId when a submitted attempt exists",
        "Show opensAt / closesAt in local time; pull-to-refresh or refetch on focus so a newly opened test appears",
        "Empty state: “No tests assigned to your section yet”",
      ]}
      apiReady={TESTS_API}
      links={[{ to: "/", label: "Back to Home" }]}
    >
      <PlaceholderSection title="Your tests (live preview)">
        <LiveTestList />
      </PlaceholderSection>
    </Placeholder>
  );
}

const STATUS_LABEL: Record<StudentTestItem["status"], { text: string; tone: "neutral" | "tests" | "success" | "danger" }> = {
  not_open: { text: "Not open yet", tone: "neutral" },
  open: { text: "Open", tone: "tests" },
  in_progress: { text: "In progress", tone: "tests" },
  submitted: { text: "Submitted", tone: "success" },
  closed: { text: "Closed", tone: "neutral" },
};

const KIND_LABEL: Record<StudentTestItem["kind"], string> = { pretest: "Pretest", posttest: "Posttest", other: "Test" };

function LiveTestList() {
  const me = useStudentMe();
  const enrolled = me.enrollment?.status === "active";
  const tests = useStudentTests(enrolled);

  if (!enrolled) {
    return <EmptyState title="You're not in a class yet">Scan your section's QR code to see its tests.</EmptyState>;
  }
  if (tests.isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted" role="status">
        <Spinner className="size-4" /> Loading your tests…
      </div>
    );
  }
  if (tests.isError) {
    return (
      <div className="space-y-3">
        <ErrorNote>Couldn't load your tests.</ErrorNote>
        <Button variant="outline" size="sm" onClick={() => void tests.refetch()} loading={tests.isFetching}>
          Try again
        </Button>
      </div>
    );
  }
  if (tests.data.length === 0) {
    return <EmptyState title="No tests assigned to your section yet">Your instructor will open the pretest in class.</EmptyState>;
  }

  return (
    <ul className="divide-y divide-line">
      {tests.data.map((t) => {
        const s = STATUS_LABEL[t.status];
        const attempts = t.maxAttempts === null ? `${t.attemptsUsed} used · unlimited` : `Attempts ${t.attemptsUsed} / ${t.maxAttempts}`;
        return (
          <li key={t.assignmentId} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{t.title}</p>
                <Badge tone="tests">{KIND_LABEL[t.kind]}</Badge>
                <Badge tone={s.tone}>{s.text}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {t.questionCount} questions · {t.timeLimitMin ? `${t.timeLimitMin} min` : "No time limit"} · {attempts}
                {t.countedScore !== null && t.maxScore !== null && ` · Score ${t.countedScore}/${t.maxScore}`}
              </p>
            </div>
            <span className="flex flex-col items-start sm:items-end" title="The test-taking page is being built">
              <Button accent="tests" size="sm" disabled aria-describedby={`soon-${t.assignmentId}`}>
                {t.status === "in_progress" ? "Resume" : "Start"}
              </Button>
              <span id={`soon-${t.assignmentId}`} className="mt-1 text-[11px] text-muted">
                Coming soon
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
