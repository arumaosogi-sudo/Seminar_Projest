import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { AdminClass, AdminResults, AdminTestSummary, TestKind } from "@shared/contract";
import { api } from "@/lib/api";
import { Badge, Button, Card, cx, DraftBadge, EmptyState, PageHeader, PageLoader, Select } from "@/components/ui";
import { useAdminClass } from "@/components/admin/adminClass";
import { GroupedBarChart, PercentBars, type BarSeries } from "@/components/admin/charts";
import { CardTitle, QueryError, SearchBox, StatCard } from "@/components/admin/controls";
import { defaultTestIds, exportResultsToExcel, prePost, rowChange } from "@/components/admin/exportResults";
import { errorMessage, fmtNum, signed } from "@/components/admin/format";
import { IconChevronDown, IconDownload } from "@/components/admin/icons";
import { adminKeys } from "@/components/admin/keys";
import { useToast } from "@/components/admin/toastContext";

type StatusFilter = "active" | "all";

const SERIES_STYLE: Record<TestKind, { fill: string; swatch: string }[]> = {
  pretest: [{ fill: "fill-zinc-400", swatch: "bg-zinc-400" }],
  posttest: [{ fill: "fill-tests", swatch: "bg-tests" }],
  other: [
    { fill: "fill-games", swatch: "bg-games" },
    { fill: "fill-explore", swatch: "bg-explore" },
    { fill: "fill-amber-500", swatch: "bg-amber-500" },
  ],
};

