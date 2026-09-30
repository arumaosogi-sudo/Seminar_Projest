import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClassBody, type AdminClass } from "@shared/contract";
import { api } from "@/lib/api";
import { Badge, Button, Card, cx, DraftBadge, EmptyState, ErrorNote, Input, PageHeader, PageLoader, Select, Spinner } from "@/components/ui";
import { useAdminClass } from "@/components/admin/adminClass";
import { CardTitle, QueryError, SearchBox, Segmented, Switch } from "@/components/admin/controls";
import { copyText, errorMessage, formatDate } from "@/components/admin/format";
import { IconCopy, IconDownload, IconPlus } from "@/components/admin/icons";
import { adminKeys } from "@/components/admin/keys";
import { ConfirmDialog, Modal } from "@/components/admin/Modal";
import { downloadDataUrl, useQrDataUrl } from "@/components/admin/qr";
import { useToast } from "@/components/admin/toastContext";

type Tab = "active" | "archived";

const joinUrl = (code: string) => `${window.location.origin}/join/${encodeURIComponent(code)}`;

function StatusBadge({ c }: { c: AdminClass }) {
  if (c.status === "archived") return <Badge>Archived</Badge>;
  if (c.studentCount === 0) return <Badge className="bg-zinc-100 text-muted">Waiting (0 students)</Badge>;
  return <Badge tone="success">Active</Badge>;
}

