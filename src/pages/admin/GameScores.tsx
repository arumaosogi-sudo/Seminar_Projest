import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GAME_IDS, type AdminClass, type AdminGameResults } from "@shared/contract";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, PageHeader, PageLoader } from "@/components/ui";
import { useAdminClass } from "@/components/admin/adminClass";
import { FilterSelect, QueryError, SearchBox, StatCard, StatusChip } from "@/components/admin/controls";
import { errorMessage, fmtNum, formatDateTime, slugify, todayStamp } from "@/components/admin/format";
import { IconDownload } from "@/components/admin/icons";
import { adminKeys } from "@/components/admin/keys";
import { useToast } from "@/components/admin/toastContext";
import { LiveIndicator, useLiveInterval } from "@/components/admin/live";

type StatusFilter = "active" | "all";

/** GAME-7: collected game score — each student's best run out of 10 per Muscle Games game, and the total. */
export default function GameScores() {
  const { classId: currentId } = useAdminClass();
  const toast = useToast();
  const classesQ = useQuery({ queryKey: adminKeys.classes("all"), queryFn: () => api.get<AdminClass[]>("/admin/classes?status=all") });
  const [classSel, setClassSel] = useState<string | null>(null); // null = follow the sidebar's current class
  const [status, setStatus] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const classValue = classSel ?? (currentId ? String(currentId) : "all");
  const classId = classValue === "all" ? null : Number(classValue);
  const q = useQuery({
    queryKey: adminKeys.gameResults(classId, status),
    queryFn: () =>
      api.get<AdminGameResults>(`/admin/game-results?${new URLSearchParams({ ...(classId ? { classId: String(classId) } : {}), status })}`),
    placeholderData: (prev) => prev,
    refetchInterval: useLiveInterval(30_000), // only while "Live" is on — scores arrive while students play
  });

  const classes = classesQ.data ?? [];
  const classLabel = classId ? (classes.find((c) => c.id === classId)?.name ?? `Class ${classId}`) : "All classes";
  const data = q.data;
  const totalMax = data ? data.maxScore * data.games.length : 0;
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => !term || r.studentCode.includes(term) || (r.firstName ?? "").toLowerCase().includes(term));
  }, [data, search]);

  async function onExport() {
    if (!data) return;
    setExporting(true);
    try {
      // No e-mail addresses are exported (PDPA), same as the Results export.
      const XLSX = await import("xlsx");
      const header = [
        "Student ID",
        "First name",
        "Section",
        "Status",
        ...data.games.flatMap((g) => [`${g.label} (/${data.maxScore})`, `${g.label} plays`]),
        `Total (/${totalMax})`,
      ];
      const body = data.rows.map((r) => [
        r.studentCode,
        r.firstName ?? "",
        r.className,
        r.enrollmentStatus === "active" ? "Active" : "Withdrawn",
        ...GAME_IDS.flatMap((id) => {
          const g = r.games[id];
          return g ? [g.best, g.plays] : [null, 0];
        }),
        r.total,
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...body]), "Game scores");
      const name = `digital-muscle-games-${slugify(classLabel)}-${todayStamp()}.xlsx`;
      XLSX.writeFile(wb, name, { compression: true });
      toast.show(`Exported ${name}`, "success");
    } catch (e) {
      toast.show(`Export failed: ${errorMessage(e)}`, "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Game scores"
        subtitle="Collected score: best run out of 10 in each game · separate from pretest / posttest scores"
        actions={
          <>
            <LiveIndicator updatedAt={q.dataUpdatedAt} fetching={q.isFetching} onRefresh={() => void q.refetch()} />
            <Button
              accent="success"
              size="lg"
              className="whitespace-nowrap rounded-xl"
              onClick={() => void onExport()}
              loading={exporting}
              disabled={!data}
            >
              <IconDownload size={18} /> Export Excel
            </Button>
          </>
        }
      />

      <div className="mb-[25px] flex flex-wrap items-center gap-[13px]">
        <FilterSelect label="Class" value={classValue} onChange={setClassSel} display={classLabel} className="w-full sm:w-[239px]">
          <option value="all">All active classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status === "archived" ? " (archived)" : ""}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          display={status === "active" ? "Active only" : "Include withdrawn"}
          className="w-full sm:w-[199px]"
        >
          <option value="active">Active only</option>
          <option value="all">Include withdrawn</option>
        </FilterSelect>
        <SearchBox value={search} onChange={setSearch} placeholder="Student ID or name" />
      </div>

      {q.isPending || classesQ.isPending ? (
        <PageLoader />
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => void q.refetch()} what="game scores" />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState title="No students yet">Game scores appear here once students in this class play the games.</EmptyState>
      ) : (
        <div className="space-y-[25px]">
          <div className="grid gap-[17px] sm:grid-cols-2 xl:grid-cols-4">
            {data.games.map((g) => (
              <StatCard
                key={g.gameId}
                label={g.label}
                value={g.meanBest === null ? "—" : `${fmtNum(g.meanBest)}/${data.maxScore}`}
                sub={`mean best · ${g.players}/${data.rows.length} students · ${g.plays} plays`}
              />
            ))}
            <StatCard
              label="Total"
              value={`${fmtNum(data.rows.reduce((n, r) => n + r.total, 0) / data.rows.length)}/${totalMax}`}
              sub={`mean total · ${data.rows.length} students`}
            />
          </div>
          <Card className="overflow-hidden">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <caption className="sr-only">Game scores per student</caption>
                <thead>
                  <tr className="border-b border-line text-left text-[11px] tracking-wider text-muted uppercase">
                    <th scope="col" className="px-5 py-3 font-semibold">Student ID</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Name</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Section</th>
                    {data.games.map((g) => (
                      <th key={g.gameId} scope="col" className="px-3 py-3 text-right font-semibold">
                        {g.label}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Total /{totalMax}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.className}-${r.studentCode}`} className="border-b border-line last:border-b-0 hover:bg-zinc-50">
                      <td className="px-5 py-3 tabular-nums">
                        {r.studentCode} {r.enrollmentStatus === "withdrawn" && <StatusChip tone="neutral">Withdrawn</StatusChip>}
                      </td>
                      <td className="px-3 py-3">{r.firstName ?? "—"}</td>
                      <td className="px-3 py-3 text-muted">{r.className}</td>
                      {GAME_IDS.map((id) => {
                        const g = r.games[id];
                        return (
                          <td key={id} className="px-3 py-3 text-right tabular-nums" title={g ? `Last played ${formatDateTime(g.lastPlayedAt)}` : undefined}>
                            {g ? (
                              <>
                                <span className="font-semibold text-ink">{fmtNum(g.best)}</span>
                                <span className="text-muted">/{data.maxScore}</span>
                                <span className="block text-[11px] text-muted">{g.plays} plays</span>
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-5 py-3 text-right font-semibold text-ink tabular-nums">{fmtNum(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
