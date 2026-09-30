/**
 * Excel export for Results / Students (ADM-6). `xlsx` is imported dynamically so SheetJS
 * (~400 KB) only downloads when someone actually clicks "Export".
 * No e-mail addresses are exported (PDPA: Student ID, first name, section, scores only).
 */
import type { AdminResults, AdminTestSummary } from "@shared/contract";
import { api } from "@/lib/api";
import { kindLabel, slugify, todayStamp } from "./format";

export interface ExportOptions {
  /** Label used in the file name and summary sheet, e.g. "2569/1 · Section 1" or "All classes". */
  classLabel: string;
  includeWithdrawn: boolean;
}

type Row = AdminResults["rows"][number];

/** Index of the (single) pretest and posttest used for the paired change column. */
export function prePost(results: Pick<AdminResults, "tests">) {
  const pre = results.tests.filter((t) => t.kind === "pretest");
  const post = results.tests.filter((t) => t.kind === "posttest");
  return { pre: pre.length === 1 ? pre[0] : (pre[0] ?? null), post: post.length === 1 ? post[0] : (post[0] ?? null), paired: pre.length === 1 && post.length === 1 };
}

export function rowChange(row: Row, preId: number | undefined, postId: number | undefined): number | null {
  if (preId === undefined || postId === undefined) return null;
  const a = row.scores[String(preId)];
  const b = row.scores[String(postId)];
  return a === null || a === undefined || b === null || b === undefined ? null : b - a;
}

export function buildScoresSheet(results: AdminResults, includeWithdrawn: boolean): (string | number | null)[][] {
  const { pre, post, paired } = prePost(results);
  const header: string[] = ["Student ID", "First name", "Section", "Status", ...results.tests.map((t) => `${t.title} (/${t.maxScore})`)];
  if (paired) header.push("Change");
  const rows = results.rows
    .filter((r) => includeWithdrawn || r.enrollmentStatus === "active")
    .map((r) => {
      const line: (string | number | null)[] = [r.studentCode, r.firstName ?? "", r.className, r.enrollmentStatus === "active" ? "Active" : "Withdrawn"];
      for (const t of results.tests) {
        const v = r.scores[String(t.testId)];
        line.push(v === null || v === undefined ? "Not taken" : v);
      }
      if (paired) line.push(rowChange(r, pre?.testId, post?.testId));
      return line;
    });
  return [header, ...rows];
}

export function buildSummarySheet(results: AdminResults, opts: ExportOptions): (string | number | null)[][] {
  const round = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);
  const out: (string | number | null)[][] = [
    ["Digital Muscle — results export"],
    ["Class", opts.classLabel],
    ["Exported at", new Date().toLocaleString("en-GB")],
    ["Withdrawn students in Scores sheet", opts.includeWithdrawn ? "Included" : "Excluded"],
    [],
    ["Test", "Kind", "n", "Mean", "SD", "Min", "Max", "Max score"],
  ];
  for (const t of results.tests) {
    out.push([t.title, kindLabel[t.kind], t.stats.n, round(t.stats.mean), round(t.stats.sd), t.stats.min, t.stats.max, t.maxScore]);
  }
  if (results.paired) {
    out.push([], ["Paired pretest → posttest"], ["n (took both)", results.paired.n], ["Mean gain", round(results.paired.meanGain)], ["Improved", results.paired.improved]);
  }
  return out;
}

export function resultsFileName(classLabel: string, d: Date = new Date()): string {
  return `digital-muscle-results-${slugify(classLabel)}-${todayStamp(d)}.xlsx`;
}

export async function exportResultsToExcel(results: AdminResults, opts: ExportOptions): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const scores = XLSX.utils.aoa_to_sheet(buildScoresSheet(results, opts.includeWithdrawn));
  scores["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 11 }, ...results.tests.map(() => ({ wch: 18 })), { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, scores, "Scores");
  const summary = XLSX.utils.aoa_to_sheet(buildSummarySheet(results, opts));
  summary["!cols"] = [{ wch: 32 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, summary, "Summary");
  const name = resultsFileName(opts.classLabel);
  XLSX.writeFile(wb, name, { compression: true });
  return name;
}

/** Latest pretest + latest posttest (fallback: the two most recently updated tests). */
export function defaultTestIds(tests: AdminTestSummary[]): number[] {
  const byRecent = [...tests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pre = byRecent.find((t) => t.kind === "pretest");
  const post = byRecent.find((t) => t.kind === "posttest");
  const ids = [pre?.id, post?.id].filter((x): x is number => x !== undefined);
  return ids.length ? ids : byRecent.slice(0, 2).map((t) => t.id);
}

/**
 * Export every test's scores for one class (withdrawn included) — used by the Students page
 * before irreversible delete/anonymize (data-retention level 3 requires an export first).
 * Resolves to the file name, or null when the class has no assigned tests (so there are no scores to lose).
 */
export async function exportWholeClass(classId: number, classLabel: string): Promise<string | null> {
  // Without testIds the API returns every test assigned to the class.
  const results = await api.get<AdminResults>(`/admin/results?${new URLSearchParams({ classId: String(classId), status: "all" })}`);
  if (results.tests.length === 0) return null; // no tests assigned → no scores to lose
  return exportResultsToExcel(results, { classLabel, includeWithdrawn: true });
}
