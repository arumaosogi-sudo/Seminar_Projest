import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminClass, AdminStudentRow } from "@shared/contract";
import { api } from "@/lib/api";
import { Button, Card, cx, EmptyState, ErrorNote, PageHeader, PageLoader, Spinner } from "@/components/ui";
import { useAdminClass } from "@/components/admin/adminClass";
import { FilterPills, QueryError, SearchBox, StatusChip } from "@/components/admin/controls";
import { MAX_ROSTER_ENTRIES, parseRosterCsv, type RosterParseResult } from "@/components/admin/csv";
import { exportWholeClass } from "@/components/admin/exportResults";
import { findOtherEnrollments } from "@/components/admin/students";
import { errorMessage, formatDateTime } from "@/components/admin/format";
import { adminKeys } from "@/components/admin/keys";
import { RowMenu } from "@/components/admin/Menu";
import { ConfirmDialog, Modal } from "@/components/admin/Modal";
import { useToast } from "@/components/admin/toastContext";

// The section comes from the sidebar's "Current class" (Figma has no class picker on this page).
type Filter = "active" | "withdrawn" | "not_joined" | "all";

const rowKey = (r: AdminStudentRow) => (r.enrollmentId !== null ? `e${r.enrollmentId}` : `r${r.studentCode}`);

function StatusBadge({ status }: { status: AdminStudentRow["status"] }) {
  if (status === "active") return <StatusChip tone="success">Active</StatusChip>;
  if (status === "withdrawn") return <StatusChip tone="neutral">Withdrawn</StatusChip>;
  return <StatusChip tone="neutral">Not joined</StatusChip>;
}

export default function Students() {
  const { classes, classId, currentClass, loading } = useAdminClass();

  if (loading) return <PageLoader />;
  if (!classId || !currentClass)
    return (
      <>
        <PageHeader title="Students" />
        <EmptyState title="No classes yet — create the first section" action={<Link to="/admin/classes" className="font-semibold underline">Go to Classes</Link>}>
          Students appear here after they scan a section’s QR code.
        </EmptyState>
      </>
    );
  return <StudentsForClass key={classId} cls={currentClass} classes={classes} />;
}

