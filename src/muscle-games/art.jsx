// Hand-drawn SVG illustrations used by the games.
import { useId } from 'react';

/* ---------- Balloon Pop: the hooded sage wizard ---------- */

// A long starry cloak that blows back at the hem, open down the front over a purple robe and a leather belt,
// with gold trim. The staff is dark silver carved with glowing runes, with a gold three-prong claw, a blue diamond and
// a purple ribbon.
// In Balloon Pop the castle wall hides the lowest third, so the belt and most stars sit above y 190.
const W = {
  cloak: '#2c56b8', shade: '#1f3f8a', deep: '#122658', inner: '#5a4aa0', innerDark: '#463a82',
  gold: '#e6bd5c', goldDark: '#a8782a', leather: '#8a5a32', leatherDark: '#6b4325', star: '#f7d36a',
  beard: '#f3f5ff', beardLine: '#c9d2f5', skin: '#f0d3b8', shaft: '#3d4150',
};
// Four-point star and crescent outlines, joined into one path each so the pattern costs a single element.
const starPath = (x, y, r) =>
  `M${x} ${y - r}Q${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y}Q${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r}` +
  `Q${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y}Q${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r}Z`;
const moonPath = (x, y, r) =>
  `M${x} ${y - r}A${r} ${r} 0 1 0 ${x + r * 0.9} ${y + r * 0.45}A${r * 0.78} ${r * 0.78} 0 1 1 ${x} ${y - r}Z`;
const curlPath = (x, y) => `M${x} ${y}q4 -6 9 -2q3 3 -1 5q-3 0 -2 -3`;
const CLOAK_STARS = [[80, 214, 3.4], [144, 226, 3], [68, 238, 2.4], [134, 242, 2.4], [86, 176, 2.6], [90, 148, 2.4], [130, 146, 2.2], [96, 162, 2], [130, 186, 2.6]]
  .map(([x, y, r]) => starPath(x, y, r)).join('');
const CLOAK_MOONS = moonPath(136, 196, 5) + moonPath(127, 168, 3.6);
const HEM_CURLS = [[58, 246], [72, 250], [138, 251], [146, 246]].map(([x, y]) => curlPath(x, y)).join('');
const ORB_SPARKS = starPath(147, 38, 2.2) + starPath(176, 66, 1.8);
const ORB_GLINT = starPath(153.6, 46, 2.2);
// Runes carved down the staff: small diamonds with a tick under each, glowing cyan.
const RUNES = [108, 130, 152, 174, 196, 218].map((y) => `M160.5 ${y}l1.8 2.6l-1.8 2.6l-1.8 -2.6ZM160.5 ${y + 7}v2`).join('');
// Outer shapes, drawn twice: first as a wide dark stroke under everything, then filled on top, so only the outer
// half of the stroke shows and the wizard gets one unbroken outline with no lines where the shapes meet.
const CLOAK = 'M88 118Q82 128 80 150Q70 200 50 248Q80 257 108 253Q132 258 150 250Q144 200 136 150Q134 128 128 118Z';
const HOOD = 'M82 136Q78 98 92 78Q104 64 118 66Q134 74 137 102Q139 122 134 136Q108 126 82 136Z';
const HOOD_TIP = 'M112 67Q126 60 134 68Q138 74 145 79Q134 78 128 73Q121 70 116 72Z';
const SLEEVE = 'M127 138Q133 136 138 143Q147 153 156 163L155.5 173.5Q148 173 142 168Q133 158 128 149Q125 143 127 138Z';
const OUTLINE = 4; // dark navy, the hood's inner colour
const SHAFT_STREAKS = [80, 104, 128, 152, 176, 200, 224].map((y) => `M158.6 ${y}L162.4 ${y + 9}`).join('');

