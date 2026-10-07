import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Me } from "@shared/contract";
import { meKey, useAppConfig, useMe } from "@/lib/auth";
import { Card, ErrorNote, Logo, PageLoader } from "@/components/ui";
// Shared with the student login (one GIS initialisation per page — see GoogleSignInButton).
import { GoogleSignInButton } from "@/components/student/GoogleSignInButton";
import { DevLoginForm } from "@/components/student/DevLoginForm";
import { describeAuthError } from "@/components/student/authHelpers";
import { errorMessage, isApiStatus } from "@/components/admin/format";
import { loginMethodStore, type LoginMethod } from "@/components/admin/session";
import { PasswordLoginForm } from "@/components/admin/PasswordLoginForm";

const FORBIDDEN_MSG = "This account isn't an instructor account. Ask an existing admin to add you in Settings.";

function loginError(e: unknown): string {
  if (isApiStatus(e, 403) && (e.code === "not_admin" || e.code === "forbidden" || !e.code)) return FORBIDDEN_MSG;
  return describeAuthError(e);
}

/** Only allow in-app admin redirects (never protocol-relative / absolute URLs). */
function safeAdminTarget(from: unknown): string {
  if (typeof from !== "string" || !from.startsWith("/admin") || from.startsWith("/admin/login") || from.startsWith("//")) return "/admin/classes";
  return from;
}

export default function AdminLogin() {
  const me = useMe();
  const config = useAppConfig();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const target = safeAdminTarget((location.state as { from?: unknown } | null)?.from);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = (method: LoginMethod) => (result: Me) => {
    if (result.role !== "admin") {
      setError(FORBIDDEN_MSG);
      void qc.invalidateQueries({ queryKey: meKey });
      return;
    }
    setError(null);
    loginMethodStore.set(method);
    qc.removeQueries({ queryKey: ["admin"] }); // never show a previous admin's cached data
    qc.setQueryData(meKey, result);
    navigate(target, { replace: true });
  };

  const passwordLogin = config.data?.adminPasswordLogin === true;
  const googleReady = !!config.data?.googleClientId;

  if (me.isPending || config.isPending) return <PageLoader />;
  if (me.data?.role === "admin") return <Navigate to={target} replace />;

  return (
    <main className="grid min-h-dvh place-items-center bg-app px-4 py-10">
      <Card className="w-full max-w-[420px] p-8 shadow-sm sm:p-10">
        <Logo sub="Admin" />
        <h1 className="mt-8 text-2xl font-bold tracking-tight">Instructor sign in</h1>
        <p className="mt-1 text-sm text-muted">
          {passwordLogin ? "Use your instructor username and password" : "Use your MFU Google account"}
        </p>

        {me.data?.role === "student" && (
          <p className="mt-4 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
            You’re currently signed in as a student ({me.data.student.email}). Signing in here replaces that session.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {config.isError && <ErrorNote>Couldn’t load sign-in settings. {errorMessage(config.error)}</ErrorNote>}
          {passwordLogin && <PasswordLoginForm onSuccess={onSuccess("password")} />}
          {(googleReady || !passwordLogin) && (
            <>
              {passwordLogin && (
                <p className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
                  <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
                </p>
              )}
              <GoogleSignInButton as="admin" onSuccess={onSuccess("google")} onError={(e) => setError(loginError(e))} onPendingChange={(p) => p && setError(null)} />
            </>
          )}
          <DevLoginForm as="admin" onSuccess={onSuccess("dev")} />
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          Student?{" "}
          <Link to="/login" className="font-semibold text-ink underline-offset-2 hover:underline">
            Go to student sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
