import { ProseCard, PublicPage } from "@/components/student/PublicPage";

const LIBRARIES: { name: string; licence: string; url: string }[] = [
  { name: "React", licence: "MIT", url: "https://react.dev" },
  { name: "React Router", licence: "MIT", url: "https://reactrouter.com" },
  { name: "TanStack Query", licence: "MIT", url: "https://tanstack.com/query" },
  { name: "Tailwind CSS", licence: "MIT", url: "https://tailwindcss.com" },
  { name: "Vite", licence: "MIT", url: "https://vite.dev" },
  { name: "Hono", licence: "MIT", url: "https://hono.dev" },
  { name: "Zod", licence: "MIT", url: "https://zod.dev" },
  { name: "jose", licence: "MIT", url: "https://github.com/panva/jose" },
  { name: "dnd kit", licence: "MIT", url: "https://dndkit.com" },
  { name: "three.js", licence: "MIT", url: "https://threejs.org" },
  { name: "React Three Fiber & drei", licence: "MIT", url: "https://r3f.docs.pmnd.rs" },
  { name: "Inter typeface (Fontsource)", licence: "SIL Open Font License 1.1", url: "https://rsms.me/inter/" },
];

export default function Credits() {
  return (
    <PublicPage title="Credits" intro="The people, content and open-source software behind Digital Muscle.">
      <ProseCard heading="Content">
        <p>
          Learning content is based on the <strong>Key Point Book</strong> by Asst. Prof. Dr. Keerakarn Somsuan, School of
          Medicine, Mae Fah Luang University.
        </p>
        <p>Digital Muscle is a seminar project built for MFU anatomy students.</p>
      </ProseCard>

      <ProseCard heading="Images & 3D models">
        <figure className="overflow-hidden rounded-2xl border border-line bg-white">
          <img
            src="/images/login-hero-tablet-834.webp"
            srcSet="/images/login-hero-tablet-834.webp 834w, /images/login-hero-tablet-1668.webp 1668w"
            sizes="(min-width: 768px) 640px, 100vw"
            width={834}
            height={440}
            loading="lazy"
            decoding="async"
            alt="Three anatomical figures running: muscles, muscles over the skeleton, and the skeleton"
            className="mx-auto h-auto max-h-72 w-auto"
          />
          <figcaption className="border-t border-line px-4 py-3 text-sm text-muted">
            Login hero and app logo — taken from the team's Figma design. Original source and licence to be confirmed.
          </figcaption>
        </figure>
        <p className="text-sm text-muted">
          3D models used in 3D Explore will be listed here with their author, source and licence (requirement 3D-14).
        </p>
      </ProseCard>

      <ProseCard heading="Open-source software">
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {LIBRARIES.map((l) => (
            <li key={l.name} className="flex items-baseline justify-between gap-3 border-b border-dashed border-line pb-2 text-sm">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink hover:underline">
                {l.name}
              </a>
              <span className="shrink-0 text-muted">{l.licence}</span>
            </li>
          ))}
        </ul>
      </ProseCard>
    </PublicPage>
  );
}
