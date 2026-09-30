import type { ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import type { Me, StudentMe } from "@shared/contract";
import { useLogout, useMe } from "@/lib/auth";
import { Button, Card, ErrorNote, Logo, PageLoader } from "@/components/ui";

/** Narrow the cached session to a student (null for logged-out or admin sessions). */
export function asStudent(me: Me | null | undefined): StudentMe | null {
  return me && me.role === "student" ? me : null;
}

/**
 * The signed-in student. Only call inside <RequireStudent> (or StudentLayout), where the
 * guard guarantees the session is a student — it throws otherwise to surface wiring mistakes early.
 */
export function useStudentMe(): StudentMe {
  const { data } = useMe();
  const student = asStudent(data);
  if (!student) throw new Error("useStudentMe() must be used inside <RequireStudent>");
  return student;
}

type Props = {
  children: ReactNode;
  /** Allow students who still have to enter their first name (used by /onboarding itself). */
  allowOnboarding?: boolean;
};

/**
 * Route guard for student-only screens.
 *   loading → spinner · logged out → /login (remembers where they were going)
 *   admin session → friendly note with a link to /admin · no first name yet → /onboarding
 */
export function RequireStudent({ children, allowOnboarding = false }: Props) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <PageLoader />;

  if (me.isError) {
    return (
      <CenteredShell>
        <ErrorNote>We couldn't check your sign-in. Please check your connection.</ErrorNote>
        <Button className="mt-4" variant="outline" onClick={() => void me.refetch()} loading={me.isFetching}>
          Try again
        </Button>
      </CenteredShell>
    );
  }

  if (!me.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (me.data.role === "admin") return <AdminSessionNotice email={me.data.admin.email} />;

  if (me.data.student.needsOnboarding && !allowOnboarding) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

function CenteredShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-app px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6">
          <Logo />
        </div>
        {children}
      </Card>
    </main>
  );
}

function AdminSessionNotice({ email }: { email: string }) {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <CenteredShell>
      <h1 className="text-xl font-bold">You're signed in as an instructor</h1>
      <p className="mt-2 text-sm text-muted">
        <span className="font-medium text-ink">{email}</span> uses the instructor dashboard. Student pages need a student
        account.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/admin"
          className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Go to the dashboard
        </Link>
        <Button
          variant="outline"
          loading={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) })}
        >
          Sign out
        </Button>
      </div>
    </CenteredShell>
  );
}
