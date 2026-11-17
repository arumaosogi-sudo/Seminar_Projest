import { AirshipShapes, WizardShapes } from './art.jsx';
import { art } from './games/diameter/levels.js';
import { picUrl } from './games/sort/data.js';

// Cartoon scenes for the hub cards. Every hub cover is a still picture (the user's choice, 2026-11-15).

// Balloon Pop: the hooded sage close up, his orb glowing on the left, goblin balloons over the night castle.
// The backdrop is the game's night scene, simplified: a big moon, puffy clouds, a faded castle, a row of town houses
// and the stone wall the wizard stands behind.
const puff = (x, y, w) =>
  `M${x} ${y}a${w * 0.18} ${w * 0.18} 0 0 1 ${w * 0.26} ${-w * 0.12}a${w * 0.22} ${w * 0.22} 0 0 1 ${w * 0.4} ${-w * 0.04}` +
  `a${w * 0.17} ${w * 0.17} 0 0 1 ${w * 0.34} ${w * 0.16}z`;
const BC_CLOUDS = [puff(4, 92, 74), puff(236, 124, 82), puff(150, 108, 60)];
const BC_CASTLE =
  'M34 170V104h16v66z M30 104l12-20 12 20z M246 170V98h18v72z M242 98l13-22 13 22z ' +
  'M268 170v-36h40v36z M264 134l24-18 24 18z M92 170v-28h30v28z M88 142l19-14 19 14z';
const BC_TOWN =
  'M0 176v-26l14-12 14 12v26z M28 176v-20l16-12 16 12v20z M66 176v-30l12-10 12 10v30z ' +
  'M232 176v-24l14-12 14 12v24z M258 176v-30l16-14 16 14v30z M290 176v-20l15-12 15 12v20z';
const BC_WINDOWS = 'M8 156h5v6h-5z M38 162h5v5h-5z M72 154h5v6h-5z M240 160h5v6h-5z M266 156h5v6h-5z M280 156h5v6h-5z M298 162h5v5h-5z';
const BC_MERLONS = Array.from({ length: 14 }, (_, k) => `M${k * 24} 172h14v6h-14z`).join(' ');
const BC_BRICKS =
  'M0 186H320M0 194H320 ' + Array.from({ length: 14 }, (_, k) => `M${k * 24 + 8} 178v8M${k * 24 + 20} 186v8`).join('');

export function BalloonScene() {
  return (
    <svg viewBox="0 0 320 200" className="mg-scene mg-bc mg-still" aria-hidden="true">
      <defs>
        <linearGradient id="bc-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(250 48% 15%)" />
          <stop offset=".6" stopColor="hsl(262 45% 28%)" />
          <stop offset="1" stopColor="hsl(272 40% 36%)" />
        </linearGradient>
        <radialGradient id="bc-moon">
          <stop offset=".4" stopColor="#fde68a" stopOpacity=".45" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bc-orb">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".35" stopColor="#ffd9a8" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bc-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset=".45" stopColor="#f6c453" />
          <stop offset="1" stopColor="#b9771d" />
        </linearGradient>
        <linearGradient id="bc-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".6" stopColor="#0b0820" stopOpacity="0" />
          <stop offset="1" stopColor="#0b0820" stopOpacity=".6" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="url(#bc-night)" />
      <circle cx="292" cy="30" r="30" fill="url(#bc-moon)" />
      <circle cx="292" cy="30" r="15" fill="#fde68a" />
      <circle cx="288" cy="26" r="9" fill="#fffbeb" opacity=".55" />
      <g fill="#fff">
        <circle cx="40" cy="22" r=".9" />
        <circle cx="170" cy="14" r="1.1" />
        <circle cx="250" cy="44" r=".8" />
        <circle cx="90" cy="60" r=".8" />
      </g>
      {/* clouds behind the castle */}
      {BC_CLOUDS.map((d) => (
        <g key={d}>
          <path d={d} fill="hsl(258 24% 30%)" />
          <path d={d} fill="none" stroke="hsl(258 26% 42%)" strokeWidth="1.2" opacity=".6" />
        </g>
      ))}
      <path d={BC_CASTLE} fill="hsl(262 22% 34%)" />
      <path d={BC_TOWN} fill="hsl(258 26% 24%)" />
      <path d={BC_WINDOWS} fill="hsl(258 22% 34%)" />
      <path d={BC_MERLONS} fill="hsl(255 18% 34%)" />
      <rect y="178" width="320" height="22" fill="hsl(255 18% 34%)" />
      <path d={BC_BRICKS} stroke="hsl(255 20% 26%)" strokeWidth="1" />
      <path d="M0 178.5H320" stroke="hsl(255 18% 46%)" strokeWidth="1" />
      <g transform="translate(208 16) scale(0.3167)">
        <AirshipShapes />
      </g>
      <g transform="translate(262 58) scale(0.25)">
        <AirshipShapes />
      </g>
      <g transform="translate(34 14) scale(0.27)">
        <AirshipShapes />
      </g>
      {/* warm light from the orb */}
      <circle cx="130" cy="72" r="70" fill="url(#bc-orb)" opacity=".75" />
      {/* the wizard, mirrored so the staff and orb sit on the left, cropped at the chest */}
      <g transform="translate(276 24) scale(-0.9 0.9)">
        <WizardShapes />
      </g>
      <rect width="320" height="200" fill="url(#bc-fade)" />
      <text x="14" y="172" fontFamily="'Cinzel Decorative', Georgia, serif" fontWeight="900" fontSize="27" fill="url(#bc-gold)" stroke="#2a1606" strokeWidth="1.1" paintOrder="stroke">
        Balloon
      </text>
      <text x="16" y="192" fontFamily="'Cinzel Decorative', Georgia, serif" fontWeight="700" fontSize="15" letterSpacing="6" fill="url(#bc-gold)" stroke="#2a1606" strokeWidth=".9" paintOrder="stroke">
        POP
      </text>
    </svg>
  );
}

