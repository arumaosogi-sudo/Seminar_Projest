import { Suspense, useCallback, useEffect, useId, useMemo, useState, type ComponentType } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { AdminClass, AdminMe } from "@shared/contract";
import { api } from "@/lib/api";
import { useAppConfig, useLogout, useMe } from "@/lib/auth";
import { Button, Card, cx, Logo, PageLoader } from "@/components/ui";
import { ADMIN_CLASS_KEY, AdminClassContext, resolveCurrentClass, type AdminClassState } from "./adminClass";
import { QueryError } from "./controls";
import { safeStorage } from "./format";
import { IconClasses, IconClose, IconLogout, IconMenu, IconResults, IconSettings, IconStudents, IconTests } from "./icons";
import { adminKeys } from "./keys";
import { loginMethodStore } from "./session";
import { ToastProvider } from "./Toast";

const NAV: { to: string; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { to: "/admin/classes", label: "Classes", Icon: IconClasses },
  { to: "/admin/tests", label: "Tests", Icon: IconTests },
  { to: "/admin/results", label: "Results", Icon: IconResults },
  { to: "/admin/students", label: "Students", Icon: IconStudents },
  { to: "/admin/settings", label: "Settings", Icon: IconSettings },
];

function readStoredClass(): number | null {
  const raw = safeStorage.get(ADMIN_CLASS_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Route element for /admin/*: session guard + sidebar shell + current-class context. */
export default function AdminLayout() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <PageLoader />;
  if (me.isError)
    return (
      <main className="mx-auto max-w-lg p-6">
        <QueryError error={me.error} onRetry={() => void me.refetch()} what="your session" />
      </main>
    );
  if (!me.data) return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  if (me.data.role !== "admin") return <StudentBlocked email={me.data.student.email} />;
  return <AdminShell me={me.data} />;
}

function StudentBlocked({ email }: { email: string }) {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <main className="grid min-h-dvh place-items-center bg-app p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <Logo sub="Admin" />
        <h1 className="mt-6 text-xl font-bold">This area is for instructors</h1>
        <p className="mt-2 text-sm text-muted">
          You’re signed in as a student (<span className="font-medium text-ink">{email}</span>). Sign out and sign in with an instructor account to continue.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => navigate("/")}>
            Go to student home
          </Button>
          <Button loading={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/admin/login", { replace: true }) })}>
            Sign out
          </Button>
        </div>
      </Card>
    </main>
  );
}

