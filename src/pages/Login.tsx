import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Me } from "@shared/contract";
import { joinCodeStore, meKey, useAppConfig, useMe } from "@/lib/auth";
import { ErrorNote, PageLoader } from "@/components/ui";
import { AuthShell, CardChip } from "@/components/student/AuthShell";
import { GoogleSignInButton } from "@/components/student/GoogleSignInButton";
import { DevLoginForm } from "@/components/student/DevLoginForm";
import { CheckIcon, InfoIcon } from "@/components/student/icons";
import { describeAuthError, joinNoticeStore, safeRedirect } from "@/components/student/authHelpers";
import { classLabel, normalizeJoinCode, useClassByCode } from "@/components/student/useClassByCode";

export default function Login() {
  const me = useMe();
  const config = useAppConfig();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  const from = safeRedirect((location.state as { from?: unknown } | null)?.from);
  const [joinCode] = useState(() => normalizeJoinCode(joinCodeStore.get()) || undefined);
  const joinClass = useClassByCode(joinCode);

  const onSuccess = (next: Me) => {
    setError(null);
    joinCodeStore.clear();
    qc.setQueryData(meKey, next);
    if (next.role !== "student") {
      navigate("/admin", { replace: true });
      return;
    }
    if (next.joinNotice) joinNoticeStore.set(next.joinNotice);
    navigate(next.student.needsOnboarding ? "/onboarding" : from, { replace: true, state: next.student.needsOnboarding ? { from } : undefined });
  };

  // Already signed in as a student → skip the login screen.
  if (me.isPending) return <PageLoader />;
  if (me.data?.role === "student") {
    return <Navigate to={me.data.student.needsOnboarding ? "/onboarding" : from} replace />;
  }

  const domain = config.data?.allowedStudentDomain || "lamduan.mfu.ac.th";

  return (
    <AuthShell>
      <div className="mb-5">
        {joinCode ? (
          joinClass.data ? (
            <CardChip>
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              {classLabel(joinClass.data)} · via QR
            </CardChip>
          ) : joinClass.notFound ? (
            <p className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-red-800">
              The join code <span className="font-mono">{joinCode}</span> isn't valid anymore. Ask your instructor for your
              section's QR code — you can still sign in.
            </p>
          ) : (
            <CardChip>Join code {joinCode}</CardChip>
          )
        ) : (
          <p className="flex items-start gap-2 text-xs text-muted">
            <InfoIcon size={16} className="mt-px shrink-0" />
            Scan your section's QR code to join your class.
          </p>
        )}
      </div>

      <h2 className="text-[28px] font-bold tracking-tight">Sign in</h2>
      <p className="mt-1.5 text-[15px] text-muted">Use your MFU student Google account to continue.</p>

      {me.data?.role === "admin" && (
        <p className="mt-4 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
          You're signed in as an instructor ({me.data.admin.email}).{" "}
          <Link to="/admin" className="font-semibold underline">
            Open the dashboard
          </Link>
        </p>
      )}

      <div className="mt-6">
        <GoogleSignInButton
          as="student"
          joinCode={joinCode}
          onSuccess={onSuccess}
          onError={(e) => setError(describeAuthError(e))}
          onPendingChange={(p) => p && setError(null)}
        />
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <CheckIcon size={16} className="shrink-0 text-success" />
        Only @{domain} accounts
      </p>

      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {config.isError && (
        <div className="mt-4">
          <ErrorNote>Can't reach the server right now. Please refresh the page.</ErrorNote>
        </div>
      )}

      <hr className="my-6 border-line" />

      <p className="text-sm text-muted">We only store your Student ID and first name.</p>
      <Link to="/privacy" className="mt-1 inline-block rounded text-sm font-semibold text-ink hover:underline">
        Read the privacy notice →
      </Link>

      {config.data?.devLogin && (
        <div className="mt-6">
          <DevLoginForm as="student" joinCode={joinCode} onSuccess={onSuccess} />
        </div>
      )}
    </AuthShell>
  );
}
