import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminTestDetail, AdminTestSaveResult, AdminTestSummary, SaveTestBody, TestKind } from "@shared/contract";
import { KindBadge } from "@/components/admin/KindBadge";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, ErrorNote, Input, PageHeader, PageLoader, Select } from "@/components/ui";
import { QueryError } from "@/components/admin/controls";
import { errorMessage, formatDateTime, relativeTime } from "@/components/admin/format";
import { IconPlus, IconTrash } from "@/components/admin/icons";
import { adminKeys } from "@/components/admin/keys";
import { ConfirmDialog, Modal } from "@/components/admin/Modal";
import { useToast } from "@/components/admin/toastContext";

export default function Tests() {
  const q = useQuery({ queryKey: adminKeys.tests, queryFn: () => api.get<AdminTestSummary[]>("/admin/tests") });
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminTestSummary | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const del = useMutation({
    mutationFn: (id: number) => api.del<unknown>(`/admin/tests/${id}`),
    onSuccess: (_d, id) => {
      qc.setQueryData<AdminTestSummary[]>(adminKeys.tests, (list) => list?.filter((t) => t.id !== id));
      void qc.invalidateQueries({ queryKey: adminKeys.tests });
      qc.removeQueries({ queryKey: adminKeys.test(id) });
      toast.show("Test deleted", "success");
      setToDelete(null);
    },
  });

  const tests = [...(q.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <>
      <PageHeader
        title="Tests"
        subtitle="Build pretests and posttests like a Google Form, then assign them to sections."
        actions={
          <>
            <Button onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> New test
            </Button>
          </>
        }
      />

      {q.isPending ? (
        <PageLoader />
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => void q.refetch()} what="tests" />
      ) : tests.length === 0 ? (
        <EmptyState title="No tests yet" action={<Button onClick={() => setCreateOpen(true)}>+ New test</Button>}>
          Create a pretest and a posttest, then assign them to your sections.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Tests</caption>
              <thead>
                <tr className="border-b border-line text-left text-[11px] tracking-wider text-muted uppercase">
                  <th scope="col" className="px-5 py-3 font-semibold">Title</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Kind</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Questions</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Max score</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Version</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Classes</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Attempts</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Updated</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-b-0 hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <Link to={`/admin/tests/${t.id}`} className="font-semibold hover:underline">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <KindBadge kind={t.kind} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.questionCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.maxScore}</td>
                    <td className="px-3 py-3 font-mono text-xs">v{t.currentVersion}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.assignedClassCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.attemptCount}</td>
                    <td className="px-3 py-3 text-muted" title={formatDateTime(t.updatedAt)}>
                      {relativeTime(t.updatedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link to={`/admin/tests/${t.id}`} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-zinc-100">
                          Edit
                        </Link>
                        <Link to={`/admin/tests/${t.id}/assign`} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-tests hover:bg-tests-soft">
                          Assign
                        </Link>
                        <span title={t.attemptCount > 0 ? "Can’t delete: students have already taken this test" : undefined}>
                          <button
                            type="button"
                            onClick={() => setToDelete(t)}
                            disabled={t.attemptCount > 0}
                            aria-label={`Delete ${t.title}`}
                            aria-describedby={t.attemptCount > 0 ? `del-hint-${t.id}` : undefined}
                            className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
                          >
                            <IconTrash size={16} />
                          </button>
                          {t.attemptCount > 0 && (
                            <span id={`del-hint-${t.id}`} className="sr-only">
                              Can’t delete: students have already taken this test
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateTestModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => {
          setToDelete(null);
          del.reset();
        }}
        onConfirm={() => {
          if (toDelete) del.mutate(toDelete.id);
        }}
        loading={del.isPending}
        error={del.isError ? errorMessage(del.error) : null}
        title={`Delete “${toDelete?.title ?? ""}”?`}
        confirmLabel="Delete test"
        accent="danger"
      >
        <p>The test, its questions and its section assignments will be removed. This can’t be undone.</p>
      </ConfirmDialog>
    </>
  );
}

function CreateTestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TestKind>("pretest");
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: SaveTestBody) => api.post<AdminTestDetail | AdminTestSaveResult>("/admin/tests", body),
    onSuccess: (res) => {
      // The contract doesn't pin the create response; accept either the detail or a save result.
      const test = "test" in res ? res.test : res;
      qc.setQueryData(adminKeys.test(test.id), test);
      void qc.invalidateQueries({ queryKey: adminKeys.tests });
      onClose();
      navigate(`/admin/tests/${test.id}`);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setErr("Give the test a title.");
      return;
    }
    setErr(null);
    create.mutate({ title: t, description: "", kind, questions: [] });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New test"
      description="You’ll add questions in the builder next."
      busy={create.isPending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="create-test-form" loading={create.isPending}>
            Create &amp; open builder
          </Button>
        </>
      }
    >
      <form id="create-test-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input name="test-title" label="Title" placeholder="e.g. Muscle tissue — Pretest" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} error={err ?? undefined} data-autofocus />
        <Select name="test-kind" label="Kind" value={kind} onChange={(e) => setKind(e.target.value as TestKind)}>
          <option value="pretest">Pretest</option>
          <option value="posttest">Posttest</option>
          <option value="other">Other</option>
        </Select>
        {create.isError && <ErrorNote>{errorMessage(create.error)}</ErrorNote>}
      </form>
    </Modal>
  );
}
