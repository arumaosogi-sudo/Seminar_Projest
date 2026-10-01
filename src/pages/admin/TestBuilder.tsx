import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveTestBody, type AdminTestDetail, type AdminTestSaveResult, type QuestionType, type TestKind } from "@shared/contract";
import { api } from "@/lib/api";
import { Badge, Button, Card, cx, DraftBadge, EmptyState, ErrorNote, Input, PageLoader, Select } from "@/components/ui";
import {
  TYPE_LABEL,
  blankQuestion,
  changeType,
  draftFromServer,
  duplicateQuestion,
  maxScoreOf,
  nextOptionId,
  toSaveBody,
  MAX_QUESTIONS,
  validateDraft,
  type DraftQuestion,
  type DraftTest,
} from "@/components/admin/builder";
import { QueryError, Segmented, Switch } from "@/components/admin/controls";
import { errorMessage, formatDateTime, isApiStatus, kindLabel } from "@/components/admin/format";
import { IconCheck, IconClose, IconDrag, IconDuplicate, IconEye, IconInfo, IconPlus, IconTrash, IconUpload } from "@/components/admin/icons";
import { adminKeys } from "@/components/admin/keys";
import { ConfirmDialog, Modal } from "@/components/admin/Modal";
import { useToast } from "@/components/admin/toastContext";

const AUTOSAVE_MS = 1500;

