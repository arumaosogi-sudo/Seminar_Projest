import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addAdminBody, type AdminUser, type AuditEntry } from "@shared/contract";
import { api } from "@/lib/api";
import { useAppConfig, useMe } from "@/lib/auth";
import { Badge, Button, Card, ErrorNote, Input, PageHeader, Spinner } from "@/components/ui";
import { CardTitle, QueryError } from "@/components/admin/controls";
import { errorMessage, formatDateTime, relativeTime } from "@/components/admin/format";
import { adminKeys } from "@/components/admin/keys";
import { ConfirmDialog } from "@/components/admin/Modal";
import { useToast } from "@/components/admin/toastContext";

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Instructor accounts, sign-in status and recent activity." />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <AdminsCard />
          <SignInCard />
        </div>
        <ActivityCard />
      </div>
    </>
  );
}

/* ───────── Admins ───────── */

function AdminsCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const myEmail = me.data?.role === "admin" ? me.data.admin.email.toLowerCase() : "";
  const q = useQuery({ queryKey: adminKeys.admins, queryFn: () => api.get<AdminUser[]>("/admin/admins") });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<AdminUser | null>(null);

  const add = useMutation({
    mutationFn: (body: { email: string; name?: string }) => api.post<AdminUser>("/admin/admins", body),
    onSuccess: (_d, body) => {
      toast.show(`${body.email} can now sign in as an instructor`, "success");
      setEmail("");
      setName("");
      void qc.invalidateQueries({ queryKey: adminKeys.admins });
      void qc.invalidateQueries({ queryKey: adminKeys.audit });
    },
  });
  const remove = useMutation({
    mutationFn: (a: AdminUser) => api.del<unknown>(`/admin/admins/${a.id}`),
    onSuccess: (_d, a) => {
      toast.show(`${a.email} removed`, "success");
      setToRemove(null);
      void qc.invalidateQueries({ queryKey: adminKeys.admins });
      void qc.invalidateQueries({ queryKey: adminKeys.audit });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = addAdminBody.safeParse({ email, name: name.trim() || undefined });
    if (!parsed.success) {
      setFieldErr("Enter a valid e-mail address.");
      return;
    }
    if (q.data?.some((a) => a.email.toLowerCase() === parsed.data.email)) {
      setFieldErr("That e-mail is already an admin.");
      return;
    }
    setFieldErr(null);
    add.mutate(parsed.data);
  }

  return (
    <Card className="p-5">
      <CardTitle>Admins</CardTitle>
      <p className="mt-1 text-xs text-muted">Anyone listed here can sign in to this dashboard with Google. Admins from the server’s ADMIN_EMAILS setting can’t be removed here.</p>
      {q.isPending ? (
        <div className="grid place-items-center py-8 text-muted">
          <Spinner />
        </div>
      ) : q.isError ? (
        <div className="mt-3">
          <QueryError error={q.error} onRetry={() => void q.refetch()} what="admins" />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {q.data.length === 0 && <li className="py-3 text-sm text-muted">No admins in the database yet.</li>}
          {q.data.map((a) => {
            const isMe = a.email.toLowerCase() === myEmail;
            return (
              <li key={`${a.source}-${a.email}`} className="flex items-center gap-3 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-bold" aria-hidden="true">
                  {(a.name || a.email).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {a.name || a.email}
                    {isMe && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
                  </p>
                  {a.name && <p className="truncate text-xs text-muted">{a.email}</p>}
                </div>
                <Badge tone={a.source === "env" ? "neutral" : "tests"}>{a.source === "env" ? "env" : "database"}</Badge>
                {a.source === "database" && a.id !== null ? (
                  <Button size="sm" variant="ghost" onClick={() => setToRemove(a)} disabled={isMe} title={isMe ? "You can’t remove yourself" : undefined}>
                    Remove
                  </Button>
                ) : (
                  <span className="w-[74px]" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <Input name="new-admin-email" type="email" label="E-mail" placeholder="name@mfu.ac.th" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErr ?? undefined} autoComplete="off" />
        <Input name="new-admin-name" label="Name (optional)" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <Button type="submit" loading={add.isPending} className={fieldErr ? "sm:mb-5" : undefined}>
          Add admin
        </Button>
      </form>
      {add.isError && (
        <div className="mt-3">
          <ErrorNote>{errorMessage(add.error)}</ErrorNote>
        </div>
      )}

      <ConfirmDialog
        open={toRemove !== null}
        onClose={() => {
          setToRemove(null);
          remove.reset();
        }}
        onConfirm={() => {
          if (toRemove) remove.mutate(toRemove);
        }}
        loading={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        title={`Remove ${toRemove?.email ?? ""}?`}
        confirmLabel="Remove admin"
        accent="danger"
      >
        <p>They’ll lose access to the admin dashboard on their next request. You can add them again later.</p>
      </ConfirmDialog>
    </Card>
  );
}

/* ───────── Sign-in status ───────── */

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <Badge tone={ok ? "success" : "neutral"}>{ok ? "Yes" : "No"}</Badge>
    </li>
  );
}

function SignInCard() {
  const config = useAppConfig();
  return (
    <Card className="p-5">
      <CardTitle>Sign-in status</CardTitle>
      {config.isPending ? (
        <div className="grid place-items-center py-8 text-muted">
          <Spinner />
        </div>
      ) : config.isError ? (
        <div className="mt-3">
          <QueryError error={config.error} onRetry={() => void config.refetch()} what="sign-in settings" />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          <StatusRow
            label="Google client ID configured"
            ok={!!config.data.googleClientId}
            detail={config.data.googleClientId ? "Sign in with Google is available for students and instructors." : "Set GOOGLE_CLIENT_ID on the Worker to enable Google sign-in."}
          />
          <StatusRow
            label="Dev login enabled"
            ok={config.data.devLogin}
            detail={config.data.devLogin ? "Anyone can sign in by typing an e-mail — local development only, never in production." : "Disabled (as it should be in production)."}
          />
          <li className="flex items-start justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-semibold">Student e-mail domain</p>
              <p className="text-xs text-muted">Only accounts from this Google Workspace domain can join as students.</p>
            </div>
            <span className="font-mono text-xs">{config.data.allowedStudentDomain || "—"}</span>
          </li>
        </ul>
      )}
    </Card>
  );
}

/* ───────── Activity ───────── */

function describeTarget(e: AuditEntry): string {
  const t = e.targetType.replace(/_/g, " ");
  return e.targetId ? `${t} #${e.targetId}` : t;
}

function ActivityCard() {
  const q = useQuery({ queryKey: adminKeys.audit, queryFn: () => api.get<AuditEntry[]>("/admin/audit?limit=50"), refetchInterval: 60_000 });
  return (
    <Card className="p-5">
      <CardTitle right={q.isFetching && !q.isPending ? <Spinner className="size-4 text-muted" /> : undefined}>Recent activity</CardTitle>
      {q.isPending ? (
        <div className="grid place-items-center py-12 text-muted">
          <Spinner />
        </div>
      ) : q.isError ? (
        <div className="mt-3">
          <QueryError error={q.error} onRetry={() => void q.refetch()} what="activity" />
        </div>
      ) : q.data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No admin activity yet.</p>
      ) : (
        <ol className="mt-2 max-h-[640px] divide-y divide-line overflow-y-auto">
          {q.data.slice(0, 50).map((e) => (
            <li key={e.id} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-sm">
                  <span className="font-semibold">{e.action.replace(/[._]/g, " ")}</span> <span className="text-muted">· {describeTarget(e)}</span>
                </p>
                <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)} className="shrink-0 text-xs text-muted">
                  {relativeTime(e.createdAt)}
                </time>
              </div>
              <p className="truncate text-xs text-faint">{e.adminEmail}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