// Diameter: half built, half blueprint (the user's pick, 2026-11-14). The whole-muscle model from the game, split by a
// slanted line: on the left it is finished, in full colour on a warm stone backdrop; on the right the same arm is still a
// technical drawing (scripts/diameter-art/cover-lines.py), white lines on cobalt blueprint paper with a grid and
// construction nodes. The title is solid, poster style; the zoom chain the game follows reads down the bottom right.
// A still poster.
const DM_LEFT = '0,0 198,0 122,200 0,200';
const DM_RIGHT = '198,0 320,0 320,200 122,200';
// the finished half's backdrop (centre, middle, edge) and the colour of the title and caption written on it
const DM_TONE = { bg: ['#e9e5dc', '#cfc7b8', '#b5ab99'], ink: '#1d3f9e', sub: '#1d3f9e' };
export function DiameterScene() {
  return (
    <svg viewBox="0 0 320 200" className="mg-scene" aria-hidden="true">
      <defs>
        <radialGradient id="dm-studio" cx=".35" cy=".45" r=".8">
          <stop offset="0" stopColor={DM_TONE.bg[0]} />
          <stop offset=".7" stopColor={DM_TONE.bg[1]} />
          <stop offset="1" stopColor={DM_TONE.bg[2]} />
        </radialGradient>
        <pattern id="dm-fine" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" stroke="#fff" strokeOpacity=".07" strokeWidth=".5" />
        </pattern>
        <pattern id="dm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth=".6" />
        </pattern>
        <clipPath id="dm-left">
          <polygon points={DM_LEFT} />
        </clipPath>
        <clipPath id="dm-right">
          <polygon points={DM_RIGHT} />
        </clipPath>
      </defs>
      <polygon points={DM_LEFT} fill="url(#dm-studio)" />
      <polygon points={DM_RIGHT} fill="#2346b8" />
      <polygon points={DM_RIGHT} fill="url(#dm-fine)" />
      <polygon points={DM_RIGHT} fill="url(#dm-grid)" />
      {/* the same arm twice, from the same camera: finished on the left, drawn on the right */}
      <image href={art('muscle-full')} x="10" y="20" width="300" height="200" clipPath="url(#dm-left)" />
      <image href={art('cover-lines')} x="10" y="20" width="300" height="200" clipPath="url(#dm-right)" />
      <g fill="#fff" stroke="#fff">
        <line x1="198.5" y1="0" x2="121.5" y2="200" strokeWidth=".9" />
        <circle cx="187" cy="30" r="2.2" />
        <circle cx="137" cy="160" r="2.2" />
      </g>
      <text x="12" y="44" fontFamily="'Inter Variable', 'Nunito Sans Variable', sans-serif" fontWeight="800" fontSize="30" letterSpacing="1.2" fill={DM_TONE.ink}>
        DIAMETER
      </text>
      <g fontFamily="ui-monospace, Consolas, 'Cascadia Mono', Menlo, monospace" fontSize="5.6" letterSpacing="1">
        <text x="13" y="55" fill={DM_TONE.sub}>OL3 · BUILD THE MUSCLE</text>
        <text x="308" y="162" fill="#fff" textAnchor="end">WHOLE MUSCLE ▶</text>
        <text x="308" y="170" fill="#fff" textAnchor="end">FASCICLE ▶ FIBER</text>
        <text x="308" y="178" fill="#fff" textAnchor="end">▶ MYOFIBRIL ▶ SARCOMERE</text>
        <text x="308" y="186" fill="#fff" textAnchor="end">▶ MYOFILAMENTS</text>
      </g>
    </svg>
  );
}