// The arm (.mg-wizard__arm, two groups: the sleeve under the hood and the hand over it) turns at the shoulder and
// the staff (.mg-wizard__staff) swings on the hand; fireballs start from .mg-wizard__orb.
// WizardShapes is the drawing on its own (200x260 units), for placing inside another SVG such as a cover.
export function WizardShapes() {
  return (
    <>
      <defs>
        <linearGradient id="mg-orb-white" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aab1cd" />
          <stop offset=".5" stopColor="#e3e6f4" />
          <stop offset=".85" stopColor="#fafaff" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <linearGradient id="mg-orb-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8f1a1f" />
          <stop offset=".5" stopColor="#e0322b" />
          <stop offset=".85" stopColor="#ff8f7e" />
          <stop offset="1" stopColor="#ffd2c9" />
        </linearGradient>
        <linearGradient id="mg-orb-ice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b3a8a" />
          <stop offset=".5" stopColor="#38a8f5" />
          <stop offset=".85" stopColor="#bfe6ff" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <linearGradient id="mg-orb-volt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#78350f" />
          <stop offset=".5" stopColor="#fbbf24" />
          <stop offset=".85" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#fffbeb" />
        </linearGradient>
        <radialGradient id="mg-orb-shade" cx=".42" cy=".38" r=".64">
          <stop offset=".55" stopColor="#2e3358" stopOpacity="0" />
          <stop offset="1" stopColor="#2e3358" stopOpacity=".45" />
        </radialGradient>
      </defs>
      {/* cloak, shaded on the left, with folds on the lit cloth */}
      <path d={CLOAK + HOOD + HOOD_TIP} fill={W.deep} stroke={W.deep} strokeWidth={OUTLINE} strokeLinejoin="round" />
      <path d={CLOAK} fill={W.cloak} />
      <path d="M88 118Q82 128 80 150Q70 200 50 248Q62 253 74 254Q78 200 90 136Z" fill={W.shade} opacity=".75" />
      <path d="M97 152Q91 200 85 246M132 166Q138 210 142 248" stroke={W.shade} strokeWidth="2.6" fill="none" strokeLinecap="round" opacity=".8" />
      <path d={CLOAK_STARS} fill={W.star} />
      <path d={CLOAK_MOONS} fill={W.star} />
      {/* the purple robe in the opening down the front, and the belt, which the cloak covers at the sides */}
      <path d="M108 132Q100 190 94 254Q110 258 128 254Q120 190 112 132Z" fill={W.inner} />
      <path d="M110 150Q107 200 110 252" stroke={W.innerDark} strokeWidth="2.4" fill="none" />
      <clipPath id="mg-wizard-gap">
        <path d="M108 132Q100 190 94 254Q110 258 128 254Q120 190 112 132Z" />
      </clipPath>
      <g clipPath="url(#mg-wizard-gap)">
        <path d="M96 175Q110 179 124 175L124 184Q110 188 96 184Z" fill={W.leather} />
        <path d="M96 179.5Q110 183.5 124 179.5" stroke={W.leatherDark} strokeWidth="1" fill="none" />
        <rect x="105.5" y="174.5" width="9" height="10.5" rx="2" fill="none" stroke={W.gold} strokeWidth="2.2" />
        <path d="M112 185L112.5 191" stroke={W.leatherDark} strokeWidth="1.8" />
        <rect x="107.5" y="190" width="10" height="10" rx="3" fill={W.leather} />
        <circle cx="112.5" cy="195" r="1.5" fill={W.gold} />
      </g>
      {/* gold trim: the front edges, the hem and its curls */}
      <path d="M108 132Q100 190 94 254M112 132Q120 190 128 254M50 248Q80 257 108 253Q132 258 150 250" stroke={W.gold} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={HEM_CURLS} stroke={W.gold} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* the sleeve sits under the hood and turns with the staff arm, so the arm stays joined to the cloak */}
      <g className="mg-wizard__arm">
        <path d={SLEEVE} fill={W.deep} stroke={W.deep} strokeWidth={OUTLINE} strokeLinejoin="round" />
        <path d={SLEEVE} fill={W.shade} />
      </g>
      {/* rounded hood with a soft tip falling back, gold on its rim and lower edge, eyes, flowing beard */}
      <path d={HOOD} fill={W.shade} />
      <path d={HOOD_TIP} fill={W.shade} />
      <path d="M83 135Q108 125 133 135" stroke={W.gold} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M94 127Q93 98 108 90Q123 98 122 127Z" fill={W.deep} />
      <path d="M92.5 129Q91 96 108 87Q125 96 123.5 129" stroke={W.gold} strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="99" y="104" width="6.5" height="3.2" rx="1.5" fill="#fff" />
      <rect x="110.5" y="104" width="6.5" height="3.2" rx="1.5" fill="#fff" />
      <path d="M97 117H119Q122 131 116 142Q120 152 113 160Q114 170 106 174Q109 166 104 162Q98 156 101 148Q95 134 97 117Z" fill={W.beard} />
      <path d="M104 123Q102 136 106 148M112 123Q114 134 110 146" stroke={W.beardLine} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <g className="mg-wizard__arm">
        <g className="mg-wizard__staff">
        <circle className="mg-wizard__glow" cx="161" cy="54" r="25" fill="#c4b5fd" opacity=".2" />
        <path d="M158 66H163L162.6 240L160.5 250L158.4 240Z" fill={W.shaft} />
        <path d="M157 232Q160.5 240 157.5 248L160.5 262L163.5 248Q161 240 164 232Q160.5 236 157 232Z" fill={W.gold} />
        <path className="mg-wizard__runes" d={RUNES} stroke="#67e8f9" strokeWidth="1" fill="none" />
        <path d="M155.5 94.5a5 2.6 0 1 0 10 0a5 2.6 0 1 0 -10 0M155.5 236a5 2.6 0 1 0 10 0a5 2.6 0 1 0 -10 0Z" fill={W.gold} />
        {/* the middle prong of the gold claw stands behind the pearl */}
        <path d="M161 44Q157 30 161 14Q165 30 161 44Z" fill={W.gold} />
        <circle cx="161" cy="54" r="17" fill="#ece9ff" opacity=".18" />
        <circle className="mg-wizard__ring" cx="161" cy="54" r="12" fill="none" stroke="#67e8f9" strokeWidth="2" opacity="0" />
        {/* a glossy pearl: white, darker at the top and lighter at the bottom; red (cast, fire skill), blue (ice skill) and
            gold-to-blue (ATP ultimate) layers fade in over it, then the edge shading, the bounce light and the highlights sit on top */}
        <circle className="mg-wizard__orb" cx="161" cy="54" r="12" fill="url(#mg-orb-white)" />
        <circle className="mg-wizard__orb-red" cx="161" cy="54" r="12" fill="url(#mg-orb-red)" opacity="0" />
        <circle className="mg-wizard__orb-ice" cx="161" cy="54" r="12" fill="url(#mg-orb-ice)" opacity="0" />
        <circle className="mg-wizard__orb-volt" cx="161" cy="54" r="12" fill="url(#mg-orb-volt)" opacity="0" />
        <circle cx="161" cy="54" r="12" fill="url(#mg-orb-shade)" />
        <ellipse cx="161" cy="61.6" rx="7" ry="2.4" fill="#fff" opacity=".5" />
        <ellipse cx="156.6" cy="48.6" rx="4.6" ry="3" transform="rotate(-35 156.6 48.6)" fill="#fff" opacity=".95" />
        <circle cx="166" cy="49" r="1.3" fill="#fff" />
        <circle cx="163.6" cy="57.4" r=".8" fill="#fff" opacity=".9" />
        <path d={ORB_GLINT} fill="#fff" />
        <path d={ORB_SPARKS} fill={W.star} />
        <path d="M157 72Q140 62 144 44Q147 30 160 22Q154 32 157 37Q147 46 151 58Q153 66 160 70Z" fill={W.gold} />
        <path d="M164 72Q178 66 176 52Q175 44 168 40Q175 49 170 60Q168 66 161 70Z" fill={W.goldDark} />
        {/* a blue diamond under the head, and a purple ribbon tied below it */}
        <path d="M160.5 72L164.5 79L160.5 86L156.5 79Z" fill="#63d0ff" stroke={W.gold} strokeWidth="1.6" />
        <circle cx="159.4" cy="77.6" r="1" fill="#fff" />
        <g className="mg-wizard__ribbon">
          <path d="M158 88Q147 93 149 107Q145 120 138 127Q147 114 145 101Q145 92 158 90Z" fill="#7c5cc4" />
          <path d="M158 89Q151 98 156 112Q153 122 150 128Q158 116 158 104Q157 96 160 90Z" fill="#9b7be0" />
        </g>
        </g>
        <rect x="153" y="162.5" width="12.5" height="11.5" rx="3" fill={W.skin} />
        <clipPath id="mg-wizard-wrist">
          <rect x="148" y="140" width="24" height="50" />
        </clipPath>
        <g clipPath="url(#mg-wizard-wrist)">
          <path d={SLEEVE} fill={W.deep} stroke={W.deep} strokeWidth={OUTLINE} strokeLinejoin="round" />
          <path d={SLEEVE} fill={W.shade} />
        </g>
        <path d="M156 163L155.5 173.5" stroke={W.gold} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </>
  );
}