export default function Results() {
  const { classId: currentId } = useAdminClass();
  const toast = useToast();
  const classesQ = useQuery({ queryKey: adminKeys.classes("all"), queryFn: () => api.get<AdminClass[]>("/admin/classes?status=all") });
  const testsQ = useQuery({ queryKey: adminKeys.tests, queryFn: () => api.get<AdminTestSummary[]>("/admin/tests") });

  const [classSel, setClassSel] = useState<string | null>(null); // null = follow the sidebar's current class
  const [picked, setPicked] = useState<number[] | null>(null); // null = defaults
  const [status, setStatus] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [exporting, setExporting] = useState(false);

  const classValue = classSel ?? (currentId ? String(currentId) : "all");
  const classId = classValue === "all" ? null : Number(classValue);
  const tests = useMemo(() => testsQ.data ?? [], [testsQ.data]);
  const testIds = useMemo(() => {
    const ids = picked ?? defaultTestIds(tests);
    return [...ids].filter((id) => tests.some((t) => t.id === id)).sort((a, b) => a - b);
  }, [picked, tests]);

  const resultsQ = useQuery({
    queryKey: adminKeys.results(classId, testIds, status),
    queryFn: () => api.get<AdminResults>(`/admin/results?${new URLSearchParams({ ...(classId ? { classId: String(classId) } : {}), testIds: testIds.join(","), status })}`),
    enabled: testIds.length > 0,
    placeholderData: (prev) => prev,
  });

  const classes = classesQ.data ?? [];
  const classLabel = classId ? (classes.find((c) => c.id === classId)?.name ?? `Class ${classId}`) : "All classes";
  const data = resultsQ.data;
  const pp = data ? prePost(data) : null;

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.rows
      .filter((r) => status === "all" || r.enrollmentStatus === "active") // server already filters; keep as a guard
      .filter((r) => !term || r.studentCode.includes(term) || (r.firstName ?? "").toLowerCase().includes(term))
      .filter((r) => !missingOnly || data.tests.some((t) => r.scores[String(t.testId)] === null || r.scores[String(t.testId)] === undefined))
      .sort((a, b) => a.className.localeCompare(b.className) || a.studentCode.localeCompare(b.studentCode));
  }, [data, search, status, missingOnly]);

  async function onExport() {
    if (!data) return;
    setExporting(true);
    try {
      const name = await exportResultsToExcel(data, { classLabel, includeWithdrawn: status === "all" });
      toast.show(`Exported ${name}`, "success");
    } catch (e) {
      toast.show(`Export failed: ${errorMessage(e)}`, "error");
    } finally {
      setExporting(false);
    }
  }

  const series: BarSeries[] = useMemo(() => {
    if (!data) return [];
    const used: Record<TestKind, number> = { pretest: 0, posttest: 0, other: 0 };
    return data.tests.map((t) => {
      const styles = SERIES_STYLE[t.kind];
      const st = styles[Math.min(used[t.kind]++, styles.length - 1)];
      const bins = data.distribution.find((d) => d.testId === t.testId)?.bins ?? [];
      const counts = Array.from({ length: t.maxScore + 1 }, (_, i) => bins.find((b) => b.score === i)?.count ?? 0);
      return { id: String(t.testId), label: t.title, fillClass: st.fill, swatchClass: st.swatch, counts };
    });
  }, [data]);
  const maxX = data ? Math.max(0, ...data.tests.map((t) => t.maxScore)) : 0;

  const itemTest = pp?.post ?? data?.tests[0] ?? null;
  const items = itemTest ? (data?.itemAnalysis.find((i) => i.testId === itemTest.testId)?.items ?? []) : [];

  return (
    <>
      <PageHeader
        title="Results"
        subtitle="Pretest vs posttest · filtered by class"
        actions={
          <>
            <DraftBadge />
            <Button accent="success" onClick={() => void onExport()} loading={exporting} disabled={!data || resultsQ.isFetching}>
              <IconDownload size={16} /> Export Excel
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
        <div className="w-full sm:w-60">
          <Select name="results-class" label="Class" value={classValue} onChange={(e) => setClassSel(e.target.value)}>
            <option value="all">All classes</option>
            <optgroup label="Active">
              {classes
                .filter((c) => c.status === "active")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
            {classes.some((c) => c.status === "archived") && (
              <optgroup label="Archived">
                {classes
                  .filter((c) => c.status === "archived")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </Select>
        </div>
        <TestPicker tests={tests} selected={testIds} onChange={setPicked} />
        <div className="w-full sm:w-52">
          <Select name="results-status" label="Status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="active">Active only</option>
            <option value="all">Include withdrawn</option>
          </Select>
        </div>
        {resultsQ.isFetching && data && <span className="pb-2.5 text-xs text-muted">Updating…</span>}
      </Card>

      {testsQ.isPending || classesQ.isPending ? (
        <PageLoader />
      ) : testsQ.isError ? (
        <QueryError error={testsQ.error} onRetry={() => void testsQ.refetch()} what="tests" />
      ) : tests.length === 0 ? (
        <EmptyState title="No tests yet" action={<Link to="/admin/tests" className="font-semibold underline">Create a test</Link>}>
          Results appear once students submit an assigned test.
        </EmptyState>
      ) : testIds.length === 0 ? (
        <EmptyState title="Pick at least one test">Use the Tests filter above.</EmptyState>
      ) : resultsQ.isPending ? (
        <PageLoader />
      ) : resultsQ.isError ? (
        <QueryError error={resultsQ.error} onRetry={() => void resultsQ.refetch()} what="results" />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pretest mean ± SD"
              value={pp?.pre ? `${fmtNum(pp.pre.stats.mean)} ± ${fmtNum(pp.pre.stats.sd)}` : "—"}
              sub={pp?.pre ? `n = ${pp.pre.stats.n} · out of ${pp.pre.maxScore}` : "No pretest selected"}
            />
            <StatCard
              label="Posttest mean ± SD"
              tone="tests"
              value={pp?.post ? `${fmtNum(pp.post.stats.mean)} ± ${fmtNum(pp.post.stats.sd)}` : "—"}
              sub={pp?.post ? `n = ${pp.post.stats.n} · out of ${pp.post.maxScore}` : "No posttest selected"}
            />
            <StatCard
              label="Mean gain"
              tone="success"
              value={data.paired ? signed(data.paired.meanGain) : "—"}
              sub={data.paired ? `paired, n = ${data.paired.n}` : "Select one pretest and one posttest"}
            />
            <StatCard label="Improved" value={data.paired ? data.paired.improved : "—"} sub={data.paired ? `of ${data.paired.n} students who took both` : " "} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-5">
              <CardTitle>Score distribution</CardTitle>
              <div className="mt-3">
                {data.tests.every((t) => t.stats.n === 0) ? (
                  <p className="py-12 text-center text-sm text-muted">No submissions yet.</p>
                ) : (
                  <GroupedBarChart series={series} maxX={maxX} />
                )}
              </div>
            </Card>
            <Card className="p-5">
              <CardTitle>Item analysis · {itemTest?.kind === "posttest" ? "posttest" : (itemTest?.title ?? "—")}</CardTitle>
              <p className="mt-1 text-xs text-muted">% of students who answered each question correctly (latest version). Red = below 60%.</p>
              <div className="mt-4 max-h-[320px] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted">No answers to analyse yet.</p>
                ) : (
                  <PercentBars
                    items={[...items]
                      .sort((a, b) => a.position - b.position)
                      .map((it) => ({ key: it.questionId, label: `Q${it.position}`, title: it.prompt, percent: it.percentCorrect, n: it.n }))}
                  />
                )}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
              <CardTitle>
                Scores <span className="ml-1 normal-case tracking-normal text-faint">({rows.length})</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-ink" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
                  Missing a test
                </label>
                <div className="w-64">
                  <SearchBox value={search} onChange={setSearch} placeholder="Student ID or name" label="Search students" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">Scores per student</caption>
                <thead>
                  <tr className="border-y border-line text-left text-[11px] tracking-wider text-muted uppercase">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Student ID</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">First name</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Section</th>
                    {data.tests.map((t) => (
                      <th key={t.testId} scope="col" className="px-3 py-2.5 text-right font-semibold" title={t.title}>
                        <span className="block max-w-[160px] truncate">{t.title}</span>
                        <span className="font-normal normal-case">/{t.maxScore}</span>
                      </th>
                    ))}
                    {pp?.paired && (
                      <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                        Change
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3 + data.tests.length + (pp?.paired ? 1 : 0)} className="px-5 py-10 text-center text-muted">
                        {data.rows.length === 0 ? "No students in this selection." : "No students match the filters."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const change = pp?.paired ? rowChange(r, pp.pre?.testId, pp.post?.testId) : null;
                      return (
                        <tr key={`${r.className}-${r.studentCode}`} className={cx("border-b border-line last:border-b-0", r.enrollmentStatus === "withdrawn" && "text-muted")}>
                          <td className="px-5 py-2.5 font-mono text-[13px]">{r.studentCode}</td>
                          <td className="px-3 py-2.5">
                            {r.firstName ?? <span className="text-faint">—</span>}
                            {r.enrollmentStatus === "withdrawn" && <Badge className="ml-2">Withdrawn</Badge>}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{r.className}</td>
                          {data.tests.map((t) => {
                            const v = r.scores[String(t.testId)];
                            return (
                              <td key={t.testId} className="px-3 py-2.5 text-right tabular-nums">
                                {v === null || v === undefined ? <Badge className="bg-zinc-100 font-medium text-muted">Not taken</Badge> : v}
                              </td>
                            );
                          })}
                          {pp?.paired && (
                            <td
                              className={cx(
                                "px-5 py-2.5 text-right font-semibold tabular-nums",
                                change !== null && change > 0 && "text-success",
                                change !== null && change < 0 && "text-danger",
                              )}
                            >
                              {change === null ? <span className="font-normal text-faint">—</span> : signed(change, 0)}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

/* ───────── Tests multi-select (disclosure + checkbox list) ───────── */

function TestPicker({ tests, selected, onChange }: { tests: AdminTestSummary[]; selected: number[]; onChange: (ids: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const names = tests.filter((t) => selected.includes(t.id)).map((t) => t.title);
  const summary = names.length === 0 ? "None" : names.length <= 2 ? names.join(", ") : `${names.length} tests`;

  return (
    <div ref={ref} className="relative w-full sm:w-72">
      <span id={labelId} className="mb-1.5 block text-sm font-semibold">
        Tests
      </span>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-describedby={`${listId}-sum`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-left text-sm outline-none focus:border-ink"
      >
        <span id={`${listId}-sum`} className="truncate">
          {summary}
        </span>
        <IconChevronDown size={16} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div id={listId} className="absolute z-20 mt-1 max-h-72 w-full min-w-64 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          <fieldset>
            <legend className="sr-only">Tests to include</legend>
            {tests.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-zinc-50">
                <input
                  type="checkbox"
                  className="size-4 accent-tests"
                  checked={selected.includes(t.id)}
                  onChange={(e) => onChange(e.target.checked ? [...selected, t.id] : selected.filter((id) => id !== t.id))}
                />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">{t.kind}</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}
