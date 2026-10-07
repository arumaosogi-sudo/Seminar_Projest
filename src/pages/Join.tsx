import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { joinCodeStore, useJoinClass, useLogout, useMe } from "@/lib/auth";
import { Button, ErrorNote, Spinner } from "@/components/ui";
import { AuthShell, CardChip } from "@/components/student/AuthShell";
import { useDocumentTitle } from "@/components/student/useDocumentTitle";
import { ApiRequestError } from "@/lib/api";
import { describeAuthError, joinNoticeStore } from "@/components/student/authHelpers";
import { classLabel, normalizeJoinCode, useClassByCode } from "@/components/student/useClassByCode";

/** How long "Joining Section 1 · 2569/1…" stays visible before moving on to /login. */
const HANDOFF_DELAY_MS = 700;

/** /join/:code — landing page of a section QR code. Stores the code, then hands over to /login. */
export default function Join() {
  const params = useParams();
  const code = normalizeJoinCode(params.code);
  const me = useMe();
  const cls = useClassByCode(code || undefined);
  const logout = useLogout();
  const navigate = useNavigate();
  useDocumentTitle("Join your class");

  const signedIn = !!me.data;
  const isStudent = me.data?.role === "student";
  const join = useJoinClass();
  const joinStarted = useRef(false);

  // Remember the code for the login call (kept in sessionStorage until login succeeds).
  useEffect(() => {
    if (code) joinCodeStore.set(code);
  }, [code]);

  // Valid class + not signed in → continue to /login after a short confirmation.
  useEffect(() => {
    if (!cls.data || me.isPending || signedIn) return;
    const t = window.setTimeout(() => navigate("/login", { replace: true }), HANDOFF_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [cls.data, me.isPending, signedIn, navigate]);

  // Already signed in as a student → join right away (no need to sign out and in again).
  useEffect(() => {
    if (!cls.data || !isStudent || joinStarted.current) return;
    joinStarted.current = true;
    const label = classLabel(cls.data);
    join.mutate(code, {
      onSuccess: (next) => {
        joinCodeStore.clear();
        if (next.role !== "student") return;
        joinNoticeStore.set(next.joinNotice ?? `You joined ${label}.`);
        navigate(next.student.needsOnboarding ? "/onboarding" : "/", { replace: true });
      },
    });
  }, [cls.data, isStudent, code, join, navigate]);

  const invalid = !code || cls.notFound;

  return (
    <AuthShell>
      {invalid ? (
        <>
          <h2 className="text-2xl font-bold tracking-tight">This class link doesn't work</h2>
          <p className="mt-2 text-[15px] text-muted">
            The code {code ? <span className="font-mono font-semibold text-ink">{code}</span> : "in this link"} is unknown or
            the class has ended. Ask your instructor for your section's current QR code.
          </p>
          <InvalidCleanup />
          <Link
            to="/login"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Go to sign in
          </Link>
        </>
      ) : cls.isError ? (
        <>
          <h2 className="text-2xl font-bold tracking-tight">Couldn't check your class</h2>
          <div className="mt-4">
            <ErrorNote>{lookupErrorMessage(cls.error)}</ErrorNote>
          </div>
          <Button className="mt-6" block size="lg" onClick={() => void cls.refetch()} loading={cls.isFetching}>
            Try again
          </Button>
        </>
      ) : !cls.data || me.isPending ? (
        <div className="flex flex-col items-center py-6 text-center" role="status" aria-live="polite">
          <Spinner className="size-7 text-muted" />
          <p className="mt-4 text-[15px] font-medium">Checking your class code…</p>
          <p className="mt-1 font-mono text-xs text-muted">{code}</p>
        </div>
      ) : isStudent ? (
        join.isError ? (
          <>
            <CardChip>{classLabel(cls.data)} · via QR</CardChip>
            <h2 className="mt-5 text-2xl font-bold tracking-tight">Couldn't join this class</h2>
            <div className="mt-4">
              <ErrorNote>{describeAuthError(join.error)}</ErrorNote>
            </div>
            <div className="mt-6 space-y-2">
              <Button block size="lg" loading={join.isPending} onClick={() => join.mutate(code)}>
                Try again
              </Button>
              <Link
                to="/"
                replace
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-zinc-50"
              >
                Go Home
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-6 text-center" role="status" aria-live="polite">
            <Spinner className="size-7 text-success" />
            <p className="mt-4 text-[15px] font-semibold">Joining {classLabel(cls.data)}…</p>
          </div>
        )
      ) : signedIn ? (
        <>
          <CardChip>{classLabel(cls.data)} · via QR</CardChip>
          <h2 className="mt-5 text-2xl font-bold tracking-tight">You're already signed in</h2>
          <p className="mt-2 text-[15px] text-muted">
            To join <span className="font-semibold text-ink">{cls.data.name}</span>, sign out and sign in again with your
            student account. If you're already in this class, just go Home.
          </p>
          <div className="mt-6 space-y-2">
            <Button
              block
              size="lg"
              loading={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, {
                  onSuccess: () => {
                    joinCodeStore.set(code);
                    navigate("/login", { replace: true });
                  },
                })
              }
            >
              Sign out and continue
            </Button>
            <Button
              block
              size="lg"
              variant="outline"
              onClick={() => {
                joinCodeStore.clear();
                navigate(me.data?.role === "admin" ? "/admin" : "/", { replace: true });
              }}
            >
              {me.data?.role === "admin" ? "Back to the dashboard" : "Go Home"}
            </Button>
          </div>
          {logout.isError && (
            <div className="mt-4">
              <ErrorNote>Couldn't sign out. Please try again.</ErrorNote>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center py-6 text-center" role="status" aria-live="polite">
          <Spinner className="size-7 text-success" />
          <p className="mt-4 text-[15px] font-semibold">Joining {classLabel(cls.data)}…</p>
          <Link to="/login" replace className="mt-3 text-sm text-muted underline hover:text-ink">
            Continue to sign in
          </Link>
        </div>
      )}
    </AuthShell>
  );
}

/** Forget a bad code so it isn't sent with the next login. */
function InvalidCleanup() {
  useEffect(() => {
    joinCodeStore.clear();
  }, []);
  return null;
}

/** Tell rate limiting and server failures apart from a dropped connection. */
function lookupErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 429) return "Too many attempts right now. Please wait a minute and try again.";
    if (error.status >= 500) return "The server had a problem checking your class. Please try again in a moment.";
    return error.message || "We couldn't check this class code. Please try again.";
  }
  return "We couldn't reach the server. Check your internet connection and try again.";
}