const GS_INK = '#141010';

// Group Sort hub card: the two mode covers cut down the middle and joined, Picture Match on the left and
// Conveyor Sort on the right. Their own characters are left out; instead one character stands on the seam, the
// detective's half (mirrored so the pipe shows) and the worker's half. The title is split across the top too:
// "Group" on the detective's half, "SORT" on the factory's; the two mode names sit along the bottom.
export function GroupSortScene() {
  return (
    <svg viewBox="0 0 320 200" className="mg-scene mg-still" aria-hidden="true">
      <defs>
        <clipPath id="gss-fig-left">
          <rect x="-60" y="-110" width="60" height="115" />
        </clipPath>
        <clipPath id="gss-fig-right">
          <rect y="-110" width="60" height="115" />
        </clipPath>
        <radialGradient id="gss-glow" cx="0.5" cy="0.6" r="0.5">
          <stop offset="0" stopColor="#efe3cc" stopOpacity="0.32" />
          <stop offset="1" stopColor="#efe3cc" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gss-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* each half shows a 120 x 150 window of its cover, scaled up to fill 160 x 200 */}
      <svg width="160" height="200" viewBox="0 0 120 150" overflow="hidden">
        <svg width="320" height="150">
          <DetectiveCoverScene nested bare />
        </svg>
      </svg>
      <svg x="160" width="160" height="200" viewBox="170 0 120 150" overflow="hidden">
        <svg width="320" height="150">
          <ConveyorCoverScene nested bare />
        </svg>
      </svg>
      <rect width="160" height="200" fill="url(#gss-glow)" />
      <rect width="320" height="58" fill="url(#gss-top)" />
      <path d="M160 0 V200" stroke="#f5ecd8" strokeWidth="1.4" />

      {/* the split character on the seam */}
      <g transform="translate(160 204) scale(1.5)" style={{ transformBox: 'view-box' }}>
        <g clipPath="url(#gss-fig-left)">
          <g transform="scale(-1 1)" style={{ transformBox: 'view-box' }}>
            <NoirDetective />
          </g>
        </g>
        {/* the worker is drawn a little narrower than the detective; widen it so the shoulders meet */}
        <g clipPath="url(#gss-fig-right)">
          <g transform="scale(1.15 1)" style={{ transformBox: 'view-box' }}>
            <CoverWorker />
          </g>
        </g>
      </g>

      {/* the title, one word on each side of the seam: "Group" for the detective, its o a magnifying glass... */}
      <g fontFamily="'Cinzel Decorative', Georgia, serif" fontWeight="900" fontSize="22" fill="#fff" stroke={GS_INK} strokeWidth="2.2" strokeLinejoin="round" paintOrder="stroke">
        <text x="95.5" y="38" textAnchor="end">Gr</text>
        <text x="114.5" y="38">up</text>
      </g>
      <GsLens x={105} y={30.3} />
      {/* ...and "SORT" stencilled black on a yellow steel plate for the factory, its O a hex nut */}
      {/* just around the letters, with deep cut corners and a rivet at each end */}
      <g transform="translate(165 19)">
        <path d="M6 0H74L80 6V17L74 23H6L0 17V6Z" fill="#facc15" stroke={GS_INK} strokeWidth="1.6" />
        <rect x="2.3" y="10.2" width="2.6" height="2.6" fill={GS_INK} />
        <rect x="75.1" y="10.2" width="2.6" height="2.6" fill={GS_INK} />
      </g>
      <g fontFamily="'Black Ops One', 'Nunito Sans Variable', sans-serif" fontSize="22" fill={GS_INK}>
        <text x="188" y="38" textAnchor="end">S</text>
        <text x="209" y="38">RT</text>
      </g>
      <GsNut x={198.5} y={30.5} />

      {/* the two mode names along the bottom, in the same two styles */}
      <text x="12" y="188" fontFamily="'Cinzel Decorative', Georgia, serif" fontWeight="900" fontSize="11" letterSpacing="0.6" fill="#fff" stroke={GS_INK} strokeWidth="1.6" strokeLinejoin="round" paintOrder="stroke">
        Picture Match
      </text>
      <g transform="translate(212 176)">
        <path d="M4 0H92L96 4V12L92 16H4L0 12V4Z" fill="#facc15" stroke={GS_INK} strokeWidth="1.3" />
        <text x="48" y="11.6" textAnchor="middle" fontFamily="'Black Ops One', 'Nunito Sans Variable', sans-serif" fontSize="9.5" fill={GS_INK}>
          CONVEYOR SORT
        </text>
      </g>
    </svg>
  );
}

