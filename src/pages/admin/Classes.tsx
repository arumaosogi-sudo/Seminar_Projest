import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClassBody, type AdminClass, type AdminStudentRow } from "@shared/contract";
import { api } from "@/lib/api";
import { Button, Card, cx, EmptyState, ErrorNote, Input, PageHeader, PageLoader, Select, Spinner } from "@/components/ui";
import { useAdminClass } from "@/components/admin/adminClass";
import { CardTitle, FilterPills, QueryError, SearchBox, StatusChip, Switch } from "@/components/admin/controls";
import { copyText, errorMessage, formatDate, formatDateTime, relativeTime } from "@/components/admin/format";
import { LIVE_REFRESH_MS, LiveIndicator, isRecentJoin } from "@/components/admin/live";
import { IconDownload, IconPlus } from "@/components/admin/icons";
import { adminKeys } from "@/components/admin/keys";
import { ConfirmDialog, Modal } from "@/components/admin/Modal";
import { downloadDataUrl, useQrDataUrl } from "@/components/admin/qr";
import { exportWholeClass } from "@/components/admin/exportResults";
import { useToast } from "@/components/admin/toastContext";

type Tab = "active" | "archived";

const joinUrl = (code: string) => `${window.location.origin}/join/${encodeURIComponent(code)}`;

function StatusBadge({ c }: { c: AdminClass }) {
  if (c.status === "archived") return <StatusChip tone="neutral">Archived</StatusChip>;
  if (c.studentCount === 0) return <StatusChip tone="neutral">Waiting</StatusChip>;
  return <StatusChip tone="success">Active</StatusChip>;
}

export default function Classes() {
  const { classId: currentId, setClassId } = useAdminClass();
  const q = useQuery({
    queryKey: adminKeys.classes("all"),
    queryFn: () => api.get<AdminClass[]>("/admin/classes?status=all"),
    refetchInterval: LIVE_REFRESH_MS, // student / pretest / posttest counts change during class
  });
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const all = useMemo(() => q.data ?? [], [q.data]);
  const counts = useMemo(() => ({ active: all.filter((c) => c.status === "active").length, archived: all.filter((c) => c.status === "archived").length }), [all]);
  // The "Archived" pill disappears after the last archived class is deleted → fall back to Active.
  const effectiveTab: Tab = tab === "archived" && counts.archived === 0 ? "active" : tab;
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((c) => c.status === effectiveTab)
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.joinCode.toLowerCase().includes(term))
      .sort((a, b) => b.academicYear - a.academicYear || b.semester - a.semester || a.section - b.section);
  }, [all, effectiveTab, search]);

  // Selection: explicit choice → current class (if visible) → first row.
  const selected =
    rows.find((c) => c.id === selectedId) ?? rows.find((c) => c.id === currentId) ?? rows[0] ?? null;

  const select = (c: AdminClass) => {
    setSelectedId(c.id);
    if (c.status === "active") setClassId(c.id);
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, c: AdminClass) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(c);
    }
  };

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="One class = academic year + semester + section. Each section gets its own QR code."
        actions={
          <>
            <Button size="lg" className="w-[140px] whitespace-nowrap rounded-xl px-0" onClick={() => setCreateOpen(true)}>
              <IconPlus size={18} /> New class
            </Button>
          </>
        }
      />

      {q.isPending ? (
        <PageLoader />
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => void q.refetch()} what="classes" />
      ) : all.length === 0 ? (
        <EmptyState title="No classes yet — create the first section" action={<Button onClick={() => setCreateOpen(true)}>+ New class</Button>}>
          Each class is one section of one semester. Students join it by scanning its QR code.
        </EmptyState>
      ) : (
        <div className="grid items-start gap-[25px] xl:grid-cols-[minmax(0,1fr)_339px]">
          <Card className="min-w-0 px-[19px] pb-[15px] pt-[17px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterPills<Tab>
                label="Class status"
                value={effectiveTab}
                onChange={(t) => {
                  setTab(t);
                  setSelectedId(null);
                }}
                options={[
                  { value: "active", label: `Active (${counts.active})` },
                  // Archiving was replaced by Delete; the tab only remains so old archived classes can be deleted.
                  ...(counts.archived > 0 ? [{ value: "archived" as Tab, label: `Archived (${counts.archived})` }] : []),
                ]}
              />
              <div className="w-full sm:w-[259px]">
                <SearchBox value={search} onChange={setSearch} placeholder="Search class..." label="Search classes or join codes" />
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">{search ? "No classes match your search." : effectiveTab === "active" ? "No active classes." : "No archived classes."}</p>
            ) : (
              <div className="relative -mx-[19px] mt-[28px] overflow-x-auto">
                <table className="w-full min-w-[700px] table-fixed text-[14px]">
                  <caption className="sr-only">Classes — select a row to see its QR code</caption>
                  <colgroup>
                    <col className="w-[196px]" />
                    <col className="w-[130px]" />
                    <col className="w-[95px]" />
                    <col className="w-[107px]" />
                    <col className="w-[106px]" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-[12px] uppercase text-faint">
                      <th scope="col" className="pb-[14px] pl-5 font-semibold">Class</th>
                      <th scope="col" className="pb-[14px] font-semibold">Join code</th>
                      <th scope="col" className="pb-[14px] font-semibold">Students</th>
                      <th scope="col" className="pb-[14px] font-semibold">Pretest</th>
                      <th scope="col" className="pb-[14px] font-semibold">Posttest</th>
                      <th scope="col" className="pb-[14px] pr-5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => {
                      const isSel = selected?.id === c.id;
                      const archived = c.status === "archived";
                      // Figma: "46 / 48"; an em dash while nobody has taken that test yet.
                      const dash = (n: number) => (c.studentCount === 0 ? "—" : `${n} / ${c.studentCount}`);
                      return (
                        <tr
                          key={c.id}
                          tabIndex={0}
                          aria-selected={isSel}
                          onClick={() => select(c)}
                          onKeyDown={(e) => onRowKey(e, c)}
                          className={cx(
                            "h-[52px] cursor-pointer outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50",
                            archived ? "text-muted" : "text-ink",
                          )}
                        >
                          <td className={cx("pl-5", !archived && "font-semibold")}>{c.name}</td>
                          <td className={cx("text-[13.5px]", archived && "text-faint")}>{c.joinCode}</td>
                          <td className="tabular-nums">{c.studentCount}</td>
                          <td className="tabular-nums">{dash(c.pretestSubmitted)}</td>
                          <td className="tabular-nums">{c.posttestSubmitted === 0 ? "—" : dash(c.posttestSubmitted)}</td>
                          <td className="pr-5">
                            <StatusBadge c={c} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {selected ? (
            <div className="space-y-[25px] xl:sticky xl:top-6">
              <SelectedClass key={selected.id} c={selected} />
              {selected.status === "active" && <RecentJoins key={`joins-${selected.id}`} c={selected} />}
            </div>
          ) : (
            <Card className="p-6 text-sm text-muted">Select a class to see its QR code.</Card>
          )}
        </div>
      )}

      <CreateClassModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(c) => {
          setTab("active");
          setSelectedId(c.id);
          setClassId(c.id);
        }}
      />
    </>
  );
}

