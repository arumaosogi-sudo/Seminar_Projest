import { useId, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminAssignment, AdminClass, AdminTestDetail, ScorePolicy } from "@shared/contract";
import { api } from "@/lib/api";
import { Button, Card, cx, DraftBadge, EmptyState, ErrorNote, PageHeader, PageLoader } from "@/components/ui";
import { useAdminClass } from "@/components/admin/adminClass";
import { defaultForm, formFromAssignment, pickSettings, sameSettings, toSettings, type AssignForm } from "@/components/admin/assign";
import { CardTitle, QueryError, Segmented, SettingRow, Switch } from "@/components/admin/controls";
import { IconCheck } from "@/components/admin/icons";
import { errorMessage, formatDateTime, isApiStatus } from "@/components/admin/format";
import { adminKeys } from "@/components/admin/keys";
import { useToast } from "@/components/admin/toastContext";

export default function AssignTest() {
  const params = useParams();
  const testId = Number(params.testId);
  const valid = Number.isInteger(testId) && testId > 0;
  const { classes, loading: classesLoading } = useAdminClass();

  const testQ = useQuery({ queryKey: adminKeys.test(testId), queryFn: () => api.get<AdminTestDetail>(`/admin/tests/${testId}`), enabled: valid });
  const asgQ = useQuery({ queryKey: adminKeys.assignments(testId), queryFn: () => api.get<AdminAssignment[]>(`/admin/tests/${testId}/assignments`), enabled: valid });

  if (!valid || isApiStatus(testQ.error, 404))
    return (
      <EmptyState title="Test not found" action={<Link to="/admin/tests" className="font-semibold underline">Back to tests</Link>}>
        It may have been deleted.
      </EmptyState>
    );
  if (testQ.isPending || asgQ.isPending || classesLoading) return <PageLoader />;
  if (testQ.isError) return <QueryError error={testQ.error} onRetry={() => void testQ.refetch()} what="the test" />;
  if (asgQ.isError) return <QueryError error={asgQ.error} onRetry={() => void asgQ.refetch()} what="assignments" />;

  // The editor keeps its form state across refetches (partial-failure saves keep the user's edits).
  return <AssignEditor key={testId} test={testQ.data} assignments={asgQ.data} classes={classes} />;
}

function statusLine(a: AdminAssignment | undefined, now: number): { text: string; tone: "open" | "scheduled" | "closed" | "none" } {
  if (!a) return { text: "Not assigned", tone: "none" };
  if (a.currentlyOpen) return { text: `Open · ${a.submittedCount}/${a.studentCount} submitted`, tone: "open" };
  if (a.availability === "scheduled" && a.opensAt && Date.parse(a.opensAt) > now) return { text: `Scheduled · opens ${formatDateTime(a.opensAt)}`, tone: "scheduled" };
  return { text: `Closed · ${a.submittedCount}/${a.studentCount} submitted`, tone: "closed" };
}