// a black magnifying glass for the o of "Group", as tall as the capitals, outlined in cream so it reads on the
// dark half
function GsLens({ x, y }) {
  const lens = (stroke, w) => (
    <g fill="none" stroke={stroke} strokeLinecap="round">
      <circle cx={x} cy={y} r="6.6" strokeWidth={2.4 + w} />
      <path d={`M${x + 4.8} ${y + 4.8}l2 2`} strokeWidth={2.4 + w} />
      <path d={`M${x + 6.8} ${y + 6.8}l3.6 3.6`} strokeWidth={4.2 + w} />
    </g>
  );
  return (
    <g>
      {lens('#f5ecd8', 2.2)}
      <circle cx={x} cy={y} r="6.6" fill="#cfe3ea" fillOpacity="0.35" />
      {lens(GS_INK, 0)}
      <path d={`M${x - 3.9} ${y - 0.8}a4 4 0 0 1 3 -3`} fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
    </g>
  );
}

// a black hex nut with a yellow hole for the O of "SORT", flat on top and bottom and as tall as the capitals
function GsNut({ x, y }) {
  const corners = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i * Math.PI) / 3;
    return `${(x + Math.cos(a) * 8.6).toFixed(1)},${(y + Math.sin(a) * 8.6).toFixed(1)}`;
  });
  return (
    <g>
      <polygon points={corners.join(' ')} fill={GS_INK} />
      <circle cx={x} cy={y} r="3.4" fill="#facc15" />
    </g>
  );
}


// Conveyor Sort mode card: the factory from the game in flat style. A yellow hazard sign carries the title,
// the robot arm holds a crate (bobbing), the belt rollers turn, and a worker at the console watches the
// three tissue buttons on screen.
function CvCrate({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="36" height="26" rx="2" fill="#d9a066" stroke="#a8723d" strokeWidth="1.5" />
      <rect x="14" width="8" height="6" fill="#ecc792" />
      <rect x="5" y="9" width="26" height="13" rx="1.5" fill="#fff8ec" />
      <rect x="8" y="13" width="20" height="1.8" rx="0.9" fill="#a8723d" />
      <rect x="10" y="17" width="16" height="1.8" rx="0.9" fill="#a8723d" />
    </g>
  );
}

// one picture button on the console screen, showing a render of the 3D model like the game's bins
function CvTissue({ x, y, id }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="22" height="17" rx="2.5" fill="#dce9ec" stroke="#8fb3bb" />
      <image href={picUrl(id)} x="1.5" y="1.5" width="19" height="14" preserveAspectRatio="xMidYMid meet" filter="url(#cv-flat)" />
    </g>
  );
}

