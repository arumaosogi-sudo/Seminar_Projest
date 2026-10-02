import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

/**
 * Shared shell for /login and /onboarding — Figma frames "Login 1 – Sign in" / "Login 2 – First name".
 *   Phone  (<768)    : 300 px hero band (logo · title · tagline), card overlaps it at y = 226
 *   Tablet (768–1023): 440 px hero band, 480 px card overlaps it at y = 330
 *   Desktop (≥1024)  : left half = full-bleed anatomy image with the pitch · right half = grey panel, card centred
 * Measurements come straight from the Figma SVG export (see docs/DESIGN_NOTES.md).
 */
export function AuthShell({ children, below }: { children: ReactNode; below?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-login-panel lg:grid lg:grid-cols-2">
      <DesktopHero />
      <CompactHero />

      <main className="relative flex flex-1 flex-col items-center px-4 lg:justify-center lg:px-10 lg:py-12">
        <div className="relative z-10 -mt-[74px] w-full md:-mt-[110px] md:w-[480px] lg:mt-0 lg:w-[440px]">
          <section className="rounded-[20px] border border-line bg-surface p-6">{children}</section>
          {below && <div className="mt-4">{below}</div>}
        </div>
        <p className="mt-auto pb-6 pt-10 text-center text-[13px] text-muted lg:hidden">Mae Fah Luang University · Key Point Book</p>
      </main>
    </div>
  );
}

const FEATURES = [
  { title: "Web games", detail: "Balloon Pop · Group Sort · Diameter" },
  { title: "Interactive 3D", detail: "Zoom into the sarcomere and contract it" },
  { title: "Pretest & posttest", detail: "Instant results for you and your teacher" },
];

const HERO_ALT = "Three anatomical figures running: muscles, muscles over the skeleton, and the skeleton";

function DesktopHero() {
  return (
    <aside className="sticky top-0 hidden h-dvh min-h-[760px] overflow-hidden bg-white lg:block">
      <picture>
        <source type="image/webp" srcSet="/images/login-hero-desktop-720.webp 720w, /images/login-hero-desktop-1440.webp 1440w" sizes="50vw" />
        <img
          src="/images/login-hero-desktop-720.webp"
          width={720}
          height={1024}
          alt={HERO_ALT}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 size-full object-cover object-center"
        />
      </picture>

      <div className="relative flex h-full flex-col px-12 py-24 xl:px-24">
        <Logo variant="hero" size={56} withText={false} />
        <h1 className="mt-[131px] text-[56px] font-black leading-[62px] tracking-[-0.02em] text-ink">Digital Muscle</h1>
        <p className="mt-[29px] text-[20.5px] font-medium leading-8 text-ink">
          Learn the muscular system,
          <br />
          from whole muscle to sarcomere.
        </p>
        <ol className="mt-[75px] space-y-[31px]">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="flex items-center gap-4">
              <span className="grid size-[45px] shrink-0 place-items-center rounded-xl border border-line bg-white/85 text-[15px] font-semibold text-ink">
                {i + 1}
              </span>
              <span className="leading-tight">
                <span className="block text-[16.5px] font-bold text-ink">{f.title}</span>
                <span className="mt-0.5 block text-[14px] text-ink">{f.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-auto text-[12px] font-medium text-ink">Mae Fah Luang University · Key Point Book</p>
      </div>
    </aside>
  );
}

function CompactHero() {
  return (
    <header className="relative h-[300px] shrink-0 overflow-hidden bg-white md:h-[440px] lg:hidden">
      <picture>
        <source media="(min-width: 768px)" type="image/webp" srcSet="/images/login-hero-tablet-834.webp 834w, /images/login-hero-tablet-1668.webp 1668w" sizes="100vw" />
        <source type="image/webp" srcSet="/images/login-hero-phone-390.webp 390w, /images/login-hero-phone-780.webp 780w" sizes="100vw" />
        <img
          src="/images/login-hero-phone-390.webp"
          width={390}
          height={300}
          alt={HERO_ALT}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 size-full object-cover object-top"
        />
      </picture>
      <div className="relative flex flex-col items-center pt-12 text-center md:pt-[70px]">
        <span className="md:hidden">
          <Logo variant="hero" size={51} withText={false} />
        </span>
        <span className="hidden md:inline-flex">
          <Logo variant="hero" size={75} withText={false} />
        </span>
        <h1 className="mt-[19px] text-[28px] font-bold leading-[34px] text-ink md:text-[38px] md:leading-[46px]">Digital Muscle</h1>
        <p className="mt-4 text-[14.5px] leading-5 text-ink md:mt-[18px] md:text-[20px] md:leading-7">Interactive muscular tissue learning</p>
      </div>
    </header>
  );
}

/** Small pill shown at the top of the card ("Section 1 · 2569/1 · via QR", "Step 2 of 2"). */
export function CardChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[25px] items-center gap-1.5 rounded-full bg-[#e9eaee] px-3 text-[12px] font-medium text-gray-800">
      {children}
    </span>
  );
}
