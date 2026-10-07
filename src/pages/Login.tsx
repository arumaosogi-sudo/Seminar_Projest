import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Me } from "@shared/contract";
import { joinCodeStore, meKey, useAppConfig, useMe } from "@/lib/auth";
import { ErrorNote, PageLoader } from "@/components/ui";
import { AuthShell, CardChip } from "@/components/student/AuthShell";
import { GoogleSignInButton } from "@/components/student/GoogleSignInButton";
import { DevLoginForm } from "@/components/student/DevLoginForm";
import { useDocumentTitle } from "@/components/student/useDocumentTitle";
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
  useDocumentTitle("Sign in");

  const from = safeRedirect((location.state as { from?: unknown } | null)?.from);
  const [joinCode] = useState(() => normalizeJoinCode(joinCodeStore.get()) || undefined);
  const joinClass = useClassByCode(joinCode);

  const onSuccess = (next: Me) => {
    setError(null);
    joinCodeStore.clear();
    // Drop every cached query from a previous session (status, tests, …) before storing the new identity.
    qc.removeQueries();
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

  const domains = config.data?.allowedStudentDomains?.length ? config.data.allowedStudentDomains : ["lamduan.mfu.ac.th"];

  return (
    <AuthShell
      below={
        <>
          {config.data?.devLogin && <DevLoginForm as="student" joinCode={joinCode} onSuccess={onSuccess} />}
          <p className={config.data?.devLogin ? "mt-4 text-center" : "text-center"}>
            <Link to="/admin/login" className="rounded text-[13px] font-semibold text-gray-800 hover:text-ink hover:underline">
              For instructors →
            </Link>
          </p>
        </>
      }
    >
      {joinCode ? (
        joinClass.data ? (
          <CardChip>{classLabel(joinClass.data)} · via QR</CardChip>
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

      <h2 className="mt-3 text-[22px] font-semibold leading-7 text-ink">Sign in</h2>
      <p className="mt-2 text-[15px] leading-[22px] text-muted">
        Use your MFU student Google account
        <br />
        to continue.
      </p>

      {me.data?.role === "admin" && (
        <p className="mt-4 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
          You're signed in as an instructor ({me.data.admin.email}).{" "}
          <Link to="/admin" className="font-semibold underline">
            Open the dashboard
          </Link>
        </p>
      )}

      <div className="mt-4">
        <GoogleSignInButton
          as="student"
          joinCode={joinCode}
          onSuccess={onSuccess}
          onError={(e) => setError(describeAuthError(e))}
          onPendingChange={(p) => p && setError(null)}
        />
      </div>

      <p className="mt-4 flex items-center gap-[9px] text-[13px] leading-4 text-muted">
        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-faint text-white" aria-hidden="true">
          <CheckIcon size={10} />
        </span>
        Only {domains.map((d) => `@${d}`).join(" or ")} accounts
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

      <hr className="mt-[15px] border-line" />

      <p className="mt-3 text-[12px] leading-[18px] text-muted">We only store your Student ID and first name.</p>
      <Link to="/privacy" className="mt-[3px] inline-block rounded text-[12px] font-semibold leading-[18px] text-gray-800 hover:underline">
        Read the privacy notice →
      </Link>
    </AuthShell>
  );
}