function AssignEditor({ test, assignments, classes }: { test: AdminTestDetail; assignments: AdminAssignment[]; classes: AdminClass[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { classId: currentId } = useAdminClass();
  const byClass = useMemo(() => new Map(assignments.map((a) => [a.classId, a])), [assignments]);
  const [now] = useState(() => Date.now());

  const [forms, setForms] = useState<Record<number, AssignForm>>(() => {
    const init: Record<number, AssignForm> = {};
    for (const c of classes) {
      const a = byClass.get(c.id);
      init[c.id] = a ? formFromAssignment(a) : defaultForm(test.kind);
    }
    return init;
  });
  const [checked, setChecked] = useState<Set<number>>(() => new Set(assignments.map((a) => a.classId).filter((id) => classes.some((c) => c.id === id))));
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    if (currentId && classes.some((c) => c.id === currentId)) return currentId;
    return classes[0]?.id ?? null;
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const selected = classes.find((c) => c.id === selectedId) ?? null;
  const form = selected ? (forms[selected.id] ?? defaultForm(test.kind)) : null;
  const setForm = (patch: Partial<AssignForm>) => {
    if (!selected) return;
    setForms((f) => ({ ...f, [selected.id]: { ...(f[selected.id] ?? defaultForm(test.kind)), ...patch } }));
    setErrors((e) => {
      if (!(selected.id in e)) return e;
      const rest = { ...e };
      delete rest[selected.id];
      return rest;
    });
  };

  const toggle = (id: number) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const copyToAll = () => {
    if (!selected || !form) return;
    setForms((f) => {
      const next = { ...f };
      for (const id of checked) next[id] = { ...form };
      return next;
    });
    toast.show(`Copied ${selected.name} settings to ${checked.size} selected section${checked.size === 1 ? "" : "s"}`);
  };

  async function saveAll() {
    const errs: Record<number, string> = {};
    const puts: { classId: number; body: ReturnType<typeof toSettings> & { ok: true } }[] = [];
    for (const id of checked) {
      const r = toSettings(forms[id] ?? defaultForm(test.kind));
      if (!r.ok) errs[id] = r.error;
      else {
        const existing = byClass.get(id);
        if (!existing || !sameSettings(pickSettings(existing), r.value)) puts.push({ classId: id, body: r });
      }
    }
    const dels = assignments.filter((a) => !checked.has(a.classId) && classes.some((c) => c.id === a.classId)).map((a) => a.classId);
    if (Object.keys(errs).length) {
      setErrors(errs);
      const first = Number(Object.keys(errs)[0]);
      setSelectedId(first);
      toast.show("Some sections have invalid settings.", "error");
      return;
    }
    if (puts.length === 0 && dels.length === 0) {
      toast.show("Nothing to save — no changes.");
      return;
    }
    setSaving(true);
    const results = await Promise.allSettled([
      ...puts.map((p) => api.put<AdminAssignment>(`/admin/tests/${test.id}/assignments/${p.classId}`, p.body.value).then(() => p.classId)),
      ...dels.map((id) =>
        api.del<unknown>(`/admin/tests/${test.id}/assignments/${id}`).then(
          () => id,
          (e: unknown) => {
            throw Object.assign(new Error(isApiStatus(e, 409) ? "Students already took this test in this section, so it can’t be unassigned. Close it instead." : errorMessage(e)), { classId: id });
          },
        ),
      ),
    ]);
    setSaving(false);
    const failed: Record<number, string> = {};
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const id = i < puts.length ? puts[i].classId : dels[i - puts.length];
        failed[id] = errorMessage(r.reason);
      }
    });
    // A failed unassign (e.g. 409 has_attempts) means the class is still assigned — reflect that in the checkboxes.
    const stillAssigned = dels.filter((id) => id in failed);
    if (stillAssigned.length)
      setChecked((s) => {
        const n = new Set(s);
        stillAssigned.forEach((id) => n.add(id));
        return n;
      });
    void qc.invalidateQueries({ queryKey: adminKeys.tests });
    void qc.invalidateQueries({ queryKey: adminKeys.classesRoot });
    if (Object.keys(failed).length) {
      // Keep the user's edits for the failed sections; refetch only once they fix/leave.
      setErrors(failed);
      toast.show(`${results.length - Object.keys(failed).length} saved, ${Object.keys(failed).length} failed.`, "error");
      void qc.invalidateQueries({ queryKey: adminKeys.assignments(test.id) });
      return;
    }
    toast.show("Assignments saved & published", "success");
    await qc.invalidateQueries({ queryKey: adminKeys.assignments(test.id) });
    navigate("/admin/tests");
  }

  const serverSel = selected ? byClass.get(selected.id) : undefined;
  const minutesId = useId();
  const attemptsId = useId();
  const opensId = useId();
  const closesId = useId();

  return (
    <>
      <PageHeader
        title="Assign test"
        subtitle={
          <>
            <span className="font-semibold text-ink">{test.title}</span> · settings are separate for each section
          </>
        }
        actions={
          <>
            <DraftBadge />
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={saving}
              className="h-[43px] w-[87px] rounded-[11.5px] border border-line bg-surface text-[15px] font-semibold text-ink hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <Button accent="tests" size="lg" className="w-[150px] whitespace-nowrap rounded-xl px-0" onClick={() => void saveAll()} loading={saving} disabled={classes.length === 0}>
              Save &amp; publish
            </Button>
          </>
        }
      />

      {test.questionCount === 0 && (
        <div className="mb-5">
          <ErrorNote>
            This test has no questions yet. <Link to={`/admin/tests/${test.id}`} className="font-semibold underline">Add questions</Link> before opening it to students.
          </ErrorNote>
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState title="No active classes" action={<Link to="/admin/classes" className="font-semibold underline">Create a class</Link>}>
          Create a section first, then assign this test to it.
        </EmptyState>
      ) : (
        <div className="grid items-start gap-[25px] lg:grid-cols-[239px_minmax(0,1fr)]">
          <Card className="px-[19px] pb-[19px] pt-[22px]">
            <CardTitle>Sections</CardTitle>
            <ul className="mt-[14px] space-y-2.5">
              {classes.map((c) => {
                const a = byClass.get(c.id);
                const s = statusLine(a, now);
                const isChecked = checked.has(c.id);
                const pending = isChecked && !a ? "Will be assigned" : !isChecked && a ? "Will be unassigned" : null;
                return (
                  <li key={c.id}>
                    <div
                      className={cx(
                        "flex min-h-[60px] items-center gap-[14px] rounded-xl px-[13px] py-2 transition-colors",
                        selectedId === c.id ? "bg-tests-soft" : "hover:bg-zinc-50",
                        errors[c.id] && "ring-1 ring-red-300",
                      )}
                    >
                      <span className="relative grid size-[18px] shrink-0 place-items-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            toggle(c.id);
                            setSelectedId(c.id);
                          }}
                          className="peer size-[18px] cursor-pointer appearance-none rounded-[5px] border border-zinc-300 bg-surface checked:border-tests checked:bg-tests"
                          aria-label={`Assign to ${c.name}`}
                        />
                        <IconCheck size={12} strokeWidth={3} className="pointer-events-none absolute hidden text-white peer-checked:block" />
                      </span>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(c.id)} aria-pressed={selectedId === c.id}>
                        <span className="block truncate text-[13px] font-semibold leading-[18px] text-ink">{c.name}</span>
                        <span className="block text-[12px] leading-4 text-muted" title={s.text}>
                          {s.tone === "open" ? "Open" : s.tone === "scheduled" ? "Scheduled" : s.tone === "closed" ? "Closed" : "Not assigned"}
                        </span>
                        {pending && <span className="block text-[12px] font-semibold text-amber-700">{pending}</span>}
                        {errors[c.id] && <span className="mt-1 block text-[12px] text-danger">{errors[c.id]}</span>}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected && form && (
            <Card className="px-[30px] pb-6 pt-[26px]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-semibold leading-8 text-ink">{selected.name.split(" · ").pop()} settings</h2>
                  {!checked.has(selected.id) && <p className="text-[12px] text-muted">Not assigned — tick the section on the left to assign it</p>}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {checked.size > 1 && (
                    <Button size="sm" variant="outline" onClick={copyToAll}>
                      Copy to all selected
                    </Button>
                  )}
                  {serverSel?.currentlyOpen && (
                    <span className="inline-flex h-[25px] items-center rounded-full bg-tests px-3 text-[12px] font-semibold text-white">Open now</span>
                  )}
                </div>
              </div>

              <div className={cx("mt-3", !checked.has(selected.id) && "opacity-60")}>
                <SettingRow label="Time limit" helper="Countdown is kept by the server" htmlFor={form.timeMode === "limited" ? minutesId : undefined}>
                  <Segmented
                    label="Time limit"
                    value={form.timeMode}
                    onChange={(v) => setForm({ timeMode: v })}
                    options={[
                      { value: "none", label: "No limit" },
                      { value: "limited", label: "Limited" },
                    ]}
                  />
                  {form.timeMode === "limited" && (
                    <span className="flex items-center gap-3 text-[13px] text-muted">
                      <input
                        id={minutesId}
                        type="number"
                        min={1}
                        max={600}
                        value={form.minutes}
                        onChange={(e) => setForm({ minutes: e.target.value })}
                        className="h-[43px] w-[89px] rounded-[11.5px] border border-line bg-surface text-center text-[14px] tabular-nums outline-none focus:border-gray-800"
                      />
                      min
                    </span>
                  )}
                </SettingRow>

                <SettingRow label="Attempts" helper="Resuming an unfinished attempt doesn’t use another one" htmlFor={form.attemptsMode === "retakes" ? attemptsId : undefined}>
                  <Segmented
                    label="Attempts"
                    value={form.attemptsMode}
                    onChange={(v) => setForm({ attemptsMode: v })}
                    options={[
                      { value: "once", label: "Once" },
                      { value: "retakes", label: "Retakes" },
                    ]}
                  />
                  {form.attemptsMode === "retakes" && (
                    <span className="flex items-center gap-3 text-[13px] text-muted">
                      <input
                        id={attemptsId}
                        type="number"
                        min={2}
                        max={50}
                        placeholder="∞"
                        value={form.attempts}
                        onChange={(e) => setForm({ attempts: e.target.value })}
                        className="h-[43px] w-[89px] rounded-[11.5px] border border-line bg-surface text-center text-[14px] tabular-nums outline-none focus:border-gray-800"
                        aria-describedby={`${attemptsId}-hint`}
                      />
                      times
                      <span id={`${attemptsId}-hint`} className="sr-only">
                        Leave blank for unlimited attempts
                      </span>
                    </span>
                  )}
                </SettingRow>

                <SettingRow label="Score that counts" helper="Used when retakes are allowed">
                  <Segmented<ScorePolicy>
                    label="Score that counts"
                    value={form.scorePolicy}
                    onChange={(v) => setForm({ scorePolicy: v })}
                    options={[
                      { value: "highest", label: "Highest" },
                      { value: "latest", label: "Latest" },
                      { value: "first", label: "First" },
                    ]}
                  />
                </SettingRow>

                <SettingRow label="Availability" helper={form.availability === "manual" ? "Open or close it yourself" : "Opens and closes automatically (your local time)"}>
                  <div className="flex flex-wrap items-center justify-end gap-2.5">
                    <Segmented
                      label="Availability"
                      value={form.availability}
                      onChange={(v) => setForm({ availability: v })}
                      options={[
                        { value: "manual", label: "Manual" },
                        { value: "scheduled", label: "Scheduled" },
                      ]}
                    />
                    {form.availability === "manual" ? (
                      <Switch checked={form.isOpen} onChange={(v) => setForm({ isOpen: v })} label={form.isOpen ? "Open" : "Closed"} showLabel accent="success" />
                    ) : (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <DateField id={opensId} label="Opens at" value={form.opensLocal} onChange={(v) => setForm({ opensLocal: v })} />
                        <span className="text-[13px] text-muted" aria-hidden="true">
                          →
                        </span>
                        <DateField id={closesId} label="Closes at" value={form.closesLocal} min={form.opensLocal || undefined} onChange={(v) => setForm({ closesLocal: v })} />
                      </div>
                    )}
                  </div>
                </SettingRow>

                <SettingRow label="Show answers after submit" helper="Students see the correct answers on their result page">
                  <Switch checked={form.showAnswers} onChange={(v) => setForm({ showAnswers: v })} label="Show answers after submit" />
                </SettingRow>

                <SettingRow label="Required before other menus" helper="Students must finish this test before opening Games / 3D (use for Pretest)">
                  <Switch checked={form.requiredFirst} onChange={(v) => setForm({ requiredFirst: v })} label="Required before other menus" />
                </SettingRow>
              </div>

              {errors[selected.id] && (
                <div className="mt-4">
                  <ErrorNote>{errors[selected.id]}</ErrorNote>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Figma date box: 139×43, "20 Oct, 09:00". A native datetime-local input stays underneath for
 * keyboard / screen readers and opens the browser picker on click.
 */
function DateField({ id, label, value, min, onChange }: { id: string; label: string; value: string; min?: string; onChange: (v: string) => void }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  const text = m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}, ${m[4]}:${m[5]}` : "Pick date & time";
  return (
    <span className="relative flex h-[43px] w-[139px] items-center rounded-[11.5px] border border-line bg-surface px-[15px] text-[14px] focus-within:border-gray-800">
      <span className={cx("truncate", m ? "text-ink" : "text-faint")} aria-hidden="true">
        {text}
      </span>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            /* older browsers: the focused input still accepts typing */
          }
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </span>
  );
}