// `bare` leaves out the worker so the split Group Sort card can draw its own.
export function ConveyorCoverScene({ nested = false, bare = false }) {
  const hazard = [12, 26, 40, 54, 68, 82, 96, 110, 124];
  return (
    <svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" className={nested ? undefined : 'mg-scene'} aria-hidden="true">
      <defs>
        {/* the model pictures on the screen, flattened to three muted rose tones so they read as flat art */}
        <filter id="cv-flat" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.3 0.55 0.15 0 0  0.3 0.55 0.15 0 0  0.3 0.55 0.15 0 0  0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues="0.55 0.7 0.82" />
            <feFuncG type="discrete" tableValues="0.33 0.48 0.66" />
            <feFuncB type="discrete" tableValues="0.4 0.55 0.7" />
          </feComponentTransfer>
        </filter>
        <clipPath id="cv-sign">
          <rect x="10" y="25" width="120" height="25" rx="3" />
        </clipPath>
      </defs>
      <rect width="320" height="150" fill="#8fd0dc" />
      <rect width="320" height="12" fill="#b9e4ec" />
      <rect y="12" width="320" height="6" fill="#3d5560" />
      {[40, 120, 200, 280].map((x) => (
        <g key={x} transform={`translate(${x} 18)`} fill="#fff" opacity="0.28">
          <rect x="-2.5" width="5" height="34" />
          <path d="M-10 34h20l4 7h-28z" />
          <path d="M-14 41h5l-3 12 4 6-3 2-6-8zM14 41h-5l3 12-4 6 3 2 6-8z" />
        </g>
      ))}
      <rect y="118" width="320" height="32" fill="#6aa8b3" />
      <rect y="104" width="214" height="10" rx="5" fill="#2b3d45" />
      <line x1="6" y1="109" x2="208" y2="109" stroke="#e7f3f5" strokeWidth="4" strokeLinecap="round" strokeDasharray="0 18" className="mg-sc-belt" />
      <rect x="20" y="114" width="5" height="36" fill="#2b3d45" />
      <rect x="180" y="114" width="5" height="36" fill="#2b3d45" />
      <CvCrate x={12} y={78} />
      <CvCrate x={78} y={78} />

      <rect x="154" y="18" width="20" height="8" rx="2" fill="#2b3d45" />
      <g className="mg-sc-bob">
        <rect x="161" y="26" width="6" height="22" fill="#2b3d45" />
        <g stroke="#8fb3bb" strokeWidth="1.2">
          {[30, 34, 38, 42, 46].map((y) => (
            <line key={y} x1="161" y1={y} x2="167" y2={y} />
          ))}
        </g>
        <path d="M150 48h28l3 7h-34z" fill="#2b3d45" />
        <rect x="142" y="54" width="44" height="5" rx="2.5" fill="#3d5560" />
        <path d="M143 58l-2 22 4 1 3-20zM185 58l2 22-4 1-3-20z" fill="#2b3d45" />
        <CvCrate x={146} y={64} />
      </g>

      <line x1="22" y1="18" x2="22" y2="25" stroke="#2b3d45" strokeWidth="2" />
      <line x1="118" y1="18" x2="118" y2="25" stroke="#2b3d45" strokeWidth="2" />
      <rect x="10" y="25" width="120" height="25" rx="3" fill="#facc15" stroke="#1d2a30" strokeWidth="1.8" />
      <g clipPath="url(#cv-sign)">
        <rect x="10" y="44" width="120" height="6" fill="#1d2a30" />
        {hazard.map((x) => (
          <path key={x} d={`M${x} 44l6 6h5l-6-6z`} fill="#facc15" />
        ))}
      </g>
      <text x="70" y="40" textAnchor="middle" fontFamily="Bungee, 'Nunito Sans Variable', sans-serif" fontSize="11.5" fill="#1d2a30">
        CONVEYOR SORT
      </text>

      <rect x="198" y="100" width="122" height="50" rx="5" fill="#3d5560" />
      <rect x="198" y="100" width="122" height="7" rx="3" fill="#2b3d45" />
      <rect x="202" y="40" width="84" height="52" rx="4" fill="#2b3d45" />
      <rect x="207" y="45" width="74" height="42" rx="2" fill="#e9f4f6" />
      <CvTissue x={211} y={49} id="skeletal" />
      <CvTissue x={235} y={49} id="cardiac" />
      <CvTissue x={259} y={49} id="smooth" />
      <rect x="211" y="71" width="66" height="3" rx="1.5" fill="#8fb3bb" />
      <rect x="211" y="76" width="40" height="3" rx="1.5" fill="#8fb3bb" />
      <rect x="259" y="76" width="22" height="7" rx="2" fill="#1d9e75" />
      <rect x="238" y="92" width="10" height="8" fill="#2b3d45" />
      <rect x="222" y="95" width="40" height="5" rx="2" fill="#55707c" />

      {!bare && (
        <g transform="translate(294 150)">
          <CoverWorker />
        </g>
      )}
    </svg>
  );
}

