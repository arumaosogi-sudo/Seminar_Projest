import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeftIcon } from "./icons";

export type Crumb = { to?: string; label: string };

/**
 * Page header for student sub-pages (Figma "Tests – List / Result", "Games Hub", …).
 *   Phone  (<768): white bar with a back chevron, 17 px title and a 12 px subtitle (the app top bar is hidden there).
 *   Tablet/Desktop: breadcrumb "Home / Tests", 33/41 px bold title, 15 px subtitle and an optional right-hand slot.
 */
export function StudentPageHeader({
  title,
  subtitle,
  crumbs,
  back,
  phoneTitle,
  phoneSubtitle,
  phoneRight,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  crumbs: Crumb[];
  /** Where the phone back chevron goes. */
  back: string;
  phoneTitle?: string;
  phoneSubtitle?: ReactNode;
  phoneRight?: ReactNode;
  /** Tablet/desktop right-hand slot on the subtitle row (e.g. filter pills). */
  right?: ReactNode;
}) {
  return (
    <>
      {/* Phone bar — bleeds over the 16 px page gutter and sticks to the top. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-[15px] mb-4 flex min-h-[64px] items-center gap-2 bg-surface px-3 md:hidden">
        <Link to={back} className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-zinc-100" aria-label="Back">
          <ChevronLeftIcon size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold leading-[22px] text-ink">{phoneTitle ?? title}</h1>
          {(phoneSubtitle ?? subtitle) && <p className="truncate text-[12px] leading-4 text-muted">{phoneSubtitle ?? subtitle}</p>}
        </div>
        {phoneRight}
      </div>

      <div className="hidden md:block">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                  {c.to && !last ? (
                    <Link to={c.to} className="rounded hover:text-ink hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    <span className={last ? "font-semibold text-ink" : undefined} aria-current={last ? "page" : undefined}>
                      {c.label}
                    </span>
                  )}
                  {!last && <span aria-hidden="true">/</span>}
                </li>
              );
            })}
          </ol>
        </nav>
        <h1 className="mt-4 text-[33px] font-bold leading-10 text-ink lg:mt-5 lg:text-[36px] lg:leading-[44px]">{title}</h1>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          {subtitle ? <p className="text-[15px] leading-[22px] text-muted">{subtitle}</p> : <span />}
          {right}
        </div>
      </div>
    </>
  );
}