export default function Classes() {
  const { classId: currentId, setClassId } = useAdminClass();
  const q = useQuery({ queryKey: adminKeys.classes("all"), queryFn: () => api.get<AdminClass[]>("/admin/classes?status=all") });
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const all = useMemo(() => q.data ?? [], [q.data]);
  const counts = useMemo(() => ({ active: all.filter((c) => c.status === "active").length, archived: all.filter((c) => c.status === "archived").length }), [all]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((c) => c.status === tab)
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.joinCode.toLowerCase().includes(term))
      .sort((a, b) => b.academicYear - a.academicYear || b.semester - a.semester || a.section - b.section);
  }, [all, tab, search]);

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
            <DraftBadge />
            <Button onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> New class
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
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-w-0 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented<Tab>
                label="Class status"
                value={tab}
                onChange={(t) => {
                  setTab(t);
                  setSelectedId(null);
                }}
                options={[
                  { value: "active", label: `Active (${counts.active})` },
                  { value: "archived", label: `Archived (${counts.archived})` },
                ]}
              />
              <div className="w-full sm:w-64">
                <SearchBox value={search} onChange={setSearch} placeholder="Search class or code" label="Search classes" />
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">{search ? "No classes match your search." : tab === "active" ? "No active classes." : "No archived classes."}</p>
            ) : (
              <div className="-mx-5 mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="sr-only">Classes — select a row to see its QR code</caption>
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] tracking-wider text-muted uppercase">
                      <th scope="col" className="px-5 py-2.5 font-semibold">Class</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Join code</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Students</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pretest</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Posttest</th>
                      <th scope="col" className="px-5 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => {
                      const isSel = selected?.id === c.id;
                      return (
                        <tr
                          key={c.id}
                          tabIndex={0}
                          aria-selected={isSel}
                          onClick={() => select(c)}
                          onKeyDown={(e) => onRowKey(e, c)}
                          className={cx("cursor-pointer border-b border-line last:border-b-0 outline-none focus-visible:bg-zinc-50", isSel ? "bg-zinc-100" : "hover:bg-zinc-50")}
                        >
                          <td className="px-5 py-3 font-semibold">{c.name}</td>
                          <td className="px-3 py-3 font-mono text-[13px]">{c.joinCode}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{c.studentCount}</td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {c.pretestSubmitted}/{c.studentCount}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {c.posttestSubmitted}/{c.studentCount}
                          </td>
                          <td className="px-5 py-3">
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

          {selected ? <SelectedClass key={selected.id} c={selected} /> : <Card className="p-6 text-sm text-muted">Select a class to see its QR code.</Card>}
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

/* ───────────────────────── Selected class card ───────────────────────── */

function SelectedClass({ c }: { c: AdminClass }) {
  const qc = useQueryClient();
  const toast = useToast();
  const url = joinUrl(c.joinCode);
  const qr = useQrDataUrl(c.status === "active" ? url : null);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const archive = useMutation({
    mutationFn: () => api.post<unknown>(`/admin/classes/${c.id}/${c.status === "active" ? "archive" : "unarchive"}`),
    onSuccess: () => {
      toast.show(c.status === "active" ? `${c.name} archived` : `${c.name} is active again`, "success");
      setArchiveOpen(false);
      void qc.invalidateQueries({ queryKey: adminKeys.classesRoot });
      void qc.invalidateQueries({ queryKey: adminKeys.studentsRoot });
    },
  });

  return (
    <Card className="p-6 xl:sticky xl:top-6">
      <CardTitle>Selected</CardTitle>
      <h2 className="mt-1 text-xl font-bold">{c.name}</h2>
      <p className="mt-0.5 text-xs text-muted">
        Created {formatDate(c.createdAt)}
        {c.archivedAt && ` · archived ${formatDate(c.archivedAt)}`}
      </p>

      {c.status === "archived" ? (
        <div className="mt-5 rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-700">
          This class is archived: it’s read-only, hidden from the class selector, and its QR code no longer works. Results can still be viewed and exported.
        </div>
      ) : (
        <>
          <div className="mt-5 grid place-items-center rounded-2xl border border-line bg-white p-4">
            {qr.url ? (
              <img src={qr.url} alt={`QR code that opens ${url}`} className="aspect-square w-full max-w-[240px]" width={240} height={240} />
            ) : qr.error ? (
              <p className="py-16 text-sm text-danger">{qr.error}</p>
            ) : (
              <div className="grid aspect-square w-full max-w-[240px] place-items-center text-muted">
                <Spinner />
              </div>
            )}
          </div>
          <p className="mt-4 text-center font-mono text-3xl font-bold tracking-wider">{c.joinCode}</p>
          <p className="mt-1 truncate text-center text-xs text-muted" title={url}>
            {url}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const ok = await copyText(url);
                toast.show(ok ? "Join link copied" : "Couldn’t copy — select the link manually", ok ? "info" : "error");
              }}
            >
              <IconCopy size={16} /> Copy link
            </Button>
            <Button variant="outline" disabled={!qr.url} onClick={() => qr.url && downloadDataUrl(qr.url, `QR-${c.joinCode}.png`)}>
              <IconDownload size={16} /> QR (PNG)
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">Students who scan this QR are added to this section automatically — they can’t pick a section themselves.</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-app p-3 text-xs">
            <div>
              <dt className="text-muted">Roster</dt>
              <dd className="font-semibold">{c.rosterCount} students</dd>
            </div>
            <div>
              <dt className="text-muted">Who can join</dt>
              <dd className="font-semibold">{c.restrictToRoster ? "Roster only" : "Anyone with the QR"}</dd>
            </div>
          </dl>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
        {c.status === "active" && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
        <Button variant={c.status === "active" ? "ghost" : "solid"} onClick={() => setArchiveOpen(true)}>
          {c.status === "active" ? "Archive class" : "Unarchive"}
        </Button>
        <Link to="/admin/students" className="ml-auto self-center text-sm font-semibold text-muted hover:text-ink">
          Students →
        </Link>
      </div>

      {editOpen && <EditClassModal c={c} onClose={() => setEditOpen(false)} />}

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => {
          setArchiveOpen(false);
          archive.reset();
        }}
        onConfirm={() => archive.mutate()}
        loading={archive.isPending}
        error={archive.isError ? errorMessage(archive.error) : null}
        title={c.status === "active" ? `Archive ${c.name}?` : `Unarchive ${c.name}?`}
        confirmLabel={c.status === "active" ? "Archive class" : "Unarchive"}
      >
        {c.status === "active" ? (
          <>
            <p>Archiving makes this section <strong>read-only</strong> and hides it from the class selector:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Its QR code / join code stops accepting students.</li>
              <li>Tests assigned to it are closed.</li>
              <li>Scores stay available in Results and can still be exported.</li>
            </ul>
            <p>You can unarchive it later.</p>
          </>
        ) : (
          <p>The class becomes active again: it shows up in the class selector and its QR code accepts students.</p>
        )}
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
