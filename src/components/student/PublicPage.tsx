import type { ReactNode } from "react";
import { Link } from "react-router";
import { DraftBadge, Logo } from "@/components/ui";
import { useMe } from "@/lib/auth";

/** Simple shell for public reading pages (/credits, /privacy, 404) — works signed in or out. */
export function PublicPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  const me = useMe();
  const back = me.data?.role === "admin" ? { to: "/admin", label: "Dashboard" } : me.data ? { to: "/", label: "Home" } : { to: "/login", label: "Sign in" };

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
          <Link to={back.to} className="rounded-lg" aria-label={`Digital Muscle — ${back.label}`}>
            <Logo size={30} />
          </Link>
          <div className="flex items-center gap-3">
            <Link to={back.to} className="rounded text-sm font-semibold text-muted hover:text-ink">
              ← {back.label}
            </Link>
            <DraftBadge />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {intro && <div className="mt-3 text-[15px] text-muted">{intro}</div>}
        <div className="mt-8 space-y-6">{children}</div>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-5 text-xs text-muted">
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
    </div>
  );
}

/** White card section used on the reading pages. */
export function ProseCard({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-7">
      <h2 className="text-lg font-bold">{heading}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-zinc-700">{children}</div>
    </section>
  );
}