export function WizardArt(props) {
  return (
    <svg viewBox="0 0 200 260" aria-hidden="true" {...props}>
      <WizardShapes />
    </svg>
  );
}

/* ---------- Balloon Pop: castle backdrop (shadow silhouette) ---------- */

// Foliage outline: an ellipse edged with small, slightly uneven scallops (seeded, so it never changes).
function foliage(cx, cy, rx, ry, n, seed) {
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand() * 0.25;
    const k = 0.9 + rand() * 0.18;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % n];
    const r = (Math.hypot(q[0] - p[0], q[1] - p[1]) / 2) * (1.15 + rand() * 0.3);
    d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  });
  return `${d}Z`;
}

// Trees stand behind the buildings; only their crowns peek out.
const TREES = [
  foliage(274, 100, 22, 13, 13, 3),
  foliage(358, 128, 15, 20, 11, 11),
  foliage(386, 176, 13, 16, 11, 23),
  foliage(212, 198, 15, 9, 10, 29),
];
const TREE_LIT = foliage(268, 95, 12, 7, 9, 7);

// Everything stands on one ground line, y = 250, laid in the same courses as the town in front of it.
const BD_ROCK = 'M174 250 H400 V290 H180 L178 270 Z M0 250 H70 L73 270 L71 290 H0 Z';
const BD_GAP = 'M66 250 H180 V290 H66 Z'; // closes the ground between the two ledges
const BD_MASONRY = [
  'M290 104 H298 V140 H290 Z', // chimney (the roof covers its foot)
  'M188 212 H232 V250 H188 Z M188 204 H196 V212 H188 Z M200 204 H208 V212 H200 Z M212 204 H220 V212 H212 Z M224 204 H232 V212 H224 Z', // gatehouse
  'M232 226 H362 V250 H232 Z M234 220 H240 V226 H234 Z M306 220 H312 V226 H306 Z M352 220 H358 V226 H352 Z', // curtain wall
  'M244 190 H304 V250 H244 Z', // hall, stone ground floor
  'M316 74 H350 V250 H316 Z', // tall tower
  'M362 196 H386 V250 H362 Z', // small tower
].join(' ');
const BD_ROOFS = 'M234 150 L274 110 L314 150 Z M306 74 L333 18 L360 74 Z M356 196 L374 162 L392 196 Z';
// Windows sit symmetric about each building's centre line.
const BD_WINDOWS = [
  'M252 214 V206 Q255 202 258 206 V214 Z M290 214 V206 Q293 202 296 206 V214 Z', // hall ground floor
  'M255 156 h6 v9 h-6 Z M270 156 h8 v9 h-8 Z M287 156 h6 v9 h-6 Z M255 175 h6 v9 h-6 Z M270 175 h8 v9 h-8 Z M287 175 h6 v9 h-6 Z', // hall upper floor
  'M274 130 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', // gable roundel
  'M330 90 V83 Q333 79 336 83 V90 Z M330 128 V120 Q333 116 336 120 V128 Z M330 160 V152 Q333 148 336 152 V160 Z M330 192 V184 Q333 180 336 184 V192 Z', // tall tower
  'M371 216 V209 Q374 205 377 209 V216 Z', // small tower
  'M207 220 V214 Q210 211 213 214 V220 Z', // gatehouse
].join(' ');
const BD_DOORS = [
  'M202 250 V234 Q210 224 218 234 V250 Z M267 250 V232 Q274 224 281 232 V250 Z',
  'M195 219 h3 v10 h-3 Z M222 219 h3 v10 h-3 Z M331.5 214 h3 v10 h-3 Z M372.5 232 h3 v9 h-3 Z',
].join(' ');
const BD_MOSS = [
  'M236 150 Q240 145 246 148 Q250 144 256 149 L258 150 Z M290 150 Q296 144 302 148 Q307 145 312 150 Z',
  'M308 74 Q312 68 318 72 Q322 67 328 73 L330 74 Z M342 74 Q348 68 354 72 L358 74 Z',
  'M358 196 Q362 190 368 194 L370 196 Z',
  'M188 204 Q192 200 196 204 Z M224 204 Q228 200 232 204 Z',
  'M244 250 V245 Q250 241 256 246 Q262 242 268 247 V250 Z M316 250 V244 Q322 239 330 245 L332 250 Z M362 250 V246 Q368 242 374 247 V250 Z',
].join(' ');
const MORTAR = 'rgba(255, 255, 255, 0.09)';

