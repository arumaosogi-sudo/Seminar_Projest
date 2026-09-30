import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminClass, AdminStudentRow } from "@shared/contract";
import { api } from "@/lib/api";
import { Badge, Button, Card, cx, DraftBadge, EmptyState, ErrorNote, PageHeader, PageLoader, Select } from "@/components/ui";
import { useAdminClass } from "@/components/admin/adminClass";
import { CardTitle, QueryError, SearchBox } from "@/components/admin/controls";
import { MAX_ROSTER_ENTRIES, parseRosterCsv, type RosterParseResult } from "@/components/admin/csv";
import { exportWholeClass } from "@/components/admin/exportResults";
import { errorMessage, formatDate, formatDateTime, relativeTime } from "@/components/admin/format";
import { IconUpload } from "@/components/admin/icons";
import { adminKeys } from "@/components/admin/keys";
import { RowMenu } from "@/components/admin/Menu";
import { ConfirmDialog, Modal } from "@/components/admin/Modal";
import { useToast } from "@/components/admin/toastContext";

type Filter = "active" | "withdrawn" | "not_joined" | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "not_joined", label: "Not joined" },
  { value: "all", label: "All" },
];

const rowKey = (r: AdminStudentRow) => (r.enrollmentId !== null ? `e${r.enrollmentId}` : `r${r.studentCode}`);

function StatusBadge({ status }: { status: AdminStudentRow["status"] }) {
  if (status === "active") return <Badge tone="success">Active</Badge>;
  if (status === "withdrawn") return <Badge>Withdrawn</Badge>;
  return <Badge className="border border-line bg-transparent text-muted">Not joined</Badge>;
}

export default function Students() {
  const { classes, classId, currentClass, setClassId, loading } = useAdminClass();

  if (loading) return <PageLoader />;
  if (!classId || !currentClass)
    return (
      <>
        <PageHeader title="Students" actions={<DraftBadge />} />
        <EmptyState title="No classes yet — create the first section" action={<Link to="/admin/classes" className="font-semibold underline">Go to Classes</Link>}>
          Students appear here after they scan a section’s QR code.
        </EmptyState>
      </>
    );
  return <StudentsForClass key={classId} cls={currentClass} classes={classes} onClassChange={setClassId} />;
}

