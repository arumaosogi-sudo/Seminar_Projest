import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { AttemptInProgress, AttemptResult } from "@shared/contract";
import { api } from "@/lib/api";
import { Button, cx, ErrorNote, PageLoader } from "@/components/ui";
import { useStudentStatus, useStudentTests } from "@/components/student/queries";
import { StudentPageHeader } from "@/components/student/StudentPageHeader";
import { useDocumentTitle } from "@/components/student/useDocumentTitle";
import { CheckIcon, XIcon } from "@/components/student/icons";
import { KIND_LABEL, answerText, canStart, durationBetween, fullDateTime } from "@/components/student/testHelpers";

/**
 * Figma "Tests – Result" (Desktop 1440 / Tablet 834 / Phone 390).
 * Always re-fetches GET /api/attempts/:id — the review only appears when the server allows it
 * (instructor enabled answers AND no attempts left or the test is closed).
 */
export default function TestResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const id = Number(attemptId);

  const attempt = useQuery({
    queryKey: ["me", "attempt", id],
    queryFn: () => api.get<AttemptInProgress | AttemptResult>(`/attempts/${id}`),
    enabled: Number.isSafeInteger(id) && id > 0,
    staleTime: 0,
  });
  const tests = useStudentTests();
  const status = useStudentStatus();

  const r = attempt.data?.status === "submitted" ? attempt.data : null;
  useDocumentTitle(r ? `Result · ${r.title}` : "Result");

  // Still in progress (e.g. opened from history) → back to the test page.
  useEffect(() => {
    if (attempt.data?.status === "in_progress") navigate(`/tests/${attempt.data.assignmentId}/take`, { replace: true });
  }, [attempt.data, navigate]);

  if (!Number.isSafeInteger(id) || id <= 0) return <Missing />;
  if (attempt.isPending || attempt.data?.status === "in_progress") return <PageLoader />;
  if (attempt.isError || !r) return <Missing message={attempt.error instanceof Error ? attempt.error.message : undefined} />;

  const item = tests.data?.find((t) => t.assignmentId === r.assignmentId) ?? null;
  const kind = item ? KIND_LABEL[item.kind] : "Test";
  const attemptLine = `${kind} · Attempt ${r.attemptNumber}${item?.maxAttempts ? ` of ${item.maxAttempts}` : ""}`;
  const retry = item ? canStart(item) && item.status !== "in_progress" : false;
  const left = r.attemptsLeft;

  // "Pretest 7 → Posttest 8 (+1)" when both are done (from GET /api/me/status).
  const pre = status.data?.pretest;
  const post = status.data?.posttest;
  const compare =
    item?.kind === "posttest" && pre?.submitted && pre.score !== null && post?.submitted && post.score !== null
      ? { pre: pre.score, post: post.score, diff: post.score - pre.score }
      : null;

  return (
    <div className="mx-auto max-w-[1200px]">
      <StudentPageHeader
        title="Result"
        crumbs={[{ to: "/tests", label: "Tests" }, { label: r.title }, { label: "Result" }]}
        back="/tests"
        phoneSubtitle={attemptLine}
      />

      <div className="mt-0 grid gap-[13px] md:mt-6 md:gap-[18px] lg:grid-cols-[384px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Score card */}
        <section className="rounded-[20px] border border-line bg-surface px-5 py-[19px] text-center md:px-[22px] md:py-[22px]">
          <span className="hidden h-[25px] items-center rounded-full bg-tests-soft px-3 text-[11.5px] font-semibold uppercase tracking-wide text-tests md:inline-flex">
            {attemptLine}
          </span>
          <ScoreRing score={r.score} max={r.maxScore} />
          <p className="mt-4 hidden text-[19px] font-bold text-ink md:block">{r.autoSubmitted ? "Submitted automatically" : "Submitted"}</p>
          <p className="mt-1 hidden text-[13px] text-muted md:block">
            {fullDateTime(r.submittedAt)} · took {durationBetween(r.startedAt, r.submittedAt)}
          </p>
          {r.autoSubmitted && <p className="mt-2 text-[12.5px] text-amber-800 md:hidden">Submitted automatically when time ran out</p>}
          {compare && (
            <p className="mt-4 inline-flex h-[34px] items-center rounded-xl bg-[#e8f5ec] px-3.5 text-[13.5px] font-semibold text-success">
              Pretest {compare.pre} → Posttest {compare.post} ({compare.diff >= 0 ? "+" : ""}
              {compare.diff})
            </p>
          )}
          <div className="mt-5 hidden gap-2.5 md:grid md:grid-cols-2">
            <Link
              to="/tests"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-surface text-[14px] font-semibold text-ink hover:bg-zinc-50"
            >
              Back to tests
            </Link>
            {retry ? (
              <Button accent="tests" size="lg" onClick={() => navigate(`/tests/${r.assignmentId}/take`)}>
                Try again{left !== null ? ` (${left} left)` : ""}
              </Button>
            ) : (
              <Link to="/" className="inline-flex h-11 items-center justify-center rounded-xl bg-tests text-[14px] font-semibold text-white hover:bg-blue-700">
                Back to Home
              </Link>
            )}
          </div>
        </section>

        {/* Review */}
        <Review r={r} />

        {/* Phone actions */}
        <div className="md:hidden">
          {retry ? (
            <Button accent="tests" size="lg" block className="h-[46px] text-[15px]" onClick={() => navigate(`/tests/${r.assignmentId}/take`)}>
              Try again{left !== null ? ` (${left} left)` : ""}
            </Button>
          ) : (
            <Link to="/tests" className="inline-flex h-[46px] w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink">
              Back to tests
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, max }: { score: number; max: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
  return (
    <div className="relative mx-auto mt-0 size-[118px] md:mt-5 md:size-[124px]" role="img" aria-label={`Score ${score} out of ${max}`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e4e4e7" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--color-tests)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-[36px] font-bold leading-10 text-ink">{score}</span>
        <span className="text-[12px] text-muted">/ {max}</span>
      </div>
    </div>
  );
}

function Review({ r }: { r: AttemptResult }) {
  const firstWrong = r.review?.find((q) => !q.correct)?.questionId ?? r.review?.[0]?.questionId ?? null;
  const [selected, setSelected] = useState<number | null>(firstWrong);
  const item = r.review?.find((q) => q.questionId === selected) ?? null;

  return (
    <section className="rounded-[20px] border border-line bg-surface p-[15px] md:p-[22px]" aria-labelledby="review-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="review-title" className="text-[11.5px] font-semibold uppercase tracking-wide text-muted md:text-[19px] md:font-bold md:normal-case md:tracking-normal md:text-ink">
          Review
        </h2>
        {r.review && <p className="hidden text-[12px] text-muted md:block">Answers shown because your instructor allowed it</p>}
      </div>

      {!r.review ? (
        <p className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-[13.5px] text-muted">
          {r.attemptsLeft === 0
            ? "Your instructor hasn't shared the answers for this test."
            : "Answers will be shown after your last attempt or when the test closes — if your instructor allows it."}
        </p>
      ) : (
        <>
          <ol className="mt-3 grid grid-cols-5 gap-2 md:mt-4 md:flex md:flex-wrap">
            {r.review.map((q) => {
              const on = q.questionId === selected;
              return (
                <li key={q.questionId}>
                  <button
                    type="button"
                    onClick={() => setSelected(q.questionId)}
                    aria-pressed={on}
                    aria-label={`Question ${q.position}, ${q.correct ? "correct" : "wrong"}`}
                    className={cx(
                      "grid h-10 w-full place-items-center rounded-xl text-[14px] font-semibold md:size-[42px]",
                      q.correct ? "bg-[#e8f5ec] text-success" : "bg-danger-soft text-danger",
                      on && "ring-2 ring-offset-1 " + (q.correct ? "ring-success" : "ring-danger"),
                    )}
                  >
                    {q.position}
                  </button>
                </li>
              );
            })}
          </ol>

          {item && (
            <div
              className={cx(
                "mt-4 rounded-xl border px-4 py-3.5",
                item.correct ? "border-green-200 bg-[#f3faf5]" : "border-red-200 bg-[#fef5f5]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13.5px] font-semibold text-ink">
                  Q{item.position} · {item.prompt}
                </p>
                <span
                  className={cx(
                    "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[12px] font-semibold",
                    item.correct ? "bg-[#e8f5ec] text-success" : "bg-danger-soft text-danger",
                  )}
                >
                  {item.correct ? <CheckIcon size={12} strokeWidth={3} /> : <XIcon size={12} strokeWidth={3} />}
                  {item.earned} / {item.points}
                </span>
              </div>
              <p className="mt-2 text-[13px] text-muted">
                Your answer: <span className="font-semibold text-ink">{answerText(item.type, item.options, item.yourAnswer)}</span>
              </p>
              <p className="mt-1 text-[13px] text-muted">
                Correct: <span className="font-semibold text-ink">{answerText(item.type, item.options, item.correctAnswer)}</span>
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Missing({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <ErrorNote>{message ?? "We couldn't find this result."}</ErrorNote>
      <Link to="/tests" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold hover:bg-zinc-50">
        Back to tests
      </Link>
    </div>
  );
}
