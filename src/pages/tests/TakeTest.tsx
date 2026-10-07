import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { AnswerValue, AttemptInProgress, AttemptResult, StudentQuestion, StudentTestItem } from "@shared/contract";
import { api, ApiRequestError } from "@/lib/api";
import { Button, cx, ErrorNote, Logo, PageLoader } from "@/components/ui";
import { RequireStudent } from "@/components/student/RequireStudent";
import { useDocumentTitle } from "@/components/student/useDocumentTitle";
import { studentTestsKey } from "@/components/student/queries";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ClockIcon, XIcon } from "@/components/student/icons";
import { POLICY_SENTENCE, TYPE_HINT, clock, isAnswered, unanswered } from "@/components/student/testHelpers";

/**
 * Figma "Tests – Taking a test" (Desktop 1440 / Tablet 834 / Phone 390). Full-screen: no student nav.
 *
 * Rules (docs/plan/02_REQUIREMENTS.md TEST-2…TEST-4, NFR-6):
 *  - POST /api/attempts starts the attempt or resumes the one in progress (answers are restored).
 *  - The countdown uses the SERVER clock: offset = serverNow − Date.now() once, then deadlineAt − (now + offset).
 *  - Answers autosave ~0.8 s after a change (PUT …/answers with only the changed questions).
 *  - Time up → the server submits the saved answers; we fetch the attempt and show the result.
 */
export default function TakeTest() {
  return (
    <RequireStudent>
      <TakeTestPage />
    </RequireStudent>
  );
}

type SaveState = "saved" | "saving" | "pending" | "offline";

function TakeTestPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = Number(assignmentId);

  const [attempt, setAttempt] = useState<AttemptInProgress | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [item, setItem] = useState<StudentTestItem | null>(null);
  useDocumentTitle(attempt?.title ?? "Test");

  // Start or resume once (StrictMode mounts twice in dev — the server also de-duplicates).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!Number.isSafeInteger(id) || id <= 0) {
      setStartError("This test link is not valid.");
      return;
    }
    api
      .post<AttemptInProgress>("/attempts", { assignmentId: id })
      .then((a) => {
        setAttempt(a);
        void queryClient.invalidateQueries({ queryKey: studentTestsKey });
      })
      .catch((err: unknown) => setStartError(err instanceof Error ? err.message : "Couldn't start the test."));
    // Score policy for the header line ("counts highest score") comes from the list item.
    api
      .get<StudentTestItem[]>("/me/tests")
      .then((list) => setItem(list.find((t) => t.assignmentId === id) ?? null))
      .catch(() => undefined);
  }, [id, queryClient]);

  if (startError) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg px-4 py-16">
          <ErrorNote>{startError}</ErrorNote>
          <Link to="/tests" className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold hover:bg-zinc-50">
            <ArrowLeftIcon size={16} /> Back to tests
          </Link>
        </div>
      </Shell>
    );
  }
  if (!attempt) {
    return (
      <Shell>
        <PageLoader />
      </Shell>
    );
  }
  return (
    <Runner
      key={attempt.attemptId}
      attempt={attempt}
      item={item}
      onFinished={(result) => {
        void queryClient.invalidateQueries({ queryKey: ["me"] });
        navigate(`/tests/result/${result.attemptId}`, { replace: true });
      }}
    />
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-app">{children}</div>;
}

/* ───────────────────────── runner ───────────────────────── */