export default function TestBuilder() {
  const params = useParams();
  const id = Number(params.testId);
  const valid = Number.isInteger(id) && id > 0;
  const q = useQuery({
    queryKey: adminKeys.test(id),
    queryFn: () => api.get<AdminTestDetail>(`/admin/tests/${id}`),
    enabled: valid,
    // Always refetch when the builder opens: versionLocked / questions may have changed since the cache was filled.
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
  // The draft is initialised once, so wait for data fetched after this mount (never seed it from stale cache).
  const [mountedAt] = useState(() => Date.now());
  const fresh = q.dataUpdatedAt >= mountedAt;

  if (!valid || isApiStatus(q.error, 404))
    return (
      <EmptyState title="Test not found" action={<Link to="/admin/tests" className="font-semibold underline">Back to tests</Link>}>
        It may have been deleted.
      </EmptyState>
    );
  if (q.isError) return <QueryError error={q.error} onRetry={() => void q.refetch()} what="the test" />;
  if (q.isPending || !fresh) return <PageLoader />;
  return <Builder key={id} testId={id} initial={q.data} />;
}

type Tab = "questions" | "settings" | "versions";

function Builder({ testId, initial }: { testId: number; initial: AdminTestDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<DraftTest>(() => draftFromServer(initial));
  const [server, setServer] = useState<AdminTestDetail>(initial);
  const [tab, setTab] = useState<Tab>("questions");
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Revision counters: rev increments on every edit; savedRev = last revision persisted.
  const [rev, setRev] = useState(0);
  const [savedRev, setSavedRev] = useState(0);
  const revRef = useRef(0);
  const savedRevRef = useRef(0);
  const draftRef = useRef(draft);
  const inFlight = useRef<Promise<boolean> | null>(null);
  /** Question ids that belong to the test on the server right now (see toSaveBody). */
  const serverIds = useRef<ReadonlySet<number>>(new Set(initial.questions.map((x) => x.id)));
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const dirty = rev !== savedRev;
  const validation = useMemo(() => validateDraft(draft), [draft]);
  const locked = server.versionLocked;

  const update = useCallback((fn: (d: DraftTest) => DraftTest) => {
    setDraft(fn);
    setSaveError(null);
    revRef.current += 1;
    setRev(revRef.current);
  }, []);

  const updateQuestion = useCallback(
    (key: string, fn: (q: DraftQuestion) => DraftQuestion) => update((d) => ({ ...d, questions: d.questions.map((q) => (q.key === key ? fn(q) : q)) })),
    [update],
  );

  /** Persist the current draft. Serialised: waits for a running save, then saves again if still dirty. */
  const save = useCallback(
    async (manual: boolean): Promise<boolean> => {
      while (inFlight.current) await inFlight.current;
      if (revRef.current === savedRevRef.current) return true;
      const d = draftRef.current;
      const r = revRef.current;
      const v = validateDraft(d);
      if (v.count > 0) {
        if (manual) {
          setShowErrors(true);
          setTab(v.title && Object.keys(v.byQuestion).length === 0 ? "settings" : "questions");
          toast.show(`Fix ${v.count} issue${v.count === 1 ? "" : "s"} before saving.`, "error");
        }
        return false;
      }
      const body = saveTestBody.safeParse(toSaveBody(d, serverIds.current));
      if (!body.success) {
        const issue = body.error.issues[0];
        const msg = `Can’t save: ${issue ? `${issue.path.join(".")} — ${issue.message}` : "the test has invalid fields."}`;
        setSaveError(msg); // always visible in the header status, also for autosave
        if (manual) toast.show(msg, "error");
        return false;
      }
      const run = (async () => {
        setSaving(true);
        setSaveError(null);
        try {
          const res = await api.put<AdminTestSaveResult>(`/admin/tests/${testId}`, body.data);
          const serverQs = [...res.test.questions].sort((a, b) => a.position - b.position);
          const idByKey = new Map(d.questions.map((q, i) => [q.key, serverQs[i]?.id]));
          setDraft((cur) => ({ ...cur, questions: cur.questions.map((q) => (idByKey.get(q.key) ? { ...q, id: idByKey.get(q.key) } : q)) }));
          serverIds.current = new Set(res.test.questions.map((x) => x.id));
          setServer(res.test);
          qc.setQueryData(adminKeys.test(testId), res.test);
          void qc.invalidateQueries({ queryKey: adminKeys.tests });
          savedRevRef.current = Math.max(savedRevRef.current, r);
          setSavedRev(savedRevRef.current);
          if (res.newVersionCreated)
            toast.show(`Saved as version ${res.test.currentVersion}. Earlier attempts keep version ${res.test.currentVersion - 1}.`, "success");
          return true;
        } catch (e) {
          setSaveError(`Couldn’t save: ${errorMessage(e)}`);
          if (manual) toast.show(errorMessage(e, "Couldn’t save."), "error");
          return false;
        } finally {
          setSaving(false);
        }
      })();
      inFlight.current = run;
      const ok = await run;
      inFlight.current = null;
      return ok;
    },
    [qc, testId, toast],
  );

  // Debounced autosave — paused while the version is locked (each save would create a new version).
  useEffect(() => {
    if (!dirty || locked || validation.count > 0 || saveError) return;
    const t = setTimeout(() => void save(false), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [rev, dirty, locked, validation.count, saveError, save]);

  const flushOnBlur = () => {
    if (dirty && !locked && validation.count === 0) void save(false);
  };

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);
  // Read refs (not state) so a navigate() right after a successful save isn't blocked by a stale render.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => revRef.current !== savedRevRef.current && currentLocation.pathname !== nextLocation.pathname);

  // Focus the prompt of a newly added question.
  useEffect(() => {
    if (!focusKey) return;
    const el = document.getElementById(`prompt-${focusKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
    setFocusKey(null);
  }, [focusKey]);

  const atMax = draft.questions.length >= MAX_QUESTIONS;
  const addQuestion = (type: QuestionType = "single") => {
    if (draftRef.current.questions.length >= MAX_QUESTIONS) {
      toast.show(`A test can have at most ${MAX_QUESTIONS} questions.`, "error");
      return;
    }
    const q = blankQuestion(type);
    update((d) => ({ ...d, questions: [...d.questions, q] }));
    setTab("questions");
    setFocusKey(q.key);
  };

  const removeQuestion = (key: string) => {
    const index = draft.questions.findIndex((q) => q.key === key);
    const removed = draft.questions[index];
    if (!removed) return;
    update((d) => ({ ...d, questions: d.questions.filter((q) => q.key !== key) }));
    toast.show(
      <span className="flex items-center justify-between gap-3">
        Question {index + 1} deleted
        <button
          type="button"
          className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold hover:bg-white/25"
          onClick={() =>
            update((d) => {
              if (d.questions.some((q) => q.key === removed.key)) return d;
              const qs = [...d.questions];
              qs.splice(Math.min(index, qs.length), 0, removed);
              return { ...d, questions: qs };
            })
          }
        >
          Undo
        </button>
      </span>,
    );
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    update((d) => {
      const from = d.questions.findIndex((q) => q.key === active.id);
      const to = d.questions.findIndex((q) => q.key === over.id);
      if (from < 0 || to < 0) return d;
      return { ...d, questions: arrayMove(d.questions, from, to) };
    });
  };

  const onAssign = async () => {
    if (dirty) {
      const ok = await save(true);
      if (!ok) return;
    }
    navigate(`/admin/tests/${testId}/assign`);
  };

  const maxScore = maxScoreOf(draft);
  const statusNode = saving ? (
    <span className="text-muted">Saving…</span>
  ) : saveError ? (
    <span className="text-danger">
      {saveError}{" "}
      <button type="button" className="font-semibold underline" onClick={() => void save(true)}>
        Retry
      </button>
    </span>
  ) : !dirty ? (
    <span className="text-success">✓ Saved</span>
  ) : validation.count > 0 ? (
    <span className="text-amber-700">
      Unsaved changes ·{" "}
      <button type="button" className="font-semibold underline" onClick={() => setShowErrors(true)}>
        {validation.count} issue{validation.count === 1 ? "" : "s"} to fix
      </button>
    </span>
  ) : (
    <span className="text-muted">Unsaved changes{locked ? " · autosave paused" : ""}</span>
  );

  return (
    <div onBlur={flushOnBlur}>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link to="/admin/tests" className="text-sm font-semibold text-muted hover:text-ink">
            ← Tests
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <input
              aria-label="Test title"
              value={draft.title}
              maxLength={200}
              onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
              placeholder="Untitled test"
              className={cx(
                "min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-3xl font-bold tracking-tight outline-none hover:border-line focus:border-ink",
                showErrors && validation.title && "border-danger",
              )}
            />
            <DraftBadge />
          </div>
          <p className="mt-1 px-1 text-sm text-muted">
            {kindLabel[draft.kind]} · {draft.questions.length} question{draft.questions.length === 1 ? "" : "s"} · {maxScore} point{maxScore === 1 ? "" : "s"} · v{server.currentVersion}
            <span className="mx-2 text-faint">|</span>
            <span aria-live="polite">{statusNode}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <IconEye size={16} /> Preview
          </Button>
          <Button variant="outline" onClick={() => void save(true)} loading={saving} disabled={!dirty && !saveError}>
            Save
          </Button>
          <Button accent="tests" onClick={() => void onAssign()}>
            Assign to sections
          </Button>
        </div>
      </div>

      {showErrors && validation.general.length > 0 && (
        <div className="mb-5">
          <ErrorNote>{validation.general.join(" ")}</ErrorNote>
        </div>
      )}

      {locked && (
        <div className="mb-5 flex gap-3 rounded-2xl border border-violet-200 bg-games-soft px-4 py-3 text-sm text-games-ink" role="note">
          <IconInfo className="mt-0.5 shrink-0" />
          <p>
            Students already started version {server.currentVersion}. Saving creates version {server.currentVersion + 1} — earlier attempts keep their original questions and
            scores. Autosave is paused; use <strong>Save</strong> when you’re done.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label="Builder sections" className="mb-5 flex gap-1 border-b border-line">
        {(["questions", "settings", "versions"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              const order: Tab[] = ["questions", "settings", "versions"];
              const i = order.indexOf(tab);
              if (e.key === "ArrowRight") setTab(order[(i + 1) % 3]);
              if (e.key === "ArrowLeft") setTab(order[(i + 2) % 3]);
            }}
            className={cx("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold capitalize", tab === t ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t}
            {t === "versions" && <span className="ml-1.5 text-xs text-muted">({server.versions.length})</span>}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <div role="tabpanel" id="panel-questions" aria-labelledby="tab-questions" className="flex gap-4">
          <div className="min-w-0 flex-1 space-y-4">
            <Card className="border-t-4 border-t-ink p-6">
              <label className="sr-only" htmlFor="builder-title">
                Title
              </label>
              <input
                id="builder-title"
                value={draft.title}
                maxLength={200}
                onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
                placeholder="Test title"
                className="w-full border-b border-transparent bg-transparent pb-1 text-2xl font-bold outline-none focus:border-ink"
              />
              {showErrors && validation.title && <p className="mt-1 text-xs text-danger">{validation.title}</p>}
              <label className="sr-only" htmlFor="builder-desc">
                Description
              </label>
              <textarea
                id="builder-desc"
                value={draft.description}
                maxLength={2000}
                onChange={(e) => update((d) => ({ ...d, description: e.target.value }))}
                placeholder="Description (shown to students before they start)"
                rows={2}
                className="mt-3 w-full resize-y border-b border-transparent bg-transparent text-sm text-zinc-700 outline-none focus:border-ink"
              />
            </Card>

            {draft.questions.length === 0 ? (
              <EmptyState title="No questions yet" action={<Button onClick={() => addQuestion()} disabled={atMax}>+ Add question</Button>}>
                Add multiple-choice, checkbox, true/false or short-answer questions.
              </EmptyState>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={draft.questions.map((q) => q.key)} strategy={verticalListSortingStrategy}>
                  {draft.questions.map((q, i) => (
                    <QuestionCard
                      key={q.key}
                      q={q}
                      index={i}
                      errors={showErrors ? validation.byQuestion[q.key] : undefined}
                      onChange={(fn) => updateQuestion(q.key, fn)}
                      onDuplicate={() =>
                        update((d) => {
                          if (d.questions.length >= MAX_QUESTIONS) return d;
                          const qs = [...d.questions];
                          const idx = qs.findIndex((x) => x.key === q.key);
                          qs.splice(idx + 1, 0, duplicateQuestion(q));
                          return { ...d, questions: qs };
                        })
                      }
                      onDelete={() => removeQuestion(q.key)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}

            <div className="flex justify-center lg:hidden">
              <Button variant="outline" onClick={() => addQuestion()} disabled={atMax}>
                <IconPlus size={16} /> Add question
              </Button>
            </div>
          </div>

          {/* Floating toolbar */}
          <div className="hidden w-12 shrink-0 lg:block">
            <div className="sticky top-6 flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-sm" role="toolbar" aria-label="Question tools" aria-orientation="vertical">
              <button
                type="button"
                onClick={() => addQuestion()}
                disabled={atMax}
                className="rounded-xl p-2 text-ink hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Add question"
                title={atMax ? `Maximum ${MAX_QUESTIONS} questions` : "Add question"}
              >
                <IconPlus />
              </button>
              <button type="button" disabled className="cursor-not-allowed rounded-xl p-2 text-faint" aria-label="Import CSV (coming soon)" title="Import CSV — coming soon">
                <IconUpload />
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div role="tabpanel" id="panel-settings" aria-labelledby="tab-settings">
          <Card className="max-w-2xl space-y-5 p-6">
            <Input
              name="settings-title"
              label="Title"
              value={draft.title}
              maxLength={200}
              onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
              error={showErrors ? validation.title : undefined}
            />
            <label className="block" htmlFor="settings-desc">
              <span className="mb-1.5 block text-sm font-semibold">Description</span>
              <textarea
                id="settings-desc"
                value={draft.description}
                maxLength={2000}
                rows={4}
                onChange={(e) => update((d) => ({ ...d, description: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-ink"
              />
            </label>
            <Select name="settings-kind" label="Kind" value={draft.kind} onChange={(e) => update((d) => ({ ...d, kind: e.target.value as TestKind }))}>
              <option value="pretest">Pretest</option>
              <option value="posttest">Posttest</option>
              <option value="other">Other</option>
            </Select>
            <p className="text-xs text-muted">Results compare one pretest with one posttest. Timing, attempts and availability are set per section when you assign the test.</p>
          </Card>
        </div>
      )}

      {tab === "versions" && (
        <div role="tabpanel" id="panel-versions" aria-labelledby="tab-versions">
          <Card className="max-w-2xl overflow-hidden">
            {server.versions.length === 0 ? (
              <p className="p-6 text-sm text-muted">No frozen versions yet. A version is frozen the first time a student starts the test.</p>
            ) : (
              <ul>
                {[...server.versions]
                  .sort((a, b) => b.versionNo - a.versionNo)
                  .map((v) => (
                    <li key={v.versionNo} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 last:border-b-0">
                      <div>
                        <p className="font-semibold">
                          Version {v.versionNo} {v.versionNo === server.currentVersion && <Badge tone="tests" className="ml-1.5">Current</Badge>}
                        </p>
                        <p className="text-xs text-muted">Frozen {formatDateTime(v.createdAt)}</p>
                      </div>
                      <p className="text-sm tabular-nums text-muted">
                        {v.attemptCount} attempt{v.attemptCount === 1 ? "" : "s"}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} draft={draft} />

      <ConfirmDialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Leave without saving?"
        confirmLabel="Leave anyway"
        cancelLabel="Stay"
        accent="danger"
      >
        <p>{validation.count > 0 ? `You have unsaved changes with ${validation.count} issue(s) to fix.` : "You have unsaved changes."} They’ll be lost if you leave now.</p>
      </ConfirmDialog>
    </div>
  );
}

/* ───────────────────────── Question card ───────────────────────── */

function QuestionCard({
  q,
  index,
  errors,
  onChange,
  onDuplicate,
  onDelete,
}: {
  q: DraftQuestion;
  index: number;
  errors?: string[];
  onChange: (fn: (q: DraftQuestion) => DraftQuestion) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: q.key });
  const uid = useId();
  const typeId = `${uid}-type`;
  const pointsId = `${uid}-points`;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cx(isDragging && "relative z-10")}>
      <Card className={cx("p-5 sm:p-6", isDragging && "shadow-xl ring-2 ring-tests", !!errors?.length && "border-red-300")}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder question ${index + 1} (press space, then arrow keys)`}
            className="-ml-2 cursor-grab touch-none rounded-lg p-1.5 text-faint hover:bg-zinc-100 hover:text-ink active:cursor-grabbing"
          >
            <IconDrag />
          </button>
          <span className="text-sm font-bold">Q{index + 1}</span>
          <div className="ml-auto w-48">
            <label htmlFor={typeId} className="sr-only">
              Question type
            </label>
            <select
              id={typeId}
              value={q.type}
              onChange={(e) => onChange((x) => changeType(x, e.target.value as QuestionType))}
              className="h-9 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-ink"
            >
              {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label htmlFor={`prompt-${q.key}`} className="sr-only">
          Question {index + 1} prompt
        </label>
        <textarea
          id={`prompt-${q.key}`}
          value={q.prompt}
          maxLength={2000}
          rows={2}
          onChange={(e) => onChange((x) => ({ ...x, prompt: e.target.value }))}
          placeholder="Question"
          className="mt-3 w-full resize-y rounded-xl border border-line bg-app px-3.5 py-2.5 text-[15px] outline-none focus:border-ink focus:bg-surface"
        />

        <div className="mt-4">
          {(q.type === "single" || q.type === "multi") && <ChoiceEditor q={q} onChange={onChange} />}
          {q.type === "truefalse" && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">Correct answer</span>
              <Segmented<"true" | "false" | "">
                label={`Question ${index + 1} correct answer`}
                value={q.tf === null ? "" : q.tf ? "true" : "false"}
                onChange={(v) => onChange((x) => ({ ...x, tf: v === "true" }))}
                options={[
                  { value: "true", label: "True" },
                  { value: "false", label: "False" },
                ]}
              />
            </div>
          )}
          {q.type === "short" && <ShortEditor q={q} onChange={onChange} />}
        </div>

        {errors && errors.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-xs text-danger" role="alert">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <label htmlFor={pointsId} className="text-sm text-muted">
            Points
          </label>
          <input
            id={pointsId}
            type="number"
            min={0}
            max={100}
            step={1}
            value={Number.isFinite(q.points) ? q.points : ""}
            onChange={(e) => onChange((x) => ({ ...x, points: e.target.value === "" ? NaN : Math.trunc(Number(e.target.value)) }))}
            className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-sm tabular-nums outline-none focus:border-ink"
          />
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={onDuplicate} className="rounded-lg p-2 text-muted hover:bg-zinc-100 hover:text-ink" aria-label={`Duplicate question ${index + 1}`} title="Duplicate">
              <IconDuplicate />
            </button>
            <button type="button" onClick={onDelete} className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Delete question ${index + 1}`} title="Delete">
              <IconTrash />
            </button>
            <span className="mx-2 h-6 w-px bg-line" aria-hidden="true" />
            <Switch checked={q.required} onChange={(v) => onChange((x) => ({ ...x, required: v }))} label="Required" showLabel />
          </div>
        </div>
      </Card>
    </div>
  );
}

function ChoiceEditor({ q, onChange }: { q: DraftQuestion; onChange: (fn: (q: DraftQuestion) => DraftQuestion) => void }) {
  const isSingle = q.type === "single";
  const isCorrect = (id: string) => (isSingle ? q.single === id : q.multi.includes(id));
  const toggle = (id: string) =>
    onChange((x) => (isSingle ? { ...x, single: id } : { ...x, multi: x.multi.includes(id) ? x.multi.filter((m) => m !== id) : [...x.multi, id] }));

  return (
    <fieldset>
      <legend className="mb-2 text-xs text-muted">{isSingle ? "Select the correct option" : "Tick every correct option"}</legend>
      <ul className="space-y-2">
        {q.options.map((o, i) => {
          const correct = isCorrect(o.id);
          return (
            <li key={o.id} className="flex items-center gap-2">
              <input
                type={isSingle ? "radio" : "checkbox"}
                name={`correct-${q.key}`}
                checked={correct}
                onChange={() => toggle(o.id)}
                className="size-4 shrink-0 accent-success"
                aria-label={`Mark option ${i + 1} as correct`}
              />
              <input
                value={o.text}
                maxLength={500}
                onChange={(e) => onChange((x) => ({ ...x, options: x.options.map((p) => (p.id === o.id ? { ...p, text: e.target.value } : p)) }))}
                placeholder={`Option ${i + 1}`}
                aria-label={`Option ${i + 1}`}
                className={cx(
                  "h-10 min-w-0 flex-1 rounded-xl border bg-surface px-3 text-sm outline-none focus:border-ink",
                  correct ? "border-green-300 bg-success-soft/40" : "border-line",
                )}
              />
              {correct && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
                  <IconCheck size={12} /> Correct
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  onChange((x) => ({
                    ...x,
                    options: x.options.filter((p) => p.id !== o.id),
                    single: x.single === o.id ? "" : x.single,
                    multi: x.multi.filter((m) => m !== o.id),
                  }))
                }
                disabled={q.options.length <= 1}
                className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-ink disabled:opacity-30"
                aria-label={`Remove option ${i + 1}`}
              >
                <IconClose size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      {q.options.length < 12 && (
        <button
          type="button"
          onClick={() => onChange((x) => ({ ...x, options: [...x.options, { id: nextOptionId(x.options), text: `Option ${x.options.length + 1}` }] }))}
          className="mt-2 ml-6 text-sm font-semibold text-tests hover:underline"
        >
          + Add option
        </button>
      )}
    </fieldset>
  );
}

function ShortEditor({ q, onChange }: { q: DraftQuestion; onChange: (fn: (q: DraftQuestion) => DraftQuestion) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs text-muted">Accepted answers (not case-sensitive; extra spaces are ignored)</legend>
      <ul className="space-y-2">
        {q.accepted.map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              value={a}
              maxLength={200}
              onChange={(e) => onChange((x) => ({ ...x, accepted: x.accepted.map((s, j) => (j === i ? e.target.value : s)) }))}
              placeholder={`Accepted answer ${i + 1}`}
              aria-label={`Accepted answer ${i + 1}`}
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-ink"
            />
            <button
              type="button"
              onClick={() => onChange((x) => ({ ...x, accepted: x.accepted.filter((_, j) => j !== i) }))}
              disabled={q.accepted.length <= 1}
              className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-zinc-100 disabled:opacity-30"
              aria-label={`Remove accepted answer ${i + 1}`}
            >
              <IconClose size={16} />
            </button>
          </li>
        ))}
      </ul>
      {q.accepted.length < 20 && (
        <button type="button" onClick={() => onChange((x) => ({ ...x, accepted: [...x.accepted, ""] }))} className="mt-2 text-sm font-semibold text-tests hover:underline">
          + Add accepted answer
        </button>
      )}
    </fieldset>
  );
}

/* ───────────────────────── Preview ───────────────────────── */

function PreviewModal({ open, onClose, draft }: { open: boolean; onClose: () => void; draft: DraftTest }) {
  return (
    <Modal open={open} onClose={onClose} title="Student preview" description="What students see — correct answers are hidden." size="lg">
      <div className="space-y-4">
        <div className="rounded-2xl border-t-4 border-t-tests bg-app p-5">
          <p className="text-xl font-bold">{draft.title || "Untitled test"}</p>
          {draft.description && <p className="mt-1 text-sm whitespace-pre-line text-zinc-700">{draft.description}</p>}
          <p className="mt-2 text-xs text-muted">
            {draft.questions.length} questions · {maxScoreOf(draft)} points
          </p>
        </div>
        {draft.questions.length === 0 && <p className="text-sm text-muted">No questions yet.</p>}
        {draft.questions.map((q, i) => (
          <PreviewQuestion key={q.key} q={q} n={i + 1} />
        ))}
      </div>
    </Modal>
  );
}

function PreviewQuestion({ q, n }: { q: DraftQuestion; n: number }): ReactNode {
  return (
    <fieldset className="rounded-2xl border border-line p-5">
      <legend className="sr-only">Question {n}</legend>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold whitespace-pre-line">
          {n}. {q.prompt || <span className="text-faint">(no question text)</span>}
          {q.required && <span className="ml-1 text-danger" aria-label="required">*</span>}
        </p>
        <span className="shrink-0 text-xs text-muted">
          {q.points} pt{q.points === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        {(q.type === "single" || q.type === "multi") &&
          q.options.map((o) => (
            <label key={o.id} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2">
              <input type={q.type === "single" ? "radio" : "checkbox"} name={`preview-${q.key}`} className="size-4" />
              {o.text || <span className="text-faint">(empty option)</span>}
            </label>
          ))}
        {q.type === "truefalse" &&
          ["True", "False"].map((t) => (
            <label key={t} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2">
              <input type="radio" name={`preview-${q.key}`} className="size-4" />
              {t}
            </label>
          ))}
        {q.type === "short" && <input aria-label="Your answer" placeholder="Your answer" className="h-10 w-full rounded-xl border border-line px-3" />}
      </div>
    </fieldset>
  );
}