// The Conveyor Sort worker seen from behind, feet at (0, 0): hard hat, orange safety vest, reaching for the keyboard.
function CoverWorker() {
  return (
    <>
      <path d="M-24 0V-30C-24-46-14-52 0-52S24-46 24-30V0Z" fill="#2f4a6b" />
      <path d="M-20 0V-31C-20-43-12-48-4-48H4C12-48 20-43 20-31V0Z" fill="#f59e0b" />
      <rect x="-20" y="-26" width="40" height="4" fill="#fde7a8" />
      <rect x="-20" y="-14" width="40" height="4" fill="#fde7a8" />
      <rect x="-3" y="-48" width="6" height="48" fill="#e08a00" opacity="0.5" />
      <path d="M-20-42C-30-46-38-50-44-52" stroke="#2f4a6b" strokeWidth="10" strokeLinecap="round" fill="none" />
      <circle cx="-48" cy="-53" r="4" fill="#c98a63" />
      <rect x="-6" y="-58" width="12" height="10" rx="3" fill="#c98a63" />
      <ellipse cx="-12" cy="-66" rx="2.6" ry="4" fill="#c98a63" />
      <ellipse cx="12" cy="-66" rx="2.6" ry="4" fill="#c98a63" />
      <circle cy="-67" r="12" fill="#3b2a20" />
      <path d="M-14-70C-14-86 14-86 14-70Z" fill="#facc15" />
      <rect x="-17" y="-71" width="34" height="5" rx="2.5" fill="#eab308" />
      <rect x="-2.5" y="-83" width="5" height="12" rx="2" fill="#eab308" />
    </>
  );
}

// Picture Match cover: a noir detective in a fedora, seen from behind with his pipe, studies an evidence wall of muscle photos tied
// with red string, lit by a beam through the window blinds.
function NoirPhoto({ x, y, w, h, r, id }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect width={w} height={h} fill="#8d7f6b" />
      <rect x="2.5" y="2.5" width={w - 5} height={h - 9} fill="#2b2520" />
      <image href={picUrl(id)} x="2.5" y="2.5" width={w - 5} height={h - 9} preserveAspectRatio="xMidYMid meet" filter="url(#nr-sepia)" opacity="0.85" />
    </g>
  );
}