function AdminShell({ me }: { me: AdminMe }) {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const classesQ = useQuery({
    queryKey: adminKeys.classes("active"),
    queryFn: () => api.get<AdminClass[]>("/admin/classes?status=active"),
    staleTime: 30_000,
  });
  const [stored, setStored] = useState<number | null>(readStoredClass);

  const classes = useMemo(() => classesQ.data ?? [], [classesQ.data]);
  const classId = useMemo(() => resolveCurrentClass(classes, stored), [classes, stored]);
  const setClassId = useCallback((id: number | null) => {
    setStored(id);
    safeStorage.set(ADMIN_CLASS_KEY, id === null ? null : String(id));
  }, []);

  const ctx = useMemo<AdminClassState>(
    () => ({ classes, loading: classesQ.isPending, classId, currentClass: classes.find((c) => c.id === classId) ?? null, setClassId }),
    [classes, classesQ.isPending, classId, setClassId],
  );

  // Close the drawer after navigating and on Esc.
  useEffect(() => setNavOpen(false), [location.pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <AdminClassContext.Provider value={ctx}>
      <ToastProvider>
        <div className="min-h-dvh bg-app lg:flex">
          <a href="#admin-main" className="sr-only z-50 rounded-lg bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
            Skip to content
          </a>

          {/* Top bar (tablet/phone) */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="-ml-1 rounded-lg p-2 hover:bg-zinc-100"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              aria-controls="admin-sidebar"
            >
              <IconMenu size={20} />
            </button>
            <Logo size={29} sub="Admin" textClassName="text-[15px] font-semibold" />
          </header>

          {navOpen && <div className="fixed inset-0 z-40 bg-zinc-950/30 lg:hidden" aria-hidden="true" onClick={() => setNavOpen(false)} />}

          <aside
            id="admin-sidebar"
            className={cx(
              "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-surface transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:shrink-0 lg:translate-x-0",
              navOpen ? "translate-x-0 shadow-xl" : "-translate-x-full max-lg:invisible",
            )}
            aria-label="Admin navigation"
          >
            <Sidebar me={me} ctx={ctx} classesError={classesQ.isError} onClose={() => setNavOpen(false)} />
          </aside>

          {/* Figma admin frames: 248 px sidebar, 40 px gutters, title block starts 26 px from the top */}
          <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:pb-10 lg:pt-[26px]">
            <div className="mx-auto max-w-[1360px]">
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </ToastProvider>
    </AdminClassContext.Provider>
  );
}

function Sidebar({ me, ctx, classesError, onClose }: { me: AdminMe; ctx: AdminClassState; classesError: boolean; onClose: () => void }) {
  const logout = useLogout();
  const navigate = useNavigate();
  const config = useAppConfig();
  const selectId = useId();
  const method = loginMethodStore.get() ?? (config.data && !config.data.googleClientId ? "dev" : "google");
  const initial = (me.admin.name || me.admin.email).trim().charAt(0).toUpperCase() || "A";

  return (
    <>
      <div className="flex items-center justify-between px-6 pt-[26px]">
        <Logo size={29} sub="Admin" textClassName="text-[15px] font-semibold" />
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-zinc-100 lg:hidden" aria-label="Close navigation">
          <IconClose />
        </button>
      </div>

      <nav className="mt-[31px] flex-1 overflow-y-auto px-4" aria-label="Admin sections">
        <ul className="space-y-1">
          {NAV.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cx(
                    "flex h-11 items-center gap-[13px] rounded-xl px-3 text-[15px] transition-colors",
                    isActive ? "bg-[#e9eaee] font-semibold text-gray-800" : "text-muted hover:bg-zinc-50 hover:text-ink",
                  )
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-4 pb-6">
        <div className="rounded-xl bg-app px-3 py-[13px]">
          <label htmlFor={selectId} className="block text-[12px] uppercase leading-4 text-faint">
            Current class
          </label>
          {ctx.loading ? (
            <p className="mt-1 text-[13px] text-muted">Loading…</p>
          ) : classesError ? (
            <p className="mt-1 text-xs text-danger">Couldn’t load classes.</p>
          ) : ctx.classes.length === 0 ? (
            <p className="mt-1 text-[13px] text-muted">No active classes</p>
          ) : (
            // Looks like plain text (Figma) but stays a native select so the instructor can switch class.
            <select
              id={selectId}
              value={ctx.classId ?? ""}
              onChange={(e) => ctx.setClassId(Number(e.target.value))}
              title="Change the current class"
              className="mt-1 w-full cursor-pointer appearance-none truncate rounded bg-transparent p-0 text-[13px] font-semibold leading-5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-tests"
            >
              {ctx.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-[14px] flex items-center gap-[11px] px-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9eaee] text-[13px] font-semibold text-gray-800" aria-hidden="true">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-[18px]" title={me.admin.email}>
              {me.admin.name || me.admin.email}
            </p>
            <p className="text-[12px] leading-4 text-muted">admin · {method === "dev" ? "dev" : "Google"}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-faint hover:bg-zinc-100 hover:text-ink disabled:opacity-50"
            aria-label="Sign out"
            title="Sign out"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => {
                  loginMethodStore.clear();
                  navigate("/admin/login", { replace: true });
                },
              })
            }
          >
            <IconLogout />
          </button>
        </div>
      </div>
    </>
  );
}
