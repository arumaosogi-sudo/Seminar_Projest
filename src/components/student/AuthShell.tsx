import type { ReactNode } from "react";
import { Card, DraftBadge, Logo } from "@/components/ui";

/**
 * Shared shell for /login and /onboarding (Figma "Login" frames).
 *   ≥1024px: two halves — hero (image + product pitch) | grey panel with the centered card
 *   <1024px: hero image as a top band, the card overlaps it, grey panel below
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-login-panel lg:grid lg:grid-cols-2">
      <DesktopHero />
      <CompactHero />

      <main className="relative flex flex-1 flex-col items-center px-4 pb-10 sm:px-6 lg:justify-center lg:py-12">
        <div className="absolute right-4 top-4 hidden lg:block">
          <DraftBadge />
        </div>
        <Card className="relative z-10 -mt-20 w-full max-w-[440px] p-6 shadow-xl shadow-zinc-900/10 sm:-mt-24 sm:p-8 lg:mt-0">
          {children}
        </Card>
        <p className="mt-6 text-center text-xs text-zinc-800 lg:hidden">Mae Fah Luang University · Key Point Book</p>
      </main>
    </div>
  );
}

function HeroPicture({ className, sizes }: { className: string; sizes: string }) {
  return (
    <picture>
      <source type="image/webp" srcSet="/images/login-hero-560.webp 560w, /images/login-hero-960.webp 960w" sizes={sizes} />
      <img
        src="/images/login-hero-960.webp"
        width={960}
        height={931}
        alt="Three anatomical figures running: muscles, muscles over the skeleton, and the skeleton"
        fetchPriority="high"
        decoding="async"
        className={className}
      />
    </picture>
  );
}

const FEATURES = [
  { title: "Web games", detail: "Balloon Pop · Group Sort · Diameter" },
  { title: "Interactive 3D", detail: "Zoom into the sarcomere and contract it" },
  { title: "Pretest & posttest", detail: "Instant results for you and your teacher" },
];

function DesktopHero() {
  return (
    <aside className="sticky top-0 hidden h-dvh min-h-[640px] flex-col overflow-hidden bg-white px-12 py-10 lg:flex xl:px-16">
      <div className="relative z-10">
        <Logo size={44} withText={false} />
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-ink">Digital Muscle</h1>
        <p className="mt-3 max-w-md whitespace-pre-line text-lg leading-snug text-muted">
          {"Learn the muscular system,\nfrom whole muscle to sarcomere."}
        </p>
      </div>

      <div className="relative -mx-6 my-4 min-h-0 flex-1">
        <HeroPicture sizes="50vw" className="absolute inset-0 size-full object-contain" />
      </div>

      <div className="relative z-10">
        <ol className="space-y-3">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-white text-sm font-bold shadow-sm">
                {i + 1}
              </span>
              <span className="text-[15px]">
                <span className="font-semibold">{f.title}</span>
                <span className="text-muted"> — {f.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-xs font-medium text-faint">Mae Fah Luang University · Key Point Book</p>
      </div>
    </aside>
  );
}

function CompactHero() {
  return (
    <header className="relative h-[40vh] min-h-[260px] max-h-[420px] overflow-hidden bg-white lg:hidden">
      <HeroPicture sizes="100vw" className="absolute inset-0 size-full object-cover object-[50%_30%] opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/40 to-white/80" aria-hidden="true" />
      <div className="absolute right-3 top-3">
        <DraftBadge />
      </div>
      <div className="relative flex h-full flex-col items-center pt-8 text-center sm:pt-12">
        <Logo size={40} withText={false} />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Digital Muscle</h1>
        <p className="mt-1 text-sm font-medium text-zinc-700 sm:text-base">Interactive muscular tissue learning</p>
      </div>
    </header>
  );
}

/** Small pill shown at the top of the card ("Section 1 · 2569/1 · via QR", "Step 2 of 2"). */
export function CardChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
      {children}
    </span>
  );
}