function Runner({
  attempt,
  item,
  onFinished,
}: {
  attempt: AttemptInProgress;
  item: StudentTestItem | null;
  onFinished: (r: AttemptResult) => void;
}) {
  const questions = attempt.questions;
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => ({ ...attempt.answers }));
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState<null | "timeout">(null);

  const dirty = useRef(new Set<string>());
  const inFlight = useRef<Promise<void> | null>(null);
  const done = useRef(false);
  const debounce = useRef<number | undefined>(undefined);
  const retry = useRef<number | undefined>(undefined);

  /* ── finishing: fetch the (server-submitted) result ── */
  // The server accepts saves/submits for 30 s after the deadline (DEADLINE_GRACE_MS) and finalises the attempt
  // on the next GET after that — so first try a normal submit, then poll until it reports "submitted".
  const fetchResult = useCallback(async () => {
    try {
      const r = await api.post<AttemptResult>(`/attempts/${attempt.attemptId}/submit`);
      done.current = true;
      onFinished(r);
      return;
    } catch {
      /* required questions left blank (400) or offline — wait for the server to auto-submit */
    }
    const until = Date.now() + 75_000;
    while (Date.now() < until) {
      try {
        const r = await api.get<AttemptInProgress | AttemptResult>(`/attempts/${attempt.attemptId}`);
        if (r.status === "submitted") {
          done.current = true;
          onFinished(r);
          return;
        }
      } catch {
        /* offline — retry below */
      }
      await new Promise((res) => setTimeout(res, 3000));
    }
    setSubmitError("Couldn't reach the server. Your saved answers are safe — reload the page to see your result.");
  }, [attempt.attemptId, onFinished]);

  /* ── autosave ── */
  const flush = useCallback(async (): Promise<void> => {
    if (inFlight.current) await inFlight.current;
    if (done.current || dirty.current.size === 0) return;
    const keys = [...dirty.current];
    const sent: Record<string, AnswerValue> = {};
    for (const k of keys) {
      const v = answersRef.current[k];
      // A cleared short answer is sent as "" so the server forgets it.
      sent[k] = v === undefined ? "" : v;
    }
    setSaveState("saving");
    const p = (async () => {
      try {
        const r = await api.put<{ savedAt: string }>(`/attempts/${attempt.attemptId}/answers`, { answers: sent });
        for (const k of keys) if (answersRef.current[k] === sent[k] || (answersRef.current[k] === undefined && sent[k] === "")) dirty.current.delete(k);
        setSavedAt(Date.parse(r.savedAt) || Date.now());
        setSaveState(dirty.current.size > 0 ? "pending" : "saved");
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 409) {
          // Already submitted / time is up on the server → show the result.
          done.current = true;
          setFinishing("timeout");
          void fetchResult();
          return;
        }
        if (err instanceof ApiRequestError && err.status === 400) {
          // Shouldn't happen (inputs are constrained) — drop the bad keys so the rest keeps saving.
          for (const k of keys) dirty.current.delete(k);
          setSaveState("saved");
          return;
        }
        setSaveState("offline");
        window.clearTimeout(retry.current);
        retry.current = window.setTimeout(() => void flush(), 4000);
      }
    })();
    inFlight.current = p;
    await p;
    inFlight.current = null;
  }, [attempt.attemptId, fetchResult]);

  const setAnswer = (q: StudentQuestion, value: AnswerValue | undefined) => {
    if (done.current) return;
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[String(q.id)];
      else next[String(q.id)] = value;
      return next;
    });
    dirty.current.add(String(q.id));
    setSaveState("pending");
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => void flush(), 800);
  };

  // Warn before leaving while answers are not saved yet.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!done.current && dirty.current.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearTimeout(debounce.current);
      window.clearTimeout(retry.current);
    };
  }, []);

  /* ── server-synced countdown ── */
  const offset = useMemo(() => Date.parse(attempt.serverNow) - Date.now(), [attempt.serverNow]);
  const deadline = attempt.deadlineAt ? Date.parse(attempt.deadlineAt) : null;
  const [now, setNow] = useState(() => Date.now());
  const remaining = deadline === null ? null : deadline - (now + offset);

  // Time up: flush what's left, then let the server submit (GET /attempts/:id finalises an expired attempt).
  const timedOut = useRef(false);
  const onTimeout = useRef<() => void>(() => undefined);
  onTimeout.current = () => {
    if (timedOut.current || done.current) return;
    timedOut.current = true;
    setFinishing("timeout");
    setReviewOpen(false);
    setJumpOpen(false);
    void (async () => {
      try {
        await flush();
      } catch {
        /* the server keeps whatever was saved */
      }
      done.current = true;
      await fetchResult();
    })();
  };

  // The check runs inside the tick (not in an effect) so it also fires when the tab was in the background.
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (deadline - (n + offset) <= 0) onTimeout.current();
    };
    tick();
    const t = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [deadline, offset]);

  /* ── submit ── */
  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      window.clearTimeout(debounce.current);
      await flush();
      if (dirty.current.size > 0) throw new Error("Some answers haven't been saved yet. Check your connection and try again.");
      const r = await api.post<AttemptResult>(`/attempts/${attempt.attemptId}/submit`);
      done.current = true;
      onFinished(r);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't submit. Please try again.");
      setSubmitting(false);
    }
  };

  const q = questions[index];
  const total = questions.length;
  const answeredCount = questions.filter((x) => isAnswered(answers[String(x.id)])).length;
  const missing = unanswered(questions, answers);
  const isLast = index === total - 1;
  const lowTime = remaining !== null && remaining <= 60_000;
  const subtitle = `Attempt ${attempt.attemptNumber} of ${attempt.maxAttempts ?? "∞"}${item && attempt.maxAttempts !== 1 ? ` · ${POLICY_SENTENCE[item.scorePolicy]}` : ""}`;

  const goTo = (i: number) => {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    setJumpOpen(false);
    window.scrollTo({ top: 0 });
  };

  if (total === 0) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg px-4 py-16">
          <ErrorNote>This test has no questions yet. Please tell your instructor.</ErrorNote>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:h-[72px] md:px-10 lg:px-20">
          <span className="hidden md:inline-flex">
            <Logo size={31} withText={false} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[14px] font-semibold leading-5 text-ink md:text-[15px]">{attempt.title}</h1>
            <p className="hidden truncate text-[12px] leading-4 text-muted md:block">{subtitle}</p>
            <SaveStatus state={saveState} savedAt={savedAt} className="md:hidden" />
          </div>
          <SaveStatus state={saveState} savedAt={savedAt} className="hidden md:flex" />
          {remaining !== null && (
            <span
              role="timer"
              aria-label={`Time left ${clock(remaining)}`}
              className={cx(
                "inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[17px] font-bold tabular-nums md:h-[43px] md:px-3.5 md:text-[18px]",
                lowTime ? "bg-danger-soft text-danger" : "bg-tests-soft text-tests",
              )}
            >
              <ClockIcon size={17} />
              {clock(remaining)}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1000px] px-4 pb-40 pt-[22px] md:px-10 md:pb-16 md:pt-[26px] lg:grid lg:grid-cols-[minmax(0,1fr)_268px] lg:gap-6 lg:px-0 lg:pt-[29px]">
        <div className="min-w-0">
          {/* Progress */}
          <div className="flex items-center justify-between text-[12px] text-muted md:text-[13px]">
            <span>
              Question {index + 1} of {total}
            </span>
            <span>
              {q.points} {q.points === 1 ? "point" : "points"}
              {q.required ? " · required" : ""}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200" aria-hidden="true">
            <div className="h-full rounded-full bg-tests transition-[width]" style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>

          {/* Question */}
          <section aria-labelledby={`q-${q.id}`} className="mt-4 md:mt-[15px] md:rounded-[20px] md:border md:border-line md:bg-surface md:p-[19px] lg:p-[21px]">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-tests">{TYPE_HINT[q.type]}</p>
            <h2 id={`q-${q.id}`} className="mt-2 text-[21px] font-bold leading-[29px] text-ink md:text-[18px] md:leading-6 lg:text-[19px]">
              {q.prompt}
              {q.required && (
                <span className="text-danger" aria-label="required">
                  {" "}*
                </span>
              )}
            </h2>
            {q.imageUrl && (
              <img src={q.imageUrl} alt="" loading="lazy" className="mt-3 max-h-72 w-auto max-w-full rounded-xl border border-line object-contain" />
            )}
            <div className="mt-4 md:mt-[15px]">
              <QuestionInput q={q} value={answers[String(q.id)]} onChange={(v) => setAnswer(q, v)} disabled={!!finishing} />
            </div>
          </section>

          {/* Prev / Next (tablet + desktop) */}
          <div className="mt-[15px] hidden items-center justify-between md:flex">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="inline-flex h-[43px] items-center gap-1.5 rounded-xl border border-line bg-surface px-[25px] text-[14px] font-semibold text-ink hover:bg-zinc-50 disabled:opacity-40"
            >
              <ArrowLeftIcon size={15} /> Previous
            </button>
            <button
              type="button"
              onClick={() => (isLast ? setReviewOpen(true) : goTo(index + 1))}
              className="inline-flex h-[43px] items-center gap-1.5 rounded-xl bg-tests px-9 text-[14px] font-semibold text-white hover:bg-blue-700"
            >
              {isLast ? "Review & submit" : "Next"} <ArrowRightIcon size={15} />
            </button>
          </div>

          {/* Navigator + submit (tablet: below the question) */}
          <div className="mt-[15px] hidden space-y-[15px] md:block lg:hidden">
            <Navigator questions={questions} answers={answers} index={index} onPick={goTo} />
            <SubmitCard onSubmit={() => setReviewOpen(true)} answered={answeredCount} total={total} row />
          </div>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden space-y-[15px] lg:block">
          <Navigator questions={questions} answers={answers} index={index} onPick={goTo} />
          <SubmitCard onSubmit={() => setReviewOpen(true)} answered={answeredCount} total={total} />
        </aside>
      </main>

      {/* Phone bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-app/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="inline-flex h-[46px] items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink disabled:opacity-40"
          >
            <ArrowLeftIcon size={16} /> Prev
          </button>
          <button
            type="button"
            onClick={() => (isLast ? setReviewOpen(true) : goTo(index + 1))}
            className="inline-flex h-[46px] items-center justify-center gap-1.5 rounded-xl bg-tests text-[15px] font-semibold text-white"
          >
            {isLast ? "Submit" : "Next"} <ArrowRightIcon size={16} />
          </button>
        </div>
        <button type="button" onClick={() => setJumpOpen(true)} className="mt-2 w-full text-center text-[12px] text-muted underline-offset-2 hover:underline">
          Tap {index + 1}/{total} to jump between questions
        </button>
      </div>

      {/* Phone: jump sheet */}
      {jumpOpen && (
        <Sheet title="Questions" onClose={() => setJumpOpen(false)}>
          <Navigator questions={questions} answers={answers} index={index} onPick={goTo} bare />
          <Button accent="ink" size="lg" block className="mt-4" onClick={() => { setJumpOpen(false); setReviewOpen(true); }}>
            Submit test
          </Button>
        </Sheet>
      )}

      {/* Review & submit */}
      {reviewOpen && (
        <Sheet title="Submit your test?" onClose={() => !submitting && setReviewOpen(false)}>
          <p className="text-[14px] text-ink">
            You answered <b>{answeredCount}</b> of <b>{total}</b> questions.
          </p>
          {missing.required.length > 0 && (
            <p className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] text-red-800">
              Answer the required questions first: <b>{missing.required.join(", ")}</b>
            </p>
          )}
          {missing.required.length === 0 && missing.optional.length > 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
              Not answered yet: <b>{missing.optional.join(", ")}</b> — you can still submit.
            </p>
          )}
          <p className="mt-3 text-[13px] text-muted">After you submit you can't change your answers{attempt.maxAttempts === 1 ? "" : " for this attempt"}.</p>
          {submitError && (
            <div className="mt-3">
              <ErrorNote>{submitError}</ErrorNote>
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {missing.required.length > 0 ? (
              <Button
                accent="tests"
                size="lg"
                onClick={() => {
                  setReviewOpen(false);
                  goTo(questions.findIndex((x) => x.position === missing.required[0]));
                }}
              >
                Go to question {missing.required[0]}
              </Button>
            ) : (
              <>
                <Button variant="outline" size="lg" onClick={() => setReviewOpen(false)} disabled={submitting}>
                  Keep working
                </Button>
                <Button accent="ink" size="lg" onClick={() => void submit()} loading={submitting}>
                  Submit test
                </Button>
              </>
            )}
          </div>
        </Sheet>
      )}

      {/* Time up */}
      {finishing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 px-4" role="alertdialog" aria-modal="true" aria-labelledby="timeup-title">
          <div className="w-full max-w-sm rounded-[20px] bg-surface p-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-tests-soft text-tests">
              <ClockIcon size={26} />
            </span>
            <h2 id="timeup-title" className="mt-4 text-[19px] font-bold">
              Time's up
            </h2>
            <p className="mt-1.5 text-[14px] text-muted">Your saved answers are being submitted… this can take up to 30 seconds.</p>
            {submitError ? (
              <div className="mt-4 text-left">
                <ErrorNote>{submitError}</ErrorNote>
              </div>
            ) : (
              <div className="mt-4 flex justify-center text-tests">
                <span className="size-6 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function SaveStatus({ state, savedAt, className }: { state: SaveState; savedAt: number | null; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, []);
  const ago = savedAt === null ? null : Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  const agoText = ago === null ? "" : ago < 5 ? " · just now" : ago < 60 ? ` · ${ago}s ago` : ` · ${Math.round(ago / 60)} min ago`;
  return (
    <p className={cx("items-center gap-1 text-[12px] font-medium md:text-[13px]", className)} aria-live="polite">
      {state === "saved" && (
        <span className="inline-flex items-center gap-1 text-success">
          <CheckIcon size={13} /> Saved{agoText}
        </span>
      )}
      {(state === "saving" || state === "pending") && <span className="text-muted">Saving…</span>}
      {state === "offline" && <span className="text-amber-700">Offline — will retry</span>}
    </p>
  );
}

function QuestionInput({
  q,
  value,
  onChange,
  disabled,
}: {
  q: StudentQuestion;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue | undefined) => void;
  disabled: boolean;
}) {
  if (q.type === "short") {
    return (
      <div>
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
          maxLength={500}
          rows={3}
          disabled={disabled}
          aria-labelledby={`q-${q.id}`}
          placeholder="Type your answer"
          className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-[15px] outline-none placeholder:text-faint focus:border-tests"
        />
        <p className="mt-1 text-right text-[11px] text-faint">{typeof value === "string" ? value.length : 0}/500</p>
      </div>
    );
  }

  const multi = q.type === "multi";
  const options = q.type === "truefalse" ? [{ id: "true", text: "True" }, { id: "false", text: "False" }] : q.options;
  const selected = (id: string) => {
    if (q.type === "truefalse") return typeof value === "boolean" && String(value) === id;
    if (multi) return Array.isArray(value) && value.includes(id);
    return value === id;
  };
  const pick = (id: string) => {
    if (q.type === "truefalse") return onChange(id === "true");
    if (multi) {
      const cur = Array.isArray(value) ? value : [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return onChange(next.length ? next : undefined);
    }
    onChange(id);
  };

  return (
    <div role={multi ? "group" : "radiogroup"} aria-labelledby={`q-${q.id}`} className="space-y-2.5 md:space-y-[9px]">
      {options.map((o) => {
        const on = selected(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            disabled={disabled}
            onClick={() => pick(o.id)}
            className={cx(
              "flex min-h-[50px] w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-[15px] transition-colors md:min-h-[42px] md:text-[14px] lg:min-h-[44px]",
              on ? "border-tests bg-blue-50 font-semibold text-ink ring-1 ring-tests" : "border-line bg-surface text-ink hover:bg-zinc-50",
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "grid size-[19px] shrink-0 place-items-center border-[1.5px]",
                multi ? "rounded-[5px]" : "rounded-full",
                on ? "border-tests bg-tests text-white" : "border-zinc-300 bg-surface",
              )}
            >
              {on && (multi ? <CheckIcon size={13} strokeWidth={3} /> : <span className="size-2 rounded-full bg-white" />)}
            </span>
            <span className="min-w-0 flex-1">{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function Navigator({
  questions,
  answers,
  index,
  onPick,
  bare,
}: {
  questions: StudentQuestion[];
  answers: Record<string, AnswerValue>;
  index: number;
  onPick: (i: number) => void;
  bare?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">Questions</p>
        <p className="flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-tests-soft" /> Answered
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm border border-line bg-surface" /> Not yet
          </span>
        </p>
      </div>
      <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-2 md:flex md:flex-wrap lg:grid lg:grid-cols-5">
        {questions.map((q, i) => {
          const current = i === index;
          const answered = isAnswered(answers[String(q.id)]);
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-current={current ? "step" : undefined}
                aria-label={`Question ${i + 1}${answered ? ", answered" : ", not answered"}${q.required ? ", required" : ""}`}
                className={cx(
                  "grid h-9 w-full min-w-9 place-items-center rounded-lg text-[13px] font-semibold transition-colors md:w-9",
                  current ? "bg-tests text-white" : answered ? "bg-tests-soft text-tests" : "border border-line bg-surface text-ink hover:bg-zinc-50",
                )}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
  if (bare) return body;
  return <div className="rounded-[20px] border border-line bg-surface p-[15px]">{body}</div>;
}

function SubmitCard({ onSubmit, answered, total, row }: { onSubmit: () => void; answered: number; total: number; row?: boolean }) {
  return (
    <div className={cx("rounded-[20px] border border-line bg-surface p-[15px]", row && "flex items-center justify-between gap-4")}>
      <p className="text-[12.5px] leading-[18px] text-muted">
        Time is kept by the server. When it runs out, your saved answers are submitted automatically.
        <span className="mt-1 block font-medium text-ink">
          {answered} / {total} answered
        </span>
      </p>
      <button
        type="button"
        onClick={onSubmit}
        className={cx("inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#18181b] px-6 text-[14px] font-semibold text-white hover:bg-zinc-700", !row && "mt-3 w-full")}
      >
        Submit test
      </button>
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/40 md:items-center md:px-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-[24px] bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))] outline-none md:max-w-md md:rounded-[20px] md:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-muted hover:bg-zinc-100" aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
