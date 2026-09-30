import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useLogout } from "@/lib/auth";
import { cx, Logo } from "@/components/ui";
import { RequireStudent, useStudentMe } from "./RequireStudent";
import { BalloonIcon, ChecklistIcon, CubeIcon, HouseIcon } from "./icons";

type NavItem = {
  to: string;
  label: string; // desktop (≥1024)
  short: string; // tablet + phone tab bar
  icon: ComponentType<{ size?: number }>;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Home", short: "Home", icon: HouseIcon, end: true },
  { to: "/games", label: "Games", short: "Games", icon: BalloonIcon },
  { to: "/explore", label: "3D Explore", short: "3D", icon: CubeIcon },
  { to: "/tests", label: "Tests", short: "Tests", icon: ChecklistIcon },
];

/** Route element for "/" and its children: guard + responsive nav + footer. */
export default function StudentLayout() {
  return (
    <RequireStudent>
      <Shell />
    </RequireStudent>
  );
}

function Shell() {
  const { pathname } = useLocation();


  // Scroll to top on page change (SPA navigation keeps the old scroll position otherwise).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <TopBar />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-10">
          <Outlet />
        </div>
      </main>
      <Footer />
      <BottomTabs />
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6 md:h-16 lg:h-[72px] lg:px-8">
        <Link to="/" className="shrink-0 rounded-lg" aria-label="Digital Muscle — Home">
          <Logo size={30} />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-stretch gap-1 lg:gap-2">
            {NAV.map((item) => (
              <li key={item.to} className="flex">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      "relative flex h-16 items-center rounded-md px-3 text-[15px] transition-colors lg:h-[72px] lg:px-4",
                      isActive ? "font-bold text-ink" : "font-medium text-muted hover:text-ink",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="hidden lg:inline">{item.label}</span>
                      <span className="lg:hidden">{item.short}</span>
                      {isActive && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ink lg:inset-x-4" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto md:ml-0">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  const me = useStudentMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const firstName = me.student.firstName ?? me.student.studentCode;
  const initial = (me.student.firstName?.trim()[0] ?? "S").toUpperCase();
  const className = me.enrollment?.className ?? "No class yet";

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = () =>
    logout.mutate(undefined, {
      onSuccess: () => navigate("/login", { replace: true }),
    });

  return (
    <div ref={wrapRef} className="relative flex items-center gap-3">
      <div className="hidden text-right leading-tight lg:block">
        <p className="max-w-[12rem] truncate text-sm font-bold">{firstName}</p>
        <p className="max-w-[12rem] truncate text-xs text-muted">{className}</p>
      </div>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${firstName}`}
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-full bg-ink text-sm font-bold text-white transition-shadow hover:ring-4 hover:ring-zinc-200 lg:size-10"
      >
        {initial}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-lg shadow-zinc-900/5"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-bold">{firstName}</p>
            <p className="truncate text-xs text-muted">{me.student.studentCode}</p>
            <p className="truncate text-xs text-muted">{className}</p>
          </div>
          <button
            ref={firstItemRef}
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={logout.isPending}
            className="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-danger hover:bg-zinc-50 focus-visible:bg-zinc-50 disabled:opacity-50"
          >
            {logout.isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function BottomTabs() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV.map(({ to, short, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  isActive ? "text-ink" : "text-faint hover:text-muted",
                )
              }
            >
              <Icon size={22} />
              {short}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Footer() {
  return (
    // Extra bottom padding on phones so the fixed tab bar never covers the footer or page content.
    <footer className="border-t border-line bg-app pb-24 md:pb-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
        <Link to="/credits" className="rounded hover:text-ink hover:underline">
          Credits
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className="rounded hover:text-ink hover:underline">
          Privacy notice
        </Link>
        <span aria-hidden="true">·</span>
        <span>Mae Fah Luang University</span>
      </div>
    </footer>
  );
}