/* ───────────────────────── Live "who just scanned the QR" list ───────────────────────── */

const RECENT_LIMIT = 6;

function RecentJoins({ c }: { c: AdminClass }) {
  const q = useQuery({
    queryKey: adminKeys.students(c.id, "all"),
    queryFn: () => api.get<AdminStudentRow[]>(`/admin/students?${new URLSearchParams({ classId: String(c.id), status: "all" })}`),
    refetchInterval: LIVE_REFRESH_MS,
  });
  const recent = useMemo(
    () =>
      (q.data ?? [])
        .filter((r) => r.status === "active" && r.joinedAt)
        .sort((a, b) => Date.parse(b.joinedAt ?? "") - Date.parse(a.joinedAt ?? ""))
        .slice(0, RECENT_LIMIT),
    [q.data],
  );

  return (
    <Card className="p-[25px]">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Joined via QR</CardTitle>
        <LiveIndicator updatedAt={q.dataUpdatedAt} fetching={q.isFetching} />
      </div>
      {q.isPending ? (
        <div className="py-6 text-center">
          <Spinner />
        </div>
      ) : q.isError ? (
        <p className="mt-3 text-sm text-danger">Couldn’t load students. {errorMessage(q.error)}</p>
      ) : recent.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nobody has joined yet. Students appear here a few seconds after they scan this QR code and sign in.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {recent.map((r) => (
            <li key={r.enrollmentId ?? r.studentCode} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-ink">{r.firstName ?? <span className="text-faint">(no name yet)</span>}</span>
                <span className="block text-[12px] tabular-nums text-muted">{r.studentCode}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[12px] text-muted" title={formatDateTime(r.joinedAt)}>
                {isRecentJoin(r) && (
                  <span className="inline-flex h-[20px] items-center rounded-full bg-[#e8f5ec] px-2 text-[11px] font-semibold text-success">New</span>
                )}
                {relativeTime(r.joinedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/admin/students" className="mt-3 inline-block text-[13px] font-semibold text-ink hover:underline">
        All students in this section →
      </Link>
    </Card>
  );
}

/* ───────────────────────── Selected class card ───────────────────────── */

function SelectedClass({ c }: { c: AdminClass }) {
  const qc = useQueryClient();
  const toast = useToast();
  const url = joinUrl(c.joinCode);
  const qr = useQrDataUrl(c.status === "active" ? url : null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const remove = useMutation({
    mutationFn: () => api.del<{ ok: true; deleted: { students: number; attempts: number } }>(`/admin/classes/${c.id}`),
    onSuccess: (r) => {
      toast.show(`${c.name} deleted · ${r.deleted.students} student(s), ${r.deleted.attempts} test attempt(s) removed`, "success");
      setDeleteOpen(false);
      void qc.invalidateQueries({ queryKey: adminKeys.classesRoot });
      void qc.invalidateQueries({ queryKey: adminKeys.studentsRoot });
      void qc.invalidateQueries({ queryKey: adminKeys.resultsRoot });
    },
  });

  async function exportFirst() {
    setExporting(true);
    try {
      const name = await exportWholeClass(c.id, c.name);
      setExported(true);
      toast.show(name ? `Exported ${name}` : "No tests are assigned to this class, so there are no scores to export.", "success");
    } catch (e) {
      toast.show(`Export failed: ${errorMessage(e)}`, "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className="p-[25px]">
      <CardTitle>Selected</CardTitle>
      <h2 className="mt-1.5 text-[22px] font-semibold leading-7 text-ink">{c.name}</h2>

      {c.status === "archived" ? (
        <div className="mt-[17px] rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-700">
          This class is archived (since {formatDate(c.archivedAt ?? c.createdAt)}): it’s read-only, hidden from the class selector, and its QR code no longer works.
          Results can still be viewed and exported.
        </div>
      ) : (
        <>
          <div className="mx-auto mt-[17px] grid size-[239px] place-items-center rounded-2xl border border-line bg-white">
            {qr.url ? (
              <img src={qr.url} alt={`QR code that opens ${url}`} className="size-[210px]" width={210} height={210} />
            ) : qr.error ? (
              <p className="px-4 text-center text-sm text-danger">{qr.error}</p>
            ) : (
              <Spinner />
            )}
          </div>
          <p className="mt-5 text-center text-[22px] font-bold leading-7 text-ink">{c.joinCode}</p>
          <p className="mt-1.5 truncate text-center text-[12px] text-muted" title={url}>
            {url.replace(/^https?:\/\//, "")}
          </p>
          <div className="mt-4 grid grid-cols-[136fr_143fr] gap-2.5">
            <button
              type="button"
              className="h-[43px] rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink hover:bg-zinc-50"
              onClick={async () => {
                const ok = await copyText(url);
                toast.show(ok ? "Join link copied" : "Couldn’t copy — select the link manually", ok ? "info" : "error");
              }}
            >
              Copy link
            </button>
            <button
              type="button"
              disabled={!qr.url}
              onClick={() => qr.url && downloadDataUrl(qr.url, `QR-${c.joinCode}.png`)}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gray-800 text-[15px] font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
            >
              <IconDownload size={18} /> QR (PNG)
            </button>
          </div>
          <p className="mt-4 text-center text-[12px] leading-[18px] text-muted">
            Students who scan this QR are added to this section automatically — they can’t pick a section themselves.
          </p>
        </>
      )}

      <div className="mt-[35px] grid grid-cols-2 gap-[11px]">
        {c.status === "active" ? (
          <button type="button" onClick={() => setEditOpen(true)} className="h-[37px] rounded-xl border border-line bg-surface text-[13px] font-semibold text-ink hover:bg-zinc-50">
            Edit
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="h-[37px] rounded-xl border border-red-200 bg-surface text-[13px] font-semibold text-danger hover:bg-red-50"
        >
          Delete class
        </button>
      </div>

      {editOpen && <EditClassModal c={c} onClose={() => setEditOpen(false)} />}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          if (remove.isPending) return;
          setDeleteOpen(false);
          remove.reset();
        }}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        title={`Delete ${c.name}?`}
        confirmLabel="Delete class"
        accent="danger"
        confirmText={c.joinCode}
        confirmTextLabel={`Type the join code ${c.joinCode} to confirm`}
      >
        <p>
          This <strong>permanently deletes</strong> the section and cannot be undone:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            {c.studentCount} student{c.studentCount === 1 ? "" : "s"} are removed from it (students who are not in another section are deleted).
          </li>
          <li>All Pretest / Posttest scores in this section are deleted.</li>
          <li>Its QR code / join code stops working.</li>
        </ul>
        <p>Tests themselves stay in the Tests page and can be assigned to other sections.</p>
        <Button variant="outline" accent="success" loading={exporting} onClick={() => void exportFirst()}>
          {exported ? "Exported ✓ — export again" : "Export scores to Excel first"}
        </Button>
      </ConfirmDialog>
    </Card>
  );
}

/* ───────────────────────── Edit ───────────────────────── */

function EditClassModal({ c, onClose }: { c: AdminClass; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [restrict, setRestrict] = useState(c.restrictToRoster);
  const [regenOpen, setRegenOpen] = useState(false);

  const patch = useMutation({
    mutationFn: (body: { restrictToRoster?: boolean; regenerateJoinCode?: boolean }) => api.patch<AdminClass>(`/admin/classes/${c.id}`, body),
    onSuccess: (_d, body) => {
      void qc.invalidateQueries({ queryKey: adminKeys.classesRoot });
      if (body.regenerateJoinCode) {
        toast.show("New join code generated — the old QR no longer works", "success");
        setRegenOpen(false);
      } else {
        toast.show("Class updated", "success");
        onClose();
      }
    },
  });

  return (
    <>
      <Modal
        open={!regenOpen}
        onClose={onClose}
        title={`Edit ${c.name}`}
        busy={patch.isPending}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={patch.isPending}>
              Cancel
            </Button>
            <Button loading={patch.isPending && !regenOpen} disabled={restrict === c.restrictToRoster} onClick={() => patch.mutate({ restrictToRoster: restrict })}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Only students on the roster can join</p>
              <p className="mt-0.5 text-xs text-muted">
                Roster has {c.rosterCount} student{c.rosterCount === 1 ? "" : "s"}. Import it from <Link to="/admin/students" className="underline">Students</Link>.
              </p>
            </div>
            <Switch checked={restrict} onChange={setRestrict} label="Only students on the roster can join" />
          </div>
          <div className="flex items-start justify-between gap-4 border-t border-line pt-5">
            <div>
              <p className="text-sm font-semibold">Join code</p>
              <p className="mt-0.5 text-xs text-muted">
                Current code <span className="font-mono font-semibold text-ink">{c.joinCode}</span>. Regenerate it if the QR leaked.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
              Regenerate
            </Button>
          </div>
          {patch.isError && !regenOpen && <ErrorNote>{errorMessage(patch.error)}</ErrorNote>}
        </div>
      </Modal>
      <ConfirmDialog
        open={regenOpen}
        onClose={() => {
          setRegenOpen(false);
          patch.reset();
        }}
        onConfirm={() => patch.mutate({ regenerateJoinCode: true })}
        loading={patch.isPending}
        error={patch.isError ? errorMessage(patch.error) : null}
        title="Regenerate join code?"
        confirmLabel="Regenerate"
        accent="danger"
      >
        <p>
          The current code <span className="font-mono font-semibold">{c.joinCode}</span> and every printed or shared QR code for this section will stop working. Students
          who already joined are not affected.
        </p>
      </ConfirmDialog>
    </>
  );
}

/* ───────────────────────── Create ───────────────────────── */

function CreateClassModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: AdminClass) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [year, setYear] = useState("2569");
  const [semester, setSemester] = useState("1");
  const [section, setSection] = useState("1");
  const [restrict, setRestrict] = useState(false);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: (body: { academicYear: number; semester: number; section: number; restrictToRoster: boolean }) => api.post<AdminClass>("/admin/classes", body),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: adminKeys.classesRoot });
      toast.show(`Created ${c?.name ?? "class"}`, "success");
      if (c?.id) onCreated(c);
      close();
    },
  });

  function close() {
    setFieldErr({});
    create.reset();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = createClassBody.safeParse({ academicYear: Number(year), semester: Number(semester), section: Number(section), restrictToRoster: restrict });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        errs[k] ??= k === "academicYear" ? "Use a Buddhist-era year, e.g. 2569" : k === "section" ? "Section must be 1–99" : "Invalid value";
      }
      setFieldErr(errs);
      return;
    }
    setFieldErr({});
    create.mutate(parsed.data);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New class"
      description="Academic year + semester + section. A join code and QR are generated automatically."
      busy={create.isPending}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="create-class-form" loading={create.isPending}>
            Create class
          </Button>
        </>
      }
    >
      <form id="create-class-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input name="academicYear" label="Academic year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} error={fieldErr.academicYear} data-autofocus />
          <Select name="semester" label="Semester" value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3 (summer)</option>
          </Select>
          <Input name="section" label="Section" type="number" min={1} max={99} value={section} onChange={(e) => setSection(e.target.value)} error={fieldErr.section} />
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={restrict} onChange={(e) => setRestrict(e.target.checked)} />
          <span>
            <span className="font-semibold">Only students on the roster can join</span>
            <span className="mt-0.5 block text-xs text-muted">Import the roster CSV from the Students page after creating the class.</span>
          </span>
        </label>
        <p className="text-xs text-muted">
          Preview: <span className="font-semibold text-ink">{`${year || "—"}/${semester} · Section ${section || "—"}`}</span>
        </p>
        {create.isError && <ErrorNote>{errorMessage(create.error)}</ErrorNote>}
      </form>
    </Modal>
  );
}
