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
      {/* Figma phone frames: only Home shows the logo bar; sub-pages use their own back-arrow header. */}
      <TopBar phoneHidden={pathname !== "/"} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {/* Figma content column: 1200 px on desktop (120 px gutters at 1440), 40 px gutters on tablet, 16 px on phone */}
        <div className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-[15px] md:pb-10 md:px-10 md:pt-[26px] lg:pt-[42px]">
          <Outlet />
        </div>
      </main>
      <Footer />
      <BottomTabs />
    </div>
  );
}

function TopBar({ phoneHidden }: { phoneHidden: boolean }) {
  return (
    <header className={cx("sticky top-0 z-30 bg-surface", phoneHidden && "max-md:hidden")}>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 md:h-[72px] md:px-10 lg:px-20">
        <Link to="/" className="shrink-0 rounded-lg" aria-label="Digital Muscle — Home">
          <Logo size={31} textClassName="text-[17px] font-semibold lg:text-[18px]" />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-stretch gap-6 lg:gap-14">
            {NAV.map((item) => (
              <li key={item.to} className="flex">
                <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cx(
                        "relative flex h-[72px] items-center rounded-md text-[15px] transition-colors",
                        isActive ? "font-semibold text-gray-800" : "text-muted hover:text-ink",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className="hidden lg:inline">{item.label}</span>
                        <span className="lg:hidden">{item.short}</span>
                        {isActive && (
                          <span aria-hidden="true" className="absolute bottom-0.5 left-1/2 h-[3px] w-[34px] -translate-x-1/2 rounded-full bg-gray-800" />
                        )}
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
  // Figma top bar shows "Section 1 · 2569/1" (section first); className is "2569/1 · Section 1".
  const className = me.enrollment ? me.enrollment.className.split(" · ").reverse().join(" · ") : "No class yet";

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
      <div className="hidden text-right md:block">
        <p className="max-w-[12rem] truncate text-[14px] font-semibold leading-5 text-ink">{firstName}</p>
        <p className="max-w-[12rem] truncate text-[12px] leading-4 text-muted">{className}</p>
      </div>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${firstName}`}
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-full bg-[#e9eaee] text-[14px] font-semibold text-gray-800 transition-shadow hover:ring-4 hover:ring-zinc-200"
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
          {/* The phone layout has no footer (Figma) — keep Credits / Privacy reachable from here. */}
          <div className="border-t border-line md:hidden">
            <Link to="/credits" role="menuitem" className="block px-4 py-2.5 text-sm text-muted hover:bg-zinc-50">
              Credits
            </Link>
            <Link to="/privacy" role="menuitem" className="block px-4 py-2.5 text-sm text-muted hover:bg-zinc-50">
              Privacy notice
            </Link>
          </div>
          {logout.isError && (
            <p role="alert" className="px-4 pb-2.5 text-xs text-danger">
              Couldn't sign out. Check your connection and try again.
            </p>
          )}
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
                  "flex h-[75px] flex-col items-center justify-center gap-1.5 text-[11.5px] font-semibold transition-colors",
                  isActive ? "text-gray-800" : "text-faint hover:text-muted",
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
    <footer className="hidden bg-app md:block">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 pb-[30px] pt-5 text-[13px] text-muted md:px-10">
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
