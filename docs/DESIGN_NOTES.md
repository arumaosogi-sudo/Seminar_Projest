# Design notes — matching the Figma file

Source of truth: Figma **seminar_project**, page **"the idea อันล่าสุดที่ทำและได้แก้ไขไป"**
(`https://www.figma.com/design/aZhYZrkD3tMyQi0lDxI9Tq/seminar_project`).
Frame sizes: **Desktop 1440**, **Tablet 834**, **Phone 390** → Tailwind breakpoints: phone `< md (768)`, tablet `md`, desktop `lg (1024)`.

Measurements in this repo were read from each frame's SVG export (Figma → *Copy as SVG*), so sizes are exact
pixels, not guesses. When you build a new page, do the same: export the frame and copy the numbers.

## Tokens (`src/index.css`)

| Token | Value | Used for |
|---|---|---|
| `bg-app` | `#F7F7F8` | page background |
| `text-ink` | `#18181B` | headings / body |
| `text-muted` | `#71717A` | secondary text |
| `text-faint` | `#A1A1AA` | table headers, hints |
| `border-line` | `#E4E4E7` | card + input borders |
| `bg-login-panel` | `#A4A29F` | grey panel behind the login card |
| `games` / `explore` / `tests` | violet-600 / teal-600 / blue-600 | menu accents |
| `text-gray-800` | `#1F2937` | dark buttons, active nav, chip text |
| `#E9EAEE` | — | chips, avatar circles, active sidebar item |
| `#F0F0F2` | — | neutral chips, segmented-control track |
| `#E8F5EC` + `text-success` | — | "Active" / "Done" chips |

Font: **Inter** (variable, self-hosted). Common sizes: page title 32 bold (admin) / 41 bold (student greeting),
card title 17–26 semibold, body 14–15, labels 12–13.

## Shapes

| Element | Figma |
|---|---|
| Card | 20 px radius, 1 px `border-line`, white, no shadow |
| Primary / secondary button | 44 px (or 43 px outline) tall, 12 px radius, 15 px semibold |
| Input / search / filter field | 43 px tall, 11.5 px radius, 15 px left padding, no icon |
| Chip | 25 px tall pill, 12 px semibold |
| Switch | 40×24 track, 18 px knob, blue when on |
| Segmented control | 44 px `#F0F0F2` track, 36 px white active segment with blue text |

Shared components already implement these: `Card`, `Button`, `DraftBadge`, `Logo` (`src/components/ui`),
`FilterPills`, `FilterSelect`, `SearchBox`, `StatusChip`, `StatCard`, `Segmented`, `Switch`, `SettingRow`
(`src/components/admin/controls.tsx`). Prefer them over new one-off styles.

## Layouts

* **Student shell** (`StudentLayout`): 72 px white top bar (64 px on phone), logo tile 31 px, nav 15 px with a
  34×3 px underline on the active item; content column 1200 px (120 px gutters at 1440, 40 px on tablet, 16 px on phone);
  phone has a 75 px bottom tab bar and no footer (Credits / Privacy live in the account menu).
* **Admin shell** (`AdminLayout`): 248 px white sidebar, 44 px nav items (active `#E9EAEE`), "Current class" box and
  user row at the bottom; content has 40 px gutters, title block 26 px from the top. Admin frames exist for desktop only.
* **Login** (`AuthShell`): desktop = left half full-bleed anatomy image + pitch, right half grey with the 440 px card
  centred; tablet/phone = 440/300 px hero band with the card overlapping it (480 px / full-width).

## Images (`public/images`)

| File | What |
|---|---|
| `logo.png` | App mark (flexed arm), from the Figma file |
| `login-hero-{desktop,tablet,phone}-*.webp` | Login backgrounds, two widths each (1× / 2×) |
| `menu-{games,explore,tests}.png` | Home card icons (168 px, drawn at 84 / 48 / 28 px) |

The images embedded in the Figma file were screenshots that already contained the logo, title and card text, so they
can't be used as backgrounds directly. The login heroes were therefore **recomposed** from the clean source illustration,
using the same crop, scale and white fade as each Figma frame (template-matched, error ≈ 3/255).
⚠️ The original source and licence of the anatomy illustration and logo still need to be confirmed (rule R7) — see `/credits`.

## Known, intentional differences from Figma

* **Tablet top bar** keeps the nav links (as in the Games / 3D / Tests tablet frames); the Home tablet frame omits them.
* **Dev-only UI** ("Developer mode" sign-in box, "Google sign-in isn't configured yet") appears only on localhost while
  `DEV_LOGIN=true` / no `GOOGLE_CLIENT_ID`; production matches the frames.
* **Google button**: our button is drawn to the Figma spec and Google's official button is laid over it invisibly,
  so the real Google flow still handles the click.
* **Students → Delete / anonymize** (PDPA step 3) is in each row's ⋯ menu (export first, then type the ID to confirm);
  the Figma panel only shows the retention steps as text. A "Not joined (n)" pill appears only when roster students
  haven't joined yet.
* **Classes → selected panel** omits the stray outline box around Edit / Archive in the Figma frame (looked like a leftover layer).
* **Test builder toolbar**: only "+ add question" works; "T", image and section buttons are shown disabled ("coming soon").
