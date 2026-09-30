import { Link, useLocation } from "react-router";
import { useMe } from "@/lib/auth";
import { Logo } from "@/components/ui";

export default function NotFound() {
  const { pathname } = useLocation();
  const me = useMe();
  const home = me.data?.role === "admin" ? { to: "/admin", label: "Go to the dashboard" } : me.data ? { to: "/", label: "Go Home" } : { to: "/login", label: "Go to sign in" };

  return (
    <main className="grid min-h-dvh place-items-center bg-app px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <Logo withText={false} size={48} />
        </div>
        <p className="mt-8 text-sm font-bold uppercase tracking-wide text-muted">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-3 break-words text-[15px] text-muted">
          We couldn't find <span className="font-mono text-ink">{pathname}</span>. The link may be old or mistyped.
        </p>
        <Link
          to={home.to}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          {home.label}
        </Link>
      </div>
    </main>
  );
}