// `bare` leaves out the detective and the title so the split Group Sort card can draw its own.
export function DetectiveCoverScene({ nested = false, bare = false }) {
  const pins = { a: [41, 25], b: [131, 15], c: [256, 72], d: [24, 61], q: [84, 62], n: [247, 38] };
  const strings = [['a', 'b'], ['a', 'd'], ['b', 'c'], ['d', 'q'], ['q', 'b'], ['c', 'n']];
  return (
    <svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" className={nested ? undefined : 'mg-scene'} aria-hidden="true">
      <defs>
        <linearGradient id="nr-beam" x1="1" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#efe3cc" stopOpacity="0.42" />
          <stop offset="1" stopColor="#efe3cc" stopOpacity="0.04" />
        </linearGradient>
        {/* red rim light that fades out from the left edge */}
        <linearGradient id="nr-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c0262d" />
          <stop offset="0.45" stopColor="#c0262d" />
          <stop offset="0.7" stopColor="#c0262d" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="nr-halo">
          <stop offset="0" stopColor="#3a322b" stopOpacity="0.7" />
          <stop offset="1" stopColor="#3a322b" stopOpacity="0" />
        </radialGradient>
        {/* faded old-print toning for the evidence photos: grey, flattened to a few tones and tinted the wall's
            dim sepia, so they sit back like the rest of the dark scene */}
        <filter id="nr-sepia" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.3 0.55 0.15 0 0  0.3 0.55 0.15 0 0  0.3 0.55 0.15 0 0  0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues="0.17 0.33 0.5 0.62" />
            <feFuncG type="discrete" tableValues="0.15 0.29 0.44 0.56" />
            <feFuncB type="discrete" tableValues="0.13 0.24 0.36 0.46" />
          </feComponentTransfer>
        </filter>
        <radialGradient id="nr-vignette" cx="0.55" cy="0.45" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.7" />
        </radialGradient>
      </defs>
      <rect width="320" height="150" fill="#0f0d0c" />
      <rect width="320" height="150" fill="#1c1815" opacity="0.6" />

      {/* window blinds and the light falling through them */}
      <rect x="266" y="0" width="50" height="64" fill="#050404" />
      {[2, 9, 16, 23, 30, 37, 44, 51].map((y) => (
        <rect key={y} x="269" y={y} width="44" height="4.2" fill="#e9dcc4" />
      ))}
      <g className="mg-sc-flicker">
        <path d="M268 6 L314 4 L196 150 L112 150 Z" fill="url(#nr-beam)" />
        <path d="M282 5 L289 5 L166 150 L156 150 Z M298 4 L304 4 L186 150 L177 150 Z" fill="#0f0d0c" opacity="0.55" />
      </g>

      {/* evidence wall */}
      <NoirPhoto x={22} y={24} w={40} h={32} r={-8} id="myofibril" />
      <NoirPhoto x={112} y={14} w={38} h={30} r={5} id="cardiac" />
      <NoirPhoto x={240} y={72} w={34} h={40} r={4} id="fascicle" />
      <NoirPhoto x={10} y={61} w={30} h={32} r={-6} id="sarcomere" />
      <g transform="translate(71 62) rotate(3)">
        <rect width="26" height="30" fill="#9c8f7c" />
        <text x="13" y="23" textAnchor="middle" fontFamily="'Playfair Display Variable', Georgia, serif" fontWeight="700" fontSize="20" fill="#1a1613">
          ?
        </text>
      </g>
      <g transform="translate(235 38) rotate(-4)">
        <rect width="24" height="26" fill="#9c8f7c" />
        <path d="M4 7h15M4 12h12M4 17h14M4 22h8" stroke="#2b2520" strokeWidth="1" strokeDasharray="3 1.5" />
      </g>
      <g stroke="#c0262d" strokeWidth="0.9">
        {strings.map(([p, q]) => (
          <line key={p + q} x1={pins[p][0]} y1={pins[p][1]} x2={pins[q][0]} y2={pins[q][1]} />
        ))}
      </g>
      {Object.entries(pins).map(([k, [x, y]]) => (
        <circle key={k} cx={x} cy={y} r="1.9" fill="#e03a3a" />
      ))}

      {/* desk, papers and a coffee mug */}
      <rect y="136" width="320" height="14" fill="#0a0908" />
      <path d="M150 140 L196 137 L204 141 L158 144 Z" fill="#cbbda5" opacity="0.55" />
      <rect x="282" y="123" width="15" height="14" rx="1.5" fill="#1d1916" />
      <path d="M297 126 a4 4 0 0 1 0 8" stroke="#1d1916" strokeWidth="2.2" fill="none" />

      {/* view-box: .mg-scene * uses fill-box, which would move this transform off the figure's own corner */}
      {!bare && (
        <g transform="translate(158 152) scale(1.45)" style={{ transformBox: 'view-box' }}>
          <NoirDetective />
        </g>
      )}

      <rect width="320" height="150" fill="url(#nr-vignette)" />

      {/* title */}
      <g transform="translate(14 98) rotate(-4)">
        <rect width="54" height="13" fill="none" stroke="#c0262d" strokeWidth="1.4" />
        <text x="27" y="9.6" textAnchor="middle" fontFamily="'Nunito Sans Variable', sans-serif" fontWeight="900" fontSize="7.5" letterSpacing="1.2" fill="#c0262d">
          CASE FILE
        </text>
      </g>
      {!bare && (
        <text x="14" y="128" fontFamily="'Playfair Display Variable', Georgia, serif" fontWeight="800" fontSize="16" letterSpacing="1.2" fill="#efe3cc">
          PICTURE MATCH
        </text>
      )}
    </svg>
  );
}

