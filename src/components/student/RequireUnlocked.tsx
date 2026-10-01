import { Link, Outlet } from "react-router";
import { Button, Card, DraftBadge, ErrorNote, PageLoader } from "@/components/ui";
import { useStudentStatus } from "./queries";
import { LockIcon } from "./icons";
import { useDocumentTitle } from "./useDocumentTitle";

/**
 * Route guard for /games/* and /explore/*: these menus stay locked until the student submits every
 * required-first test (GET /api/me/status → menusLocked). Fail-CLOSED: if the status can't be loaded
 * the pages are not shown. Must sit inside StudentLayout (which already guarantees a student session).
 */
export default function RequireUnlocked() {
  const status = useStudentStatus();

  if (status.isPending) return <PageLoader />;

  if (status.isError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-6">
        <ErrorNote>We couldn't check whether this section is unlocked. Please check your connection and try again.</ErrorNote>
        <Button variant="outline" onClick={() => void status.refetch()} loading={status.isFetching}>
          Retry
        </Button>
      </div>
    );
  }

  if (status.data.menusLocked) return <LockedPanel pending={status.data.requiredPending.map((r) => r.title)} />;

  return <Outlet />;
}

function LockedPanel({ pending }: { pending: string[] }) {
  useDocumentTitle("Locked");
  const what = pending.length > 0 ? pending.join(", ") : "the Pretest";
  return (
    <div>
      <div className="flex justify-end">
        <DraftBadge />
      </div>
      <Card className="mx-auto mt-4 max-w-lg p-6 text-center sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-tests-soft text-tests" aria-hidden="true">
          <LockIcon size={28} />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Finish the Pretest to unlock Games and 3D Explore</h1>
        <p className="mt-2 text-[15px] text-muted">
          Your instructor asked you to complete <span className="font-semibold text-ink">{what}</span> first. It only takes a
          few minutes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/tests"
            className="inline-flex h-11 items-center rounded-xl bg-tests px-5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to tests
          </Link>
          <Link to="/" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold hover:bg-zinc-50">
            Back to Home
          </Link>
        </div>
      </Card>
    </div>
  );
}
