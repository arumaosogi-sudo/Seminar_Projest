import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { AdminClass, AdminResults, AdminTestSummary, TestKind } from "@shared/contract";
import { api } from "@/lib/api";
import { Button, Card, cx, DraftBadge, EmptyState, PageHeader, PageLoader } from "@/components/ui";
import { useAdminClass } from "@/components/admin/adminClass";
import { PairedBars, PercentBars, type BarSeries } from "@/components/admin/charts";
import { FilterSelect, QueryError, SearchBox, StatCard, StatusChip } from "@/components/admin/controls";
import { defaultTestIds, distributionCounts, distributionMaxX, exportResultsToExcel, prePost, rowChange } from "@/components/admin/exportResults";
import { errorMessage, fmtNum, signed } from "@/components/admin/format";
import { IconChevronDown, IconDownload } from "@/components/admin/icons";
import { adminKeys } from "@/components/admin/keys";
import { useToast } from "@/components/admin/toastContext";

type StatusFilter = "active" | "all";
const MAX_PICKED_TESTS = 20;

const SERIES_STYLE: Record<TestKind, { fill: string; swatch: string }[]> = {
  pretest: [{ fill: "fill-[#c4c4cc]", swatch: "bg-[#c4c4cc]" }],
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
  const [exporting, setExporting] = useState(false);

  const classValue = classSel ?? (currentId ? String(currentId) : "all");
  const classId = classValue === "all" ? null : Number(classValue);
  const tests = useMemo(() => testsQ.data ?? [], [testsQ.data]);
  const testIds = useMemo(() => {
    const ids = picked ?? defaultTestIds(tests);
    return [...ids].filter((id) => tests.some((t) => t.id === id)).sort((a, b) => a - b).slice(0, MAX_PICKED_TESTS);
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
      .sort((a, b) => a.className.localeCompare(b.className) || a.studentCode.localeCompare(b.studentCode));
  }, [data, search, status]);

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
      const counts = distributionCounts(t.maxScore, bins);
      return { id: String(t.testId), label: t.title, fillClass: st.fill, swatchClass: st.swatch, counts };
    });
  }, [data]);
  const maxX = data ? distributionMaxX(data) : 0;

  const itemTest = pp?.post ?? data?.tests[0] ?? null;
  const items = itemTest ? (data?.itemAnalysis.find((i) => i.testId === itemTest.testId)?.items ?? []) : [];

  // Figma 4th card: how many students are still missing the posttest (falls back to the last selected test).
  const missingTest = pp?.post ?? data?.tests[data.tests.length - 1] ?? null;
  const notTaken = data && missingTest ? data.rows.filter((r) => r.scores[String(missingTest.testId)] == null).length : null;
  const statusLabel = status === "active" ? "Active only" : "Include withdrawn";

  return (
    <>
      <PageHeader
        title="Results"
        subtitle="Pretest vs posttest · filtered by class"
        actions={
          <>
            <DraftBadge />
            <Button
              accent="success"
              size="lg"
              className="w-[156px] whitespace-nowrap rounded-xl px-0"
              onClick={() => void onExport()}
              loading={exporting}
              disabled={!data || resultsQ.isFetching}
            >
              <IconDownload size={18} /> Export Excel
            </Button>
          </>
        }
      />

      {/* Filters (Figma: three white fields, no card) */}
      <div className="mb-[25px] flex flex-wrap items-center gap-[13px]">
        <FilterSelect label="Class" value={classValue} onChange={setClassSel} display={classLabel} className="w-full sm:w-[239px]">
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
        </FilterSelect>
        <TestPicker tests={tests} selected={testIds} onChange={setPicked} />
        <FilterSelect label="Status" value={status} onChange={(v) => setStatus(v as StatusFilter)} display={statusLabel} className="w-full sm:w-[199px]">
          <option value="active">Active only</option>
          <option value="all">Include withdrawn</option>
        </FilterSelect>
        {resultsQ.isFetching && data && <span className="text-xs text-muted">Updating…</span>}
      </div>

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
        <div className="space-y-[25px]">
          <div className="grid gap-[17px] sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pretest mean ± SD"
              value={pp?.pre ? `${fmtNum(pp.pre.stats.mean)} ± ${fmtNum(pp.pre.stats.sd)}` : "—"}
              sub={pp?.pre ? statLine(pp.pre.stats) : "No pretest selected"}
            />
            <StatCard
              label="Posttest mean ± SD"
              tone="tests"
              value={pp?.post ? `${fmtNum(pp.post.stats.mean)} ± ${fmtNum(pp.post.stats.sd)}` : "—"}
              sub={pp?.post ? statLine(pp.post.stats) : "No posttest selected"}
            />
            <StatCard
              label="Mean change"
              tone="success"
              value={data.paired ? signed(data.paired.meanGain) : "—"}
              sub={data.paired ? `paired, n = ${data.paired.n}` : "Select one pretest and one posttest"}
            />
            <StatCard
              label="Not taken yet"
              value={notTaken ?? "—"}
              sub={missingTest ? `${missingTest.kind === "posttest" ? "posttest" : missingTest.title} · list below` : " "}
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-[18px] xl:grid-cols-[minmax(0,612fr)_minmax(0,482fr)]">
            <Card className="px-6 pb-6 pt-[22px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold leading-6 text-ink">Score distribution</h2>
                <div className="flex flex-wrap gap-4 text-[12px] text-muted">
                  {series.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-[7px]" title={s.label}>
                      <span className={cx("size-2.5 rounded-[3px]", s.swatchClass)} aria-hidden="true" />
                      {shortKind(data.tests.find((t) => String(t.testId) === s.id))}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-[50px] overflow-x-auto">
                {data.tests.every((t) => t.stats.n === 0) ? (
                  <p className="py-12 text-center text-sm text-muted">No submissions yet.</p>
                ) : (
                  <PairedBars series={series} maxX={maxX} />
                )}
              </div>
            </Card>
            <Card className="px-6 pb-6 pt-[22px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold leading-6 text-ink">
                  Item analysis · {itemTest?.kind === "posttest" ? "posttest" : (itemTest?.title ?? "—")}
                </h2>
                <span className="text-[12px] text-muted" title="% of students who answered each question correctly (latest version). Red = below 60%.">
                  % correct
                </span>
              </div>
              <div className="mt-[13px] max-h-[280px] overflow-y-auto pr-1">
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

          <Card className="overflow-hidden pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3 pl-5 pr-[18px] pt-[17px]">
              <h2 className="text-[17px] font-semibold leading-6 text-ink">Scores</h2>
              <div className="w-full sm:w-[239px]">
                <SearchBox value={search} onChange={setSearch} placeholder="Search student ID..." label="Search by student ID or name" />
              </div>
            </div>
            <div className="relative mt-[28px] overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed text-[14px]">
                <caption className="sr-only">Scores per student</caption>
                <colgroup>
                  <col className="w-[224px]" />
                  <col className="w-[223px]" />
                  <col className="w-[160px]" />
                  {data.tests.map((t) => (
                    <col key={t.testId} className="w-[160px]" />
                  ))}
                  {pp?.paired && <col />}
                </colgroup>
                <thead>
                  <tr className="text-left text-[12px] uppercase text-faint">
                    <th scope="col" className="pb-[14px] pl-5 font-semibold">Student ID</th>
                    <th scope="col" className="pb-[14px] font-semibold">First name</th>
                    <th scope="col" className="pb-[14px] font-semibold">Section</th>
                    {data.tests.map((t) => (
                      <th key={t.testId} scope="col" className="truncate pb-[14px] pr-3 font-semibold" title={`${t.title} (out of ${t.maxScore})`}>
                        {t.kind === "other" ? t.title : t.kind}
                      </th>
                    ))}
                    {pp?.paired && (
                      <th scope="col" className="pb-[14px] pr-5 font-semibold">
                        Change
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3 + data.tests.length + (pp?.paired ? 1 : 0)} className="px-5 py-10 text-center text-muted">
                        {data.rows.length === 0 ? "No students in this selection." : "No students match the search."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const change = pp?.paired ? rowChange(r, pp.pre?.testId, pp.post?.testId) : null;
                      const missing = data.tests.some((t) => r.scores[String(t.testId)] == null);
                      return (
                        <tr key={`${r.className}-${r.studentCode}`} className={cx("h-[49px]", r.enrollmentStatus === "withdrawn" ? "text-muted" : "text-ink")}>
                          <td className="pl-5 tabular-nums">{r.studentCode}</td>
                          <td className="truncate pr-3">
                            {r.firstName ?? <span className="text-faint">—</span>}
                            {r.enrollmentStatus === "withdrawn" && <StatusChip tone="neutral">Withdrawn</StatusChip>}
                          </td>
                          <td className="whitespace-nowrap">{shortSection(r.className)}</td>
                          {data.tests.map((t) => {
                            const v = r.scores[String(t.testId)];
                            return (
                              <td key={t.testId} className="tabular-nums">
                                {v == null ? "—" : v}
                              </td>
                            );
                          })}
                          {pp?.paired && (
                            <td className="pr-5 font-semibold tabular-nums">
                              {change !== null ? (
                                <span className={cx(change > 0 && "text-success", change < 0 && "text-danger")}>{signed(change, 0)}</span>
                              ) : missing ? (
                                <span className="inline-flex h-[25px] items-center rounded-full bg-[#e9eaee] px-3 text-[12px] font-semibold text-gray-800">Not taken</span>
                              ) : (
                                <span className="font-normal text-faint">—</span>
                              )}
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

/** "n = 46 · min 2 · max 10" (Figma stat-card note). */
function statLine(s: { n: number; min?: number | null; max?: number | null }) {
  return s.min != null && s.max != null ? `n = ${s.n} · min ${s.min} · max ${s.max}` : `n = ${s.n}`;
}

/** "2569/1 · Section 1" → "Sec 1" (Figma scores table). */
function shortSection(className: string) {
  const m = /Section\s+(\d+)/.exec(className);
  return m ? `Sec ${m[1]}` : className;
}

function shortKind(t: { kind: TestKind; title: string } | undefined) {
  if (!t) return "";
  return t.kind === "pretest" ? "Pretest" : t.kind === "posttest" ? "Posttest" : t.title;
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

  const chosen = tests.filter((t) => selected.includes(t.id));
  const kinds = chosen.map((t) => t.kind);
  // Figma shows "Pretest + Posttest" for the default pair; otherwise list titles or a count.
  const summary =
    chosen.length === 0
      ? "None"
      : chosen.length === 2 && kinds.includes("pretest") && kinds.includes("posttest")
        ? "Pretest + Posttest"
        : chosen.length <= 2
          ? chosen.map((t) => t.title).join(", ")
          : `${chosen.length} tests`;

  return (
    <div ref={ref} className="relative w-full sm:w-[279px]">
      <span id={labelId} className="sr-only">
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
        className="relative flex h-[43px] w-full items-center gap-1.5 rounded-[11.5px] border border-line bg-surface pl-4 pr-9 text-left outline-none focus:border-gray-800"
      >
        <span className="text-[13px] text-muted">Tests:</span>
        <span id={`${listId}-sum`} className="truncate text-[14px] font-semibold text-ink">
          {summary}
        </span>
        <IconChevronDown size={12} strokeWidth={3} className="absolute right-3.5 shrink-0 text-faint" />
      </button>
      {open && (
        <div id={listId} className="absolute z-20 mt-1 max-h-72 w-full min-w-64 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          <fieldset>
            <legend className="sr-only">Tests to include (up to {MAX_PICKED_TESTS})</legend>
            {selected.length >= MAX_PICKED_TESTS && <p className="px-2.5 py-1.5 text-xs text-muted">Up to {MAX_PICKED_TESTS} tests at a time.</p>}
            {tests.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-zinc-50">
                <input
                  type="checkbox"
                  className="size-4 accent-tests"
                  checked={selected.includes(t.id)}
                  disabled={!selected.includes(t.id) && selected.length >= MAX_PICKED_TESTS}
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