// The town that runs out to both edges behind the castle: one 320×110 tile repeated sideways.
// Its ground line (y = 70) and scale match the castle's (y = 250 of 290), so the two sit on one ground.
const TOWN_COLORS = {
  near: { body: '#372d4d', roof: '#2e2640', rock: '#2b243f', window: '#18112a', tree: '#1d1a2e', moss: 'rgba(55, 73, 64, 0.75)' },
  far: { body: '#664f7c', roof: '#5f4a74', rock: '#5c4870', window: '#4d3a5f', tree: '#4f4166', moss: 'rgba(92, 103, 122, 0.6)' },
};
// Each tree stands in a gap between buildings. The one in the gap across the tile seam is drawn at both
// edges (x = 322 and x = 2, one tile apart), so its two halves meet as one whole tree when the tile repeats.
const SEAM_TREE = (cx) => foliage(cx, 20, 14, 13, 11, 31);
const TOWN_TREES = [foliage(84, 22, 16, 12, 11, 5), foliage(214, 12, 14, 12, 10, 9), foliage(137, 18, 12, 12, 9, 19), SEAM_TREE(322), SEAM_TREE(2)];

// Moss on every building: along each roof's eaves, a patch on each roof, the ruined tower's broken top,
// a few merlons and the foot of the town wall, always sitting on a surface rather than hanging down.
const TOWN_MOSS = [
  'M14 18q4-5 9-1q4-4 9 1z M44 18q4-5 9-1q4-3 9 1z M30 9q4-4 8 0q-3 4-7 3z',
  'M98 24q3-4 7-1q3-3 7 1z M116 24q3-4 7 0z M108 13q3-3 6 0q-2 3-5 2z',
  'M146 14q4-5 9-1q4-4 9 1z M184 14q4-5 9-1q5-3 11 1z M166 6q4-3 8 0q-3 3-7 2z',
  'M230 9q3-4 6-1q3-3 6 1v2h-12z M244 8q3-3 6 0q2-2 2 1v2h-8z',
  'M264 22q4-5 9-1q4-4 9 1z M292 22q4-5 9-1q4-3 8 1z M282 12q4-4 8 0q-3 3-7 2z',
  'M20 38q4-3 8 0z M68 38q4-3 8 0z M164 38q4-3 8 0z M260 38q4-3 8 0z',
  'M30 70v-4q6-4 12 0q6-3 10 1v3z M120 70v-3q6-4 12 0v3z M210 70v-4q5-4 11 0q5-3 9 1v3z M290 70v-3q5-3 10 0v3z',
].join(' ');