function StudentsForClass({ cls, classes, onClassChange }: { cls: AdminClass; classes: AdminClass[]; onClassChange: (id: number) => void }) {
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
  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${cls.name} · ${counts.active} active · ${withdrawn} withdrawn`}
        actions={
          <>
            <DraftBadge />
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <IconUpload size={16} /> Import roster (CSV)
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cx(
                    "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                    filter === f.value ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600 hover:text-ink",
                  )}
                >
                  {f.label} <span className="font-normal opacity-70">{counts[f.value]}</span>
                </button>
              ))}
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <div className="w-full sm:w-52">
                <Select name="students-class" aria-label="Class" value={cls.id} onChange={(e) => onClassChange(Number(e.target.value))}>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-56">
                <SearchBox value={search} onChange={setSearch} placeholder="Student ID, name, e-mail" label="Search students" />
              </div>
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
            <div className="-mx-5 mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">Students in {cls.name}</caption>
                <thead>
                  <tr className="border-b border-line text-left text-[11px] tracking-wider text-muted uppercase">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Student ID</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">First name</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Joined</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                    <th scope="col" className="w-12 px-5 py-2.5">
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
                        className={cx("cursor-pointer border-b border-line outline-none last:border-b-0 focus-visible:bg-zinc-50", isSel ? "bg-zinc-100" : "hover:bg-zinc-50")}
                      >
                        <td className="px-5 py-2.5 font-mono text-[13px]">{r.studentCode}</td>
                        <td className="px-3 py-2.5">{r.firstName ?? <span className="text-faint">—</span>}</td>
                        <td className="px-3 py-2.5 text-muted" title={formatDateTime(r.joinedAt)}>
                          {r.joinedAt ? formatDate(r.joinedAt) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-5 py-1.5 text-right">
                          <RowMenu
                            label={`Actions for ${r.studentCode}`}
                            items={[
                              { label: "View details", onSelect: () => setSelectedKey(k) },
                              ...(r.status === "active"
                                ? [{ label: "Withdraw", onSelect: () => setStatus.mutate({ r, status: "withdrawn" }) }]
                                : r.status === "withdrawn"
                                  ? [{ label: "Reactivate", onSelect: () => setStatus.mutate({ r, status: "active" }) }]
                                  : []),
                              ...(r.enrollmentId !== null ? [{ label: "Move to section…", onSelect: () => setSelectedKey(k) }] : []),
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

        <div className="space-y-6">
          {selected ? (
            <SelectedStudent
              key={rowKey(selected)}
              r={selected}
              cls={cls}
              classes={classes}
              busy={setStatus.isPending}
              onStatus={(status) => setStatus.mutate({ r: selected, status })}
              onMoved={() => {
                setSelectedKey(null);
                invalidate();
              }}
            />
          ) : (
            <Card className="p-5">
              <CardTitle>Selected student</CardTitle>
              <p className="mt-2 text-sm text-muted">Select a row to move, withdraw or reactivate a student.</p>
            </Card>
          )}

          <Card className="border-red-300 p-5">
            <CardTitle>Data retention</CardTitle>
            <ol className="mt-3 space-y-3 text-sm">
              <li>
                <p className="font-semibold">1 · Withdraw</p>
                <p className="text-xs text-muted">Hides the student from results and blocks sign-in. Data is kept — reversible any time.</p>
              </li>
              <li>
                <p className="font-semibold">2 · Archive class</p>
                <p className="text-xs text-muted">
                  End of semester: the whole section becomes read-only and hidden, still exportable. Do it from{" "}
                  <Link to="/admin/classes" className="underline">
                    Classes
                  </Link>
                  .
                </p>
              </li>
              <li>
                <p className="font-semibold text-danger">3 · Delete / Anonymize</p>
                <p className="text-xs text-muted">
                  Irreversible. <strong>Anonymize</strong> removes the ID, name and e-mail but keeps scores; <strong>Delete</strong> removes the student and all their
                  attempts. Export the class first.
                </p>
              </li>
            </ol>
            <div className="mt-4 space-y-2">
              <Button block variant={exported ? "outline" : "solid"} accent="success" loading={exporting} onClick={() => void onExport()}>
                {exported ? "✓ Exported — export again" : "Export this class first"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={!exported || !selected?.studentId}
                  onClick={() => setDanger("anonymize")}
                  title={!exported ? "Export the class first" : !selected?.studentId ? "Select a student who has signed in" : undefined}
                >
                  Anonymize
                </Button>
                <Button
                  accent="danger"
                  disabled={!exported || !selected?.studentId}
                  onClick={() => setDanger("delete")}
                  title={!exported ? "Export the class first" : !selected?.studentId ? "Select a student who has signed in" : undefined}
                >
                  Delete
                </Button>
              </div>
              {exported && !selected?.studentId && <p className="text-xs text-muted">Select a student who has signed in to anonymize or delete them.</p>}
            </div>
          </Card>
        </div>
      </div>

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

/* ───────────────────────── Selected student ───────────────────────── */

function SelectedStudent({
  r,
  cls,
  classes,
  busy,
  onStatus,
  onMoved,
}: {
  r: AdminStudentRow;
  cls: AdminClass;
  classes: AdminClass[];
  busy: boolean;
  onStatus: (s: "active" | "withdrawn") => void;
  onMoved: () => void;
}) {
  const toast = useToast();
  const others = classes.filter((c) => c.id !== cls.id);
  const [target, setTarget] = useState<string>(others[0] ? String(others[0].id) : "");
  const move = useMutation({
    mutationFn: () => api.post<unknown>(`/admin/enrollments/${r.enrollmentId}/move`, { classId: Number(target) }),
    onSuccess: () => {
      const to = classes.find((c) => c.id === Number(target));
      toast.show(`${r.studentCode} moved to ${to?.name ?? "the new section"} (scores moved too)`, "success");
      onMoved();
    },
  });

  return (
    <Card className="p-5">
      <CardTitle right={<StatusBadge status={r.status} />}>Selected student</CardTitle>
      <p className="mt-2 text-xl font-bold">{r.firstName ?? <span className="text-faint">No name yet</span>}</p>
      <p className="font-mono text-sm">{r.studentCode}</p>
      {r.email && <p className="truncate text-sm text-muted">{r.email}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">Joined</dt>
          <dd className="font-semibold">{formatDate(r.joinedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted">Last sign-in</dt>
          <dd className="font-semibold" title={formatDateTime(r.lastLoginAt)}>
            {relativeTime(r.lastLoginAt)}
          </dd>
        </div>
      </dl>

      {r.enrollmentId === null ? (
        <p className="mt-4 rounded-xl bg-app p-3 text-sm text-muted">On the roster but hasn’t joined yet. They’ll appear as active after scanning this section’s QR code.</p>
      ) : (
        <>
          <div className="mt-5 border-t border-line pt-4">
            {others.length === 0 ? (
              <p className="text-xs text-muted">There’s no other active section to move to.</p>
            ) : (
              <div className="space-y-2">
                <Select name="move-target" label="Move to section" value={target} onChange={(e) => setTarget(e.target.value)}>
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button block onClick={() => move.mutate()} loading={move.isPending} disabled={!target}>
                  Move student
                </Button>
                <p className="text-xs text-muted">Attempts and scores move with the student.</p>
                {move.isError && <ErrorNote>{errorMessage(move.error)}</ErrorNote>}
              </div>
            )}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            {r.status === "active" ? (
              <Button block variant="outline" loading={busy} onClick={() => onStatus("withdrawn")}>
                Withdraw
              </Button>
            ) : (
              <Button block variant="outline" loading={busy} onClick={() => onStatus("active")}>
                Reactivate
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
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