// The Picture Match detective from behind, feet at (0, 0), drawn flat and boxy like the Conveyor Sort worker: a squared
// coat with a shoulder cape, a noir fedora, and a bent pipe hanging on the right with smoke curling up. Red rim light on the
// left. The fedora sits 4 units low so its brim crosses the top half of the head.
function NoirDetective() {
  return (
    <>
      <ellipse cy="-52" rx="50" ry="48" fill="url(#nr-halo)" />
      <g fill="#050404">
        <path d="M-28 0 V-32 C-28 -42 -21 -47 -11 -48 H11 C21 -47 28 -42 28 -32 V0 Z" />
        <rect x="-5" y="-56" width="10" height="9" />
        <circle cy="-64" r="10" />
      </g>
      <path d="M-28 -24 V-32 C-28 -42 -21 -47 -11 -48 H11 C21 -47 28 -42 28 -32 V-24 Z" fill="#0e0c0b" />
      <path d="M-8 -48 L-11 -41 L0 -45 L11 -41 L8 -48 Z" fill="#141110" />
      <path d="M-10 0 V-22 M10 0 V-22" stroke="#171310" strokeWidth="0.8" />
      {/* pipe: stem from the mouth, bowl with a glowing ember */}
      <path d="M7 -58 C10 -55 13 -53 16 -53" stroke="#050404" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M15 -52 L14.5 -59 L21 -59 L20.5 -52 C19.5 -49.5 16 -49.5 15 -52 Z" fill="#050404" />
      <path d="M14.5 -59 L21 -59" stroke="#efe3cc" strokeWidth="0.6" opacity="0.6" />
      <ellipse cx="17.8" cy="-59.3" rx="2.4" ry="0.8" fill="#e0612a" opacity="0.85" />
      <g stroke="#efe3cc" strokeWidth="1.1" strokeLinecap="round" fill="none">
        <path className="mg-sc-smoke" d="M18 -61 C14 -67 22 -71 18 -77 C14 -83 21 -87 19 -93" />
        <path className="mg-sc-smoke mg-sc-smoke--late" d="M19 -62 C23 -68 16 -73 20 -79 C24 -85 18 -89 21 -95" />
      </g>
      {/* rim light */}
      <path d="M-28 -27 V-32 C-28 -42 -21 -47 -11 -48" stroke="#c0262d" strokeWidth="0.55" fill="none" />
      <path d="M-9.4 -60.6 A10 10 0 0 1 -9.4 -67.4" stroke="#c0262d" strokeWidth="0.45" fill="none" />
      <path d="M28 -2 V-32 C28 -42 21 -47 11 -48" stroke="#efe3cc" strokeWidth="0.4" fill="none" opacity="0.35" />
      <g transform="translate(0 4)">
        <g fill="#050404">
          <path d="M-19 -72 C-14 -77 14 -78 20 -72 C15 -68.5 -14 -68 -19 -72 Z" />
          <path d="M-10 -74 C-11 -83 -6 -87 1 -87 C8 -87 12 -83 11 -75 Z" />
        </g>
        <path d="M-10.3 -76.5 C-4 -78 5 -78 11.2 -77.5" stroke="#3a1416" strokeWidth="1.6" fill="none" />
        <path d="M-5 -86 C-2 -84 3 -84 6 -86" stroke="#1a1513" strokeWidth="0.5" fill="none" />
        <path d="M-10 -74 C-11 -83 -6 -87 1 -87 C8 -87 12 -83 11 -75" stroke="url(#nr-rim)" strokeWidth="0.5" fill="none" />
        <path d="M-19 -72 C-14 -77 14 -78 20 -72" stroke="url(#nr-rim)" strokeWidth="0.5" fill="none" />
      </g>
    </>
  );
}