function townTile({ body, roof, rock, window, tree, moss }) {
  const merlons = Array.from({ length: 20 }, (_, i) => `M${4 + i * 16} 38h8v6h-8z`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="110" viewBox="0 0 320 110">
<defs><pattern id="b" width="16" height="7" patternUnits="userSpaceOnUse"><path d="M0 .5H16M0 4H16M.5 .5V4M8.5 4V7" stroke="${MORTAR}" fill="none"/></pattern>
<pattern id="r" width="32" height="14" patternUnits="userSpaceOnUse"><path d="M0 .5H32M0 7.5H32M.5 .5V7.5M16.5 7.5V14" stroke="${MORTAR}" fill="none"/></pattern></defs>
<g fill="${tree}"><path d="M82 70V24M212 70V14M137 70V20M322 70V22M2 70V22" stroke="${tree}" stroke-width="4"/>${TOWN_TREES.map((d) => `<path d="${d}"/>`).join('')}</g>
<path fill="${body}" d="M18 18h40v52H18zM100 24h24v46h-24zM150 14h52v56h-52zM230 8l4 -4l4 5l5 -6l4 4l5 -3v66h-22zM268 22h38v48h-38z"/>
<path fill="url(#b)" d="M18 18h40v52H18zM100 24h24v46h-24zM150 14h52v56h-52zM230 8l4 -4l4 5l5 -6l4 4l5 -3v66h-22zM268 22h38v48h-38z"/>
<path fill="${roof}" d="M12 18L38 0L64 18zM96 24L112 -2L128 24zM144 14L160 2H192L208 14zM262 22L287 4L312 22z"/>
<path fill="${window}" d="M24 26h6v8h-6zM46 26h6v8h-6zM109 32v-5q3-3 6 0v5zM158 20h7v8h-7zM187 20h7v8h-7zM172 20h8v8h-8zM239 16h3v9h-3zM239 32h3v9h-3zM276 30h6v8h-6zM292 30h6v8h-6z"/>
<path fill="${body}" d="M0 44h320v26H0z${merlons}"/><path fill="url(#b)" d="M0 44h320v26H0z"/>
<path fill="${rock}" d="M0 70h320v40H0z"/><path fill="url(#r)" d="M0 70h320v40H0z"/>
<path fill="${moss}" d="${TOWN_MOSS}"/>
</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const TOWN_TILES = { near: townTile(TOWN_COLORS.near), far: townTile(TOWN_COLORS.far) };

export function TownArt({ layer }) {
  return <div className={`mg-town mg-town--${layer}`} style={{ backgroundImage: TOWN_TILES[layer] }} aria-hidden="true" />;
}

export function CastleArt({ layer }) {
  const id = (name) => `mg-bd-${layer}-${name}`;
  return (
    <svg className={`mg-backdrop mg-backdrop--${layer}`} viewBox="0 0 400 290" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        {/* bricks share the town's size and phase (its tile starts at y = 180, x offset 8), so walls that meet line up */}
        <pattern id={id('bricks')} x="8" y="180" width="16" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 .5 H16 M0 4 H16 M.5 .5 V4 M8.5 4 V7" stroke={MORTAR} fill="none" />
        </pattern>
        <pattern id={id('blocks')} x="8" y="250" width="32" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 .5 H32 M0 7.5 H32 M.5 .5 V7.5 M16.5 7.5 V14" stroke={MORTAR} fill="none" />
        </pattern>
        <pattern id={id('shingles')} width="7" height="5" patternUnits="userSpaceOnUse">
          <path d="M0 4.5 Q1.75 1.5 3.5 4.5 Q5.25 1.5 7 4.5" stroke={MORTAR} fill="none" />
        </pattern>
      </defs>
      <path className="mg-bd-trunk" d="M274 250 V104 M356 250 V128 M386 250 V176 M212 250 V196" />
      {TREES.map((d) => (
        <path key={d} className="mg-bd-tree" d={d} />
      ))}
      <path className="mg-bd-tree-lit" d={TREE_LIT} />
      {/* ground laid as castle blocks, same colour and courses as the town's, so the two run on as one */}
      <path className="mg-bd-rock" d={BD_ROCK} />
      <path d={BD_ROCK} fill={`url(#${id('blocks')})`} />
      <path className="mg-bd-rock" d={BD_GAP} />
      <path d={BD_GAP} fill={`url(#${id('blocks')})`} />
      <path className="mg-bd-body" d={BD_MASONRY} />
      <path d={BD_MASONRY} fill={`url(#${id('bricks')})`} />
      {/* hall: jettied timber upper floor on brackets */}
      <path className="mg-bd-body" d="M240 150 H308 V190 H240 Z M240 190 H244 V196 Z M308 190 H304 V196 Z" />
      <path className="mg-bd-timber" d="M240 151 H308 M240 170 H308 M240 189 H308 M252 151 V189 M264 151 V189 M284 151 V189 M296 151 V189 M240 151 L252 189 M252 151 L240 189 M296 151 L308 189 M308 151 L296 189" />
      {/* tall tower: gallery on corbels */}
      <path className="mg-bd-body" d="M310 96 H356 V104 H310 Z M312 104 H318 L315 111 Z M324 104 H330 L327 111 Z M336 104 H342 L339 111 Z M348 104 H354 L351 111 Z" />
      <path className="mg-bd-line" d="M310 96 H356 M316 96 V104 M324 96 V104 M333 96 V104 M342 96 V104 M350 96 V104 M333 18 V6 M374 162 V154" />
      <path className="mg-bd-roof" d={`${BD_ROOFS} M333 6 L345 9 L333 12 Z`} />
      <path d={BD_ROOFS} fill={`url(#${id('shingles')})`} />
      <path className="mg-bd-dark" d={BD_DOORS} />
      <path className="mg-bd-window" d={BD_WINDOWS} />
      <path className="mg-bd-moss" d={BD_MOSS} />
    </svg>
  );
}

/* ---------- Balloon Pop: drifting clouds (moonlit pastel) ---------- */

// A small, chubby cloud outline: a low rounded dome edged with round puffs, big ones mixed with small ones,
// tapering to slight points at both ends. profile(t) is the dome height (0..1) from the left tip to the right.
function cloudOutline(w, h, profile, seed) {
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const tipY = h * 0.8;
  const steps = [];
  for (let t = 0, i = 0; t < 1; i++) {
    const big = i % 3 === 1 && t > 0.08 && t < 0.86; // small, big, small, small, big, ...
    const step = big ? 0.22 + rand() * 0.08 : 0.08 + rand() * 0.04;
    steps.push(Math.min(step, 1 - t));
    t += step;
  }
  let t = 0;
  const top = [[0, tipY]].concat(
    steps.map((st) => {
      t += st;
      const f = t >= 0.999 ? 0 : profile(t) * (0.9 + rand() * 0.15);
      return [t * w, tipY - f * (tipY - 2)];
    })
  );
  const arc = (p, q, k) => {
    const r = (Math.hypot(q[0] - p[0], q[1] - p[1]) / 2) * k;
    return ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  };
  let d = `M0 ${tipY.toFixed(1)}`;
  for (let i = 1; i < top.length; i++) d += arc(top[i - 1], top[i], 1.02 + rand() * 0.08); // near-semicircles: round puffs
  d += ` Q${(w * 0.97).toFixed(1)} ${(h * 0.97).toFixed(1)} ${(w * 0.88).toFixed(1)} ${h}`;
  let prev = [w * 0.88, h];
  for (let i = 1; i <= 3; i++) {
    const q = [w * 0.88 - (w * 0.76 * i) / 3, h - rand() * 1.5];
    d += arc(prev, q, 1.6 + rand() * 0.6);
    prev = q;
  }
  return `${d} Q${(w * 0.03).toFixed(1)} ${(h * 0.95).toFixed(1)} 0 ${tipY.toFixed(1)}Z`;
}

const sinp = (t, e) => Math.pow(Math.sin(Math.PI * t), e);
const CLOUD_SHAPES = {
  round: { w: 120, h: 50, profile: (t) => sinp(t, 0.7) },
  small: { w: 90, h: 40, profile: (t) => sinp(t, 0.7) },
  double: { w: 130, h: 52, profile: (t) => Math.max(sinp(t, 0.9) * 0.75, Math.exp(-(((t - 0.6) / 0.2) ** 2))) },
  lean: { w: 116, h: 48, profile: (t) => sinp(t, 0.8) * (0.8 + 0.2 * t) },
};
// Each cloud: a shadow body, a smaller main-colour layer above it, and moonlight on that layer's top-right rim.
const CLOUDS = Object.entries(CLOUD_SHAPES).map(([name, c], i) => {
  const pad = c.w * 0.18; // headroom so the big round puffs are never cut flat
  return {
    name,
    ...c,
    pad,
    body: cloudOutline(c.w, c.h, c.profile, 20 + i * 13),
    top: cloudOutline(c.w * 0.84, c.h * 0.84, c.profile, 23 + i * 17),
    topAt: `translate(${(c.w * 0.1).toFixed(1)} 0)`,
    rim: `translate(${(c.w * 0.1 - c.h * 0.084).toFixed(1)} ${(c.h * 0.12).toFixed(1)})`,
  };
});
// Heights alternate high/low; everyone moves at one speed, an even quarter of the crossing apart, so they never bunch up.
const CLOUD_FLIGHT = [
  { y: '0%', w: 110 },
  { y: '55%', w: 76 },
  { y: '10%', w: 118 },
  { y: '62%', w: 100 },
];
const CLOUD_CROSSING = 60;

export function SkyClouds() {
  return (
    <div className="mg-clouds" aria-hidden="true">
      {CLOUDS.map((c, i) => {
        const box = { x: 0, y: -c.pad, width: c.w, height: c.h + c.pad };
        return (
          <svg
            key={c.name}
            className="mg-cloud"
            viewBox={`0 ${-c.pad} ${c.w} ${c.h + c.pad}`}
            style={{
              top: CLOUD_FLIGHT[i].y,
              width: CLOUD_FLIGHT[i].w,
              animationDuration: `${CLOUD_CROSSING}s`,
              animationDelay: `${-(CLOUD_CROSSING * i) / CLOUDS.length}s`,
            }}
          >
            <defs>
              <mask id={`mg-cloud-lit-${c.name}`}>
                <rect {...box} fill="#000" />
                <path d={c.top} transform={c.topAt} fill="#fff" />
                <path d={c.top} transform={c.rim} fill="#000" />
              </mask>
            </defs>
            <path className="mg-cloud__shadow" d={c.body} />
            <path className="mg-cloud__body" d={c.top} transform={c.topAt} />
            <rect className="mg-cloud__lit" {...box} mask={`url(#mg-cloud-lit-${c.name})`} />
            <path className="mg-cloud__line" d={c.top} transform={c.topAt} />
          </svg>
        );
      })}
    </div>
  );
}

/* ---------- Balloon Pop: the goblins' raider balloon ---------- */

// A night raider's balloon in browns and dull cream, so it hides in the dark: the stripes swap colours at the iron
// band (brown with cream stripes above, cream with brown stripes below), the canvas is patched, the flag is black
// and ragged, the brass is dull, and a small lamp glows under the wooden gondola. Every balloon looks the same; the
// answer banner tells them apart. The zap effect in BalloonPop.jsx rings the envelope, centred at (60, 64).
// Nothing inside it moves: animating the flag, ribbons or lamp made four balloons repaint every frame on phones.
const AIR_ENVELOPE = 'M60 6 C98 6 114 34 112 62 C110 90 86 108 74 118 L46 118 C34 108 10 90 8 62 C6 34 22 6 60 6 Z';
const AIR_GORES = 'M60 6C74 8 79 62 70 118L50 118C41 62 46 8 60 6ZM24 16C9 36 11 82 34 110L27 112C2 82 2 36 24 16ZM96 16C111 36 109 82 86 110L93 112C118 82 118 36 96 16Z';
const AIR_BELOW = 'M0 60L8 62Q60 80 112 62L120 60V172H0Z'; // under the iron band
const AIR_RIVETS = [20, 34, 48, 60, 72, 86, 100].map((x) => [x, 62 + 16 * (1 - ((x - 60) / 52) ** 2)]);
const RAIDER = {
  brown: '#5e4330', dark: '#3a2a1e', cream: '#cbb795', iron: '#241d1a', brass: '#8f7044', brassDark: '#5a4428',
  ribbon: '#7a5f48', patch: '#8a6a4c', stitch: '#e2d3b3', wood: '#4a3628', woodDark: '#33251b',
};
const GOBLIN = '#6f9a5c';
const GOBLIN_DARK = '#4a7a40';
const patch = (x, y, w, h, a) => (
  <g transform={`rotate(${a} ${x + w / 2} ${y + h / 2})`}>
    <rect x={x} y={y} width={w} height={h} rx="1" fill={RAIDER.patch} />
    <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} fill="none" stroke={RAIDER.stitch} strokeWidth=".8" strokeDasharray="1.6 1.2" />
  </g>
);

// Ropes down to the gondola are drawn before the goblin, so nothing crosses him.
// AirshipShapes is the drawing on its own (120x172 units), for placing inside another SVG such as a cover; Balloon
// Pop shows it as a picture, airship.svg (regenerate it with scripts/airship-svg.mjs after changing the drawing).
export function AirshipShapes() {
  const id = useId().replace(/:/g, '');
  const R = RAIDER;
  return (
    <>
      <defs>
        <clipPath id={`${id}-env`}>
          <path d={AIR_ENVELOPE} />
        </clipPath>
        <clipPath id={`${id}-below`}>
          <path d={AIR_BELOW} />
        </clipPath>
      </defs>
      {/* black ragged flag on top, ribbons hanging from the band */}
      <path d="M60 6V-10" stroke={R.iron} strokeWidth="1.8" />
      <path d="M60 -9L78 -7L73 -5L77 -2L60 -1Z" fill={R.iron} />
      <path d="M10 64Q4 92 11 114Q14 94 17 66Z" fill={R.ribbon} />
      <path d="M110 64Q116 92 109 114Q106 94 103 66Z" fill={R.ribbon} />
      {/* envelope: brown with cream stripes above the band, cream with brown stripes below */}
      <g clipPath={`url(#${id}-env)`}>
        <rect x="0" y="0" width="120" height="120" fill={R.brown} />
        <path d={AIR_GORES} fill={R.cream} />
        <g clipPath={`url(#${id}-below)`}>
          <rect x="0" y="0" width="120" height="120" fill={R.cream} />
          <path d={AIR_GORES} fill={R.brown} />
        </g>
        {patch(30, 26, 12, 10, -12)}
        {patch(76, 84, 10, 9, 10)}
        <path d="M60 6C98 6 114 34 112 62C110 90 86 108 74 118L120 118L120 0Z" fill={R.dark} opacity=".4" />
      </g>
      <path d={AIR_ENVELOPE} fill="none" stroke={R.dark} strokeWidth="1.6" />
      <path d="M8 62Q60 80 112 62" stroke={R.iron} strokeWidth="4" fill="none" />
      {AIR_RIVETS.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="1.3" fill={R.brass} />
      ))}
      <ellipse cx="60" cy="7" rx="8" ry="3" fill={R.brass} stroke={R.brassDark} />
      <rect x="43" y="115" width="34" height="7" rx="2" fill={R.brass} stroke={R.brassDark} />
      <path d="M45 122L34 136M75 122L86 136M52 122L50 136M68 122L70 136" stroke={R.iron} strokeWidth="1.6" />
      {/* goblin in a dark bandana: yellow eyes, fanged grin */}
      <g transform="translate(60 128) scale(1.18) translate(-60 -128)">
        <path d="M44 124 L28 114 L45 132 Z M76 124 L92 114 L75 132 Z" fill={GOBLIN} />
        <path d="M42 123 L33 118 L43 128 Z M78 123 L87 118 L77 128 Z" fill={GOBLIN_DARK} opacity=".6" />
        <ellipse cx="60" cy="129" rx="17" ry="15" fill={GOBLIN} />
        <ellipse cx="60" cy="133" rx="4" ry="2.4" fill={GOBLIN_DARK} opacity=".5" />
        <path d="M50 124 l9 3 M70 124 l-9 3" stroke="#2b3d24" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="54" cy="129" rx="3.4" ry="2.6" fill="#f6d743" />
        <ellipse cx="66" cy="129" rx="3.4" ry="2.6" fill="#f6d743" />
        <circle cx="54.6" cy="129.2" r="1.3" fill="#1d2a17" />
        <circle cx="65.4" cy="129.2" r="1.3" fill="#1d2a17" />
        <path d="M51 135 Q60 141 69 135" fill="#3a2418" />
        <path d="M54 135.8 l1.6 3 l1.6 -2.6 Z M66 135.8 l-1.6 3 l-1.6 -2.6 Z" fill="#fff" />
        <path d="M42 122 A18 15 0 0 1 78 122 Z" fill="#4a3a30" />
        <path d="M42 118 H78" stroke="#2c211b" strokeWidth="5" />
        <path d="M78 118 l7 4 l-3 3 Z" fill="#2c211b" />
      </g>
      {/* wooden gondola with a dull brass rim, dim portholes, a lamp and a spike underneath */}
      <path d="M32 138H88L83 162Q60 169 37 162Z" fill={R.wood} />
      <path d="M34 148H86M36 156H84" stroke={R.woodDark} strokeWidth="1" />
      <rect x="29" y="134" width="62" height="6" rx="2" fill={R.brass} stroke={R.brassDark} />
      <circle cx="40" cy="138" r="3.6" fill={GOBLIN} />
      <circle cx="80" cy="138" r="3.6" fill={GOBLIN} />
      {[44, 60, 76].map((x) => (
        <circle key={x} cx={x} cy="152" r="3" fill="#b8862e" stroke={R.brass} strokeWidth="1.4" />
      ))}
      <path d="M88 160v4" stroke={R.iron} strokeWidth="1" />
      <circle cx="88" cy="168" r="5" fill="#ffb347" opacity=".25" />
      <rect x="85.4" y="164.6" width="5.2" height="6.4" rx="1" fill={R.iron} />
      <rect x="86.4" y="166.2" width="3.2" height="3.4" fill="#ffcf6b" />
      <path d="M54 164L60 176L66 164Z" fill={R.iron} />
    </>
  );
}