function StudentsForClass({ cls, classes }: { cls: AdminClass; classes: AdminClass[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: adminKeys.students(cls.id, "all"),
    queryFn: () => api.get<AdminStudentRow[]>(`/admin/students?${new URLSearchParams({ classId: String(cls.id), status: "all" })}`),
  });
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [danger, setDanger] = useState<null | "anonymize" | "delete">(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [deleteBlockedBy, setDeleteBlockedBy] = useState<AdminStudentRow[] | null>(null);

  /** Delete wipes attempts in every section, but the export covers only this one → block when enrolled elsewhere. */
  async function requestDelete(r: AdminStudentRow) {
    if (r.studentId === null) return;
    setCheckingDelete(true);
    try {
      const others = await findOtherEnrollments({ studentId: r.studentId, studentCode: r.studentCode }, cls.id);
      if (others.length > 0) setDeleteBlockedBy(others);
      else setDanger("delete");
    } catch (e) {
      toast.show(`Couldn’t check the student’s other sections: ${errorMessage(e)}`, "error");
    } finally {
      setCheckingDelete(false);
    }
  }

  const all = useMemo(() => q.data ?? [], [q.data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { active: 0, withdrawn: 0, not_joined: 0, all: all.length };
    for (const r of all) c[r.status]++;
    return c;
  }, [all]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => !term || r.studentCode.includes(term) || (r.firstName ?? "").toLowerCase().includes(term) || (r.email ?? "").toLowerCase().includes(term))
      .sort((a, b) => a.studentCode.localeCompare(b.studentCode));
  }, [all, filter, search]);
  const selected = all.find((r) => rowKey(r) === selectedKey) ?? null;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.studentsRoot });
    void qc.invalidateQueries({ queryKey: adminKeys.classesRoot });
    void qc.invalidateQueries({ queryKey: adminKeys.resultsRoot });
  };

  const setStatus = useMutation({
    mutationFn: ({ r, status }: { r: AdminStudentRow; status: "active" | "withdrawn" }) => api.patch<unknown>(`/admin/enrollments/${r.enrollmentId}`, { status }),
    onSuccess: (_d, { r, status }) => {
      toast.show(status === "withdrawn" ? `${r.studentCode} withdrawn — hidden from results, data kept` : `${r.studentCode} reactivated`, "success");
      invalidate();
    },
    onError: (e) => toast.show(errorMessage(e), "error"),
  });

  const removal = useMutation({
    mutationFn: ({ r, kind }: { r: AdminStudentRow; kind: "anonymize" | "delete" }) =>
      kind === "anonymize" ? api.post<unknown>(`/admin/students/${r.studentId}/anonymize`) : api.del<unknown>(`/admin/students/${r.studentId}`),
    onSuccess: (_d, { r, kind }) => {
      toast.show(kind === "anonymize" ? `${r.studentCode} anonymized — scores kept without identity` : `${r.studentCode} and all their data deleted`, "success");
      setDanger(null);
      setSelectedKey(null);
      invalidate();
    },
  });

  async function onExport() {
    setExporting(true);
    try {
      const name = await exportWholeClass(cls.id, cls.name);
      setExported(true);
      toast.show(name ? `Exported ${name}` : "No tests are assigned to this class, so there are no scores to export.", "success");
    } catch (e) {
      toast.show(`Export failed: ${errorMessage(e)}`, "error");
    } finally {
      setExporting(false);
    }
  }

  const withdrawn = counts.withdrawn;
  const pills: { value: Filter; label: string }[] = [
    { value: "active", label: `Active (${counts.active})` },
    { value: "withdrawn", label: `Withdrawn (${withdrawn})` },
    // Not in the Figma frame; only shown when roster students haven't joined yet so they stay reachable.
    ...(counts.not_joined > 0 ? [{ value: "not_joined" as Filter, label: `Not joined (${counts.not_joined})` }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${cls.name} · ${counts.active} active · ${withdrawn} withdrawn`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="h-[43px] whitespace-nowrap rounded-[11.5px] border border-line bg-surface px-5 text-[15px] font-semibold text-ink hover:bg-zinc-50"
            >
              Import roster (CSV)
            </button>
          </>
        }
      />

      <div className="grid items-start gap-[25px] xl:grid-cols-[minmax(0,1fr)_339px]">
        <Card className="min-w-0 px-[19px] pb-[15px] pt-[17px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterPills<Filter> label="Filter by status" value={filter} onChange={setFilter} options={pills} />
            <div className="w-full sm:w-[239px]">
              <SearchBox value={search} onChange={setSearch} placeholder="Search ID or name..." label="Search by student ID, name or e-mail" />
            </div>
          </div>

          {q.isPending ? (
            <PageLoader />
          ) : q.isError ? (
            <div className="mt-4">
              <QueryError error={q.error} onRetry={() => void q.refetch()} what="students" />
            </div>
          ) : all.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No students yet" action={<Button onClick={() => setImportOpen(true)}>Import roster (CSV)</Button>}>
                Share the section’s QR code from <Link to="/admin/classes" className="underline">Classes</Link> — students appear here after they sign in.
              </EmptyState>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No students match.</p>
          ) : (
            <div className="relative -mx-[19px] mt-[28px] overflow-x-auto">
              <table className="w-full min-w-[640px] table-fixed text-[14px]">
                <caption className="sr-only">Students in {cls.name}</caption>
                <colgroup>
                  <col className="w-[167px]" />
                  <col className="w-[167px]" />
                  <col className="w-[199px]" />
                  <col />
                  <col className="w-[64px]" />
                </colgroup>
                <thead>
                  <tr className="text-left text-[12px] uppercase text-faint">
                    <th scope="col" className="pb-[14px] pl-5 font-semibold">Student ID</th>
                    <th scope="col" className="pb-[14px] font-semibold">First name</th>
                    <th scope="col" className="pb-[14px] font-semibold">Joined</th>
                    <th scope="col" className="pb-[14px] font-semibold">Status</th>
                    <th scope="col" className="pb-[14px] pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const k = rowKey(r);
                    const isSel = k === selectedKey;
                    return (
                      <tr
                        key={k}
                        tabIndex={0}
                        aria-selected={isSel}
                        onClick={() => setSelectedKey(k)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedKey(k);
                          }
                        }}
                        className="h-[52.5px] cursor-pointer text-ink outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50"
                      >
                        <td className="pl-5 tabular-nums">{r.studentCode}</td>
                        <td className="truncate pr-3">{r.firstName ?? <span className="text-faint">—</span>}</td>
                        <td className="tabular-nums" title={formatDateTime(r.joinedAt)}>
                          {joinedLabel(r.joinedAt)}
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="pr-5 text-right">
                          <RowMenu
                            label={`Actions for ${r.studentCode}`}
                            active={isSel}
                            items={[
                              { label: "Select", onSelect: () => setSelectedKey(k) },
                              ...(r.status === "active"
                                ? [{ label: "Withdraw", onSelect: () => setStatus.mutate({ r, status: "withdrawn" }) }]
                                : r.status === "withdrawn"
                                  ? [{ label: "Reactivate", onSelect: () => setStatus.mutate({ r, status: "active" }) }]
                                  : []),
                              ...(r.enrollmentId !== null ? [{ label: "Move to section…", onSelect: () => setSelectedKey(k) }] : []),
                              ...(r.studentId !== null
                                ? [
                                    {
                                      label: "Delete / anonymize…",
                                      danger: true,
                                      onSelect: () => {
                                        setSelectedKey(k);
                                        setRemoveOpen(true);
                                      },
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-[17px]">
          <StudentActions
            key={selected ? rowKey(selected) : "none"}
            r={selected}
            cls={cls}
            classes={classes}
            busy={setStatus.isPending}
            onStatus={(status) => selected && setStatus.mutate({ r: selected, status })}
            onMoved={() => {
              setSelectedKey(null);
              invalidate();
            }}
          />

          <section className="rounded-[20px] border border-red-200 bg-surface px-[21px] pb-6 pt-6" aria-labelledby="retention-title">
            <h2 id="retention-title" className="text-[12px] font-semibold uppercase leading-4 text-red-700">
              Data retention
            </h2>
            <ol className="mt-[17px] space-y-[13px]">
              {[
                { n: 1, title: "Withdraw", sub: "Per student · reversible" },
                { n: 2, title: "Archive class", sub: "Whole section read-only · reversible" },
                { n: 3, title: "Delete / anonymize", sub: "Export required first · type the student ID to confirm · not reversible", danger: true },
              ].map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span
                    className={cx(
                      "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
                      s.danger ? "bg-danger-soft text-red-700" : "bg-[#f0f0f2] text-muted",
                    )}
                  >
                    {s.n}
                  </span>
                  <span>
                    <span className={cx("block text-[13px] font-semibold leading-5", s.danger ? "text-red-700" : "text-ink")}>{s.title}</span>
                    <span className="block text-[12px] leading-[17px] text-muted">{s.sub}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-[17px] text-[12px] leading-[17px] text-muted">Every move / withdraw / delete is written to the audit log.</p>
          </section>
        </div>
      </div>

      {/* Step 3 flow — export first, then anonymize or delete (opened from the row menu) */}
      <Modal
        open={removeOpen && !!selected}
        onClose={() => setRemoveOpen(false)}
        title={selected ? `Delete or anonymize ${selected.studentCode}` : "Delete or anonymize"}
        size="sm"
        footer={
          <Button variant="outline" onClick={() => setRemoveOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-sm text-zinc-700">
          <p>
            Irreversible. <strong>Anonymize</strong> removes the ID, name and e-mail but keeps the scores; <strong>Delete</strong> removes the student and all their attempts.
          </p>
          <Button block variant={exported ? "outline" : "solid"} accent="success" loading={exporting} onClick={() => void onExport()}>
            {exported ? "✓ Exported — export again" : `1 · Export ${cls.name} first`}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={!exported} onClick={() => setDanger("anonymize")} title={!exported ? "Export the class first" : undefined}>
              Anonymize
            </Button>
            <Button
              accent="danger"
              disabled={!exported}
              loading={checkingDelete}
              onClick={() => selected && void requestDelete(selected)}
              title={!exported ? "Export the class first" : undefined}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteBlockedBy !== null}
        onClose={() => setDeleteBlockedBy(null)}
        title="Can’t delete this student here"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteBlockedBy(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setDeleteBlockedBy(null);
                setDanger("anonymize");
              }}
            >
              Anonymize instead
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-zinc-700">
          <p>
            Deleting removes this student’s attempts in <strong>every</strong> section, but your export only covers {cls.name}. They’re also enrolled in:
          </p>
          <ul className="list-disc pl-5">
            {(deleteBlockedBy ?? []).map((r) => (
              <li key={r.enrollmentId ?? r.classId}>
                {r.className} <span className="text-muted">({r.status === "active" ? "active" : "withdrawn"})</span>
              </li>
            ))}
          </ul>
          <p>Use <strong>Anonymize</strong> instead: it removes the student’s ID, name and e-mail everywhere and keeps the scores, so nothing in those sections is lost.</p>
        </div>
      </Modal>

      <ImportRosterModal open={importOpen} onClose={() => setImportOpen(false)} cls={cls} onImported={invalidate} />

      {selected && (
        <ConfirmDialog
          open={danger !== null}
          onClose={() => {
            setDanger(null);
            removal.reset();
          }}
          onConfirm={() => {
            if (danger) removal.mutate({ r: selected, kind: danger });
          }}
          loading={removal.isPending}
          error={removal.isError ? errorMessage(removal.error) : null}
          title={danger === "delete" ? `Delete ${selected.studentCode}?` : `Anonymize ${selected.studentCode}?`}
          confirmLabel={danger === "delete" ? "Delete permanently" : "Anonymize"}
          accent="danger"
          confirmText={selected.studentCode}
          confirmTextLabel={`Type the student ID ${selected.studentCode} to confirm`}
        >
          {danger === "delete" ? (
            <p>
              This permanently deletes <strong>{selected.firstName ?? selected.studentCode}</strong>, their enrollments and every test attempt, in all sections. It can’t be
              undone.
            </p>
          ) : (
            <p>
              This removes the student ID, first name and e-mail of <strong>{selected.firstName ?? selected.studentCode}</strong>. Their scores stay in the statistics without
              identity. The student can no longer sign in. It can’t be undone.
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Figma: "24 Sep 2026, 13:02" (local time). */
function joinedLabel(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ───────────────────────── Actions panel (Figma "Actions · NAME (ID)") ───────────────────────── */

function StudentActions({
  r,
  cls,
  classes,
  busy,
  onStatus,
  onMoved,
}: {
  r: AdminStudentRow | null;
  cls: AdminClass;
  classes: AdminClass[];
  busy: boolean;
  onStatus: (s: "active" | "withdrawn") => void;
  onMoved: () => void;
}) {
  const toast = useToast();
  const moveSelectRef = useRef<HTMLSelectElement>(null);
  const others = classes.filter((c) => c.id !== cls.id);
  const [target, setTarget] = useState<string>(others[0] ? String(others[0].id) : "");
  const move = useMutation({
    mutationFn: () => api.post<unknown>(`/admin/enrollments/${r?.enrollmentId}/move`, { classId: Number(target) }),
    onSuccess: () => {
      const to = classes.find((c) => c.id === Number(target));
      toast.show(`${r?.studentCode} moved to ${to?.name ?? "the new section"} (scores moved too)`, "success");
      onMoved();
    },
  });

  const tile = "block w-full rounded-[10px] bg-app px-3 py-[9px] text-left transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section className="rounded-[20px] border border-line bg-surface px-[21px] pb-[21px] pt-6" aria-labelledby="student-actions-title">
      <h2 id="student-actions-title" className="truncate text-[12px] font-semibold uppercase leading-4 text-faint">
        {r ? `Actions · ${r.firstName ?? "No name"} (${r.studentCode})` : "Actions"}
      </h2>

      {!r ? (
        <p className="mt-3 text-[13px] text-muted">Select a student in the table to move, withdraw or reactivate them.</p>
      ) : r.enrollmentId === null ? (
        <p className="mt-3 rounded-[10px] bg-app p-3 text-[13px] text-muted">
          On the roster but hasn’t joined yet. They’ll appear as active after scanning this section’s QR code.
        </p>
      ) : (
        <>
          <div className="mt-[14px] space-y-1">
            <button type="button" className={tile} disabled={others.length === 0} onClick={() => moveSelectRef.current?.focus()}>
              <span className="block text-[13px] font-semibold leading-5 text-ink">Move to another section</span>
              <span className="block text-[12px] leading-4 text-muted">Scores move with the student</span>
            </button>
            <button type="button" className={tile} disabled={busy} onClick={() => onStatus(r.status === "active" ? "withdrawn" : "active")}>
              <span className="block text-[13px] font-semibold leading-5 text-ink">{r.status === "active" ? "Withdraw" : "Reactivate"}</span>
              <span className="block text-[12px] leading-4 text-muted">
                {r.status === "active" ? "Hidden from dashboard, can't log in · reversible" : "Shows in results again and can sign in"}
              </span>
            </button>
          </div>

          {others.length === 0 ? (
            <p className="mt-4 text-[12px] text-muted">There’s no other active section to move to.</p>
          ) : (
            <>
              <label htmlFor="move-target" className="mt-[18px] block text-[13px] font-semibold leading-5 text-ink">
                Move to
              </label>
              <div className="relative mt-2">
                <select
                  ref={moveSelectRef}
                  id="move-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="h-[43px] w-full cursor-pointer appearance-none rounded-[11.5px] border border-line bg-surface pl-[15px] pr-9 text-[14px] text-ink outline-none focus:border-gray-800"
                >
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3.5 top-1/2 size-3 -translate-y-1/2 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
              <button
                type="button"
                onClick={() => move.mutate()}
                disabled={!target || move.isPending}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {move.isPending && <Spinner className="size-4" />}
                Move student
              </button>
              {move.isError && (
                <div className="mt-2">
                  <ErrorNote>{errorMessage(move.error)}</ErrorNote>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

/* ───────────────────────── Roster import ───────────────────────── */

function ImportRosterModal({ open, onClose, cls, onImported }: { open: boolean; onClose: () => void; cls: AdminClass; onImported: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<RosterParseResult | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (entries: RosterParseResult["entries"]) => api.post<unknown>(`/admin/classes/${cls.id}/roster`, { mode: "append", entries }),
    onSuccess: (_d, entries) => {
      toast.show(`Added ${entries.length} student${entries.length === 1 ? "" : "s"} to the ${cls.name} roster`, "success");
      onImported();
      close();
    },
  });

  function close() {
    setFileName(null);
    setParsed(null);
    setReadError(null);
    upload.reset();
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setParsed(null);
    setReadError(null);
    upload.reset();
    if (!f) return;
    setFileName(f.name);
    if (f.size > 2 * 1024 * 1024) {
      setReadError("That file is larger than 2 MB — is it really a roster CSV?");
      return;
    }
    try {
      setParsed(parseRosterCsv(await f.text()));
    } catch {
      setReadError("Couldn’t read the file. Save it as CSV (UTF-8) and try again.");
    }
  }

  const tooMany = (parsed?.entries.length ?? 0) > MAX_ROSTER_ENTRIES;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import roster (CSV)"
      description={`Adds students to the ${cls.name} roster (existing entries are kept).`}
      busy={upload.isPending}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => parsed && upload.mutate(parsed.entries)}
            loading={upload.isPending}
            disabled={!parsed || parsed.entries.length === 0 || tooMany}
          >
            Add {parsed?.entries.length ?? 0} student{parsed?.entries.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Columns: <code className="rounded bg-zinc-100 px-1">student_code</code> (8–12 digits) and optional <code className="rounded bg-zinc-100 px-1">first_name</code>.
          Headers like “Student ID” / “First name” work too.
        </p>
        <label className="block">
          <span className="mb-1.5 block font-semibold">CSV file</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => void onFile(e)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
        </label>
        {readError && <ErrorNote>{readError}</ErrorNote>}
        {parsed && (
          <div className="rounded-xl border border-line p-4" aria-live="polite">
            <p className="font-semibold">
              {fileName}: {parsed.entries.length} valid student{parsed.entries.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {parsed.duplicates > 0 && <li>{parsed.duplicates} duplicate row(s) skipped</li>}
              {parsed.invalid.length > 0 && (
                <li className="text-danger">
                  {parsed.invalid.length} row(s) without a valid student ID skipped (e.g. line {parsed.invalid[0].line}: “{parsed.invalid[0].value.slice(0, 40)}”)
                </li>
              )}
              {!parsed.headerDetected && <li>No header row detected — using column 1 as student ID and column 2 as first name.</li>}
            </ul>
            {parsed.entries.length > 0 && (
              <table className="mt-3 w-full text-xs">
                <caption className="sr-only">Preview of the first rows</caption>
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col" className="py-1 font-semibold">Student ID</th>
                    <th scope="col" className="py-1 font-semibold">First name</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.entries.slice(0, 5).map((e) => (
                    <tr key={e.studentCode} className="border-t border-line">
                      <td className="py-1 font-mono">{e.studentCode}</td>
                      <td className="py-1">{e.firstName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tooMany && <p className="mt-2 text-xs text-danger">A roster can have at most {MAX_ROSTER_ENTRIES} students per upload.</p>}
          </div>
        )}
        <p className="rounded-xl bg-app p-3 text-xs text-muted">
          To let <em>only</em> these students join, turn on “Only students on the roster can join” for this class in{" "}
          <Link to="/admin/classes" className="underline">
            Classes → Edit
          </Link>
          . It’s currently <strong>{cls.restrictToRoster ? "on" : "off"}</strong>.
        </p>
        {upload.isError && <ErrorNote>{errorMessage(upload.error)}</ErrorNote>}
      </div>
    </Modal>
  );
}
