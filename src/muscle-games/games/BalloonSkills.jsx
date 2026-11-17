import { rng } from './util.js';

// Balloon Pop's skills, cast by the wizard: the ice sky rune, the fire portal and the gold lightning ultimate.
// Everything is drawn as SVG and moved with CSS (transforms and opacity only, so phones keep up); see the
// "Balloon Pop: rune skills" section of styles.css for the timings.

// When each skill lands, in seconds after the hit (ice, bomb) or the tap (ATP).
export const ICE_FREEZE = 0.67; // the rune reaches the sky and the balloons slow down
export const BOMB_FUSE = 0.73; // the fire pillar hits the balloon
export const ULT_STRIKE = 1.15; // the two bolts come down
export const ULT_POP = 0.4; // after the strike, the struck balloons burst
export const ULT_LENGTH = 2.6;

// ---------- rune circles ----------
// Each rune is drawn round (0, 0) at radius 50 in a 112 x 112 box, three times over: a wide faint glow, the coloured
// lines, and a thin bright core. Glyphs are made-up letters: two or three short strokes on a 3 x 3 grid.

const pt = (r, a) => `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
// a regular polygon (step 1) or star (step > 1) with n corners on radius r, the first one at the top
const poly = (n, r, rot = 0, step = 1) =>
  Array.from({ length: n }, (_, i) => pt(r, rot + (i * step * Math.PI * 2) / n - Math.PI / 2)).join(' ');

// a ring of n glyphs standing on radius r, as one path
function glyphRing(n, r, seed, scale = 1) {
  const g = rng(seed);
  const step = (v) => Math.max(0, Math.min(2, v + (g() < 0.5 ? -1 : 1)));
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const at = (x, y) => {
      const px = (x * 1.6 - 1.6) * scale;
      const py = (y * 1.8 - 1.8) * scale - r;
      return `${(px * c - py * s).toFixed(2)} ${(px * s + py * c).toFixed(2)}`;
    };
    const strokes = 2 + Math.floor(g() * 2);
    for (let k = 0; k < strokes; k++) {
      let x = Math.floor(g() * 3);
      let y = Math.floor(g() * 3);
      d += `M${at(x, y)}`;
      for (let m = 0; m < 2; m++) {
        if (g() < 0.5) x = step(x);
        else y = step(y);
        d += `L${at(x, y)}`;
      }
    }
  }
  return d;
}

const SIXTHS = [0, 60, 120, 180, 240, 300];
const ICE_GLYPHS = glyphRing(30, 42.5, 11);
const FIRE_GLYPHS = glyphRing(24, 42.5, 23);
const VOLT_GLYPHS = glyphRing(34, 43, 71);
const VOLT_INNER_GLYPHS = glyphRing(14, 9.5, 5, 0.55);

// The ultimate's five small circles, round the seven-point star; each holds a lightning bolt.
export const VOLT_SATELLITES = [0, 1, 2, 3, 4].map((i) => {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
  return [Math.cos(a) * 41, Math.sin(a) * 41];
});
const SATELLITE_BOLT = '1.4,-4.4 -2.2,0.5 -0.1,0.5 -1.3,4.4 2.3,-0.9 0.2,-0.9';

// Ice: six crystal arms with diamond tips and side barbs, inside a ring of glyphs.
function drawIce(w) {
  return (
    <>
      <circle r="50" strokeWidth={1.6 * w} />
      <circle r="46.5" strokeWidth={0.7 * w} />
      <path d={ICE_GLYPHS} strokeWidth={0.7 * w} strokeLinecap="round" strokeLinejoin="round" />
      <circle r="38" strokeWidth={1.2 * w} />
      {SIXTHS.map((a) => (
        <g key={a} transform={`rotate(${a})`} strokeWidth={1.3 * w} strokeLinejoin="round">
          <path d="M0 -10V-36M0 -20L6 -26M0 -20L-6 -26M0 -14L4 -18M0 -14L-4 -18" />
          <path d="M0 -37L3.2 -30L0 -23L-3.2 -30Z" />
          <path d="M0 -38L2 -44L0 -49L-2 -44Z" strokeWidth={0.8 * w} />
        </g>
      ))}
      <circle r="7" strokeWidth={1.2 * w} />
      <polygon points={poly(6, 10, Math.PI / 6)} strokeWidth={0.8 * w} />
    </>
  );
}

// Fire: two squares set at 45 degrees round an eight-point star, inside a ring of glyphs.
function drawFire(w) {
  return (
    <>
      <circle r="50" strokeWidth={2 * w} />
      <circle r="46.5" strokeWidth={0.8 * w} />
      <path d={FIRE_GLYPHS} strokeWidth={0.8 * w} strokeLinecap="round" strokeLinejoin="round" />
      <circle r="38" strokeWidth={1.4 * w} />
      <circle r="35.5" strokeWidth={0.6 * w} />
      <polygon points={poly(4, 33)} strokeWidth={1.2 * w} />
      <polygon points={poly(4, 33, Math.PI / 4)} strokeWidth={1.2 * w} />
      <polygon points={poly(8, 19, Math.PI / 8)} strokeWidth={0.9 * w} />
      <polygon points={poly(8, 18, 0, 3)} strokeWidth={0.8 * w} />
      <polygon points={poly(4, 8, Math.PI / 4)} strokeWidth={0.8 * w} />
    </>
  );
}

// Lightning (the ultimate): a seven-point star with a small glyph ring at its heart, and five small circles round
// it holding lightning bolts. `blue` colours the circles (only on the coloured layer).
function drawVolt(w, blue) {
  return (
    <>
      <circle r="50" strokeWidth={1.8 * w} />
      <circle r="47" strokeWidth={0.7 * w} />
      <path d={VOLT_GLYPHS} strokeWidth={0.7 * w} strokeLinecap="round" strokeLinejoin="round" />
      <circle r="38.5" strokeWidth={1.1 * w} />
      <polygon points={poly(7, 38, 0, 3)} strokeWidth={1.1 * w} />
      <polygon points={poly(7, 38, 0, 2)} strokeWidth={0.8 * w} />
      <circle r="17" strokeWidth={w} />
      <polygon points={poly(12, 16, 0, 5)} strokeWidth={0.5 * w} />
      <circle r="12" strokeWidth={0.8 * w} />
      <path d={VOLT_INNER_GLYPHS} strokeWidth={0.5 * w} />
      <polygon points={poly(7, 5, 0, 3)} strokeWidth={0.7 * w} />
      <g stroke={blue}>
        {VOLT_SATELLITES.map(([x, y], i) => (
          <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            <circle r="7.5" strokeWidth={1.1 * w} />
            <circle r="5.8" strokeWidth={0.5 * w} strokeDasharray="1 0.8" />
            <polygon points={SATELLITE_BOLT} strokeWidth={0.6 * w} strokeLinejoin="round" fill={blue ?? 'none'} />
          </g>
        ))}
      </g>
    </>
  );
}

const RUNES = {
  ice: { draw: drawIce, glow: '#38bdf8', main: '#7dd3fc', core: '#f0f9ff' },
  fire: { draw: drawFire, glow: '#f97316', main: '#fb923c', core: '#fde68a' },
  volt: { draw: drawVolt, glow: '#f59e0b', main: '#fbbf24', core: '#fffbeb', blue: '#60a5fa' },
};

// the rune's lines, for placing inside another SVG (such as a flyer orb)
export function RuneLines({ kind }) {
  const { draw, glow, main, core, blue } = RUNES[kind];
  return (
    <>
      <g fill="none" stroke={glow} opacity="0.4">
        {draw(3.2)}
      </g>
      <g fill="none" stroke={main}>
        {draw(1.4, blue)}
      </g>
      <g fill="none" stroke={core}>
        {draw(0.55)}
      </g>
    </>
  );
}

function Rune({ kind, children }) {
  return (
    <svg className="mg-rune" viewBox="-56 -56 112 112" aria-hidden="true">
      <RuneLines kind={kind} />
      {children}
    </svg>
  );
}

// ---------- lightning ----------
// A bolt drawn from left to right across its box (CSS stretches and turns the box from one point to another),
// in three poses that flip every 40 ms so it seems to crackle. Strokes keep their width however far it stretches.
const BOLT_POSES = [0, 1, 2].map((p) => {
  const r = rng(500 + p);
  const pts = Array.from({ length: 11 }, (_, k) => [k * 10, k === 0 || k === 10 ? 0 : (r() * 2 - 1) * 7]);
  const line = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const forks = [3, 6].map((k) => {
    const [x, y] = pts[k];
    const s = r() < 0.5 ? -1 : 1;
    return line([[x, y], [x + 5, y + s * 5], [x + 9, y + s * 4], [x + 13, y + s * 9]]);
  });
  return { main: line(pts), forks };
});

function Bolt({ x, y, toX, toY, color, width, className }) {
  const len = Math.hypot(toX - x, toY - y);
  const angle = Math.atan2(toY - y, toX - x);
  return (
    <div className={`mg-bolt ${className}`} style={{ left: x, top: y, width: len, transform: `rotate(${angle}rad)` }}>
      <svg className="mg-bolt__art" viewBox="0 -20 100 40" preserveAspectRatio="none" aria-hidden="true">
        {BOLT_POSES.map(({ main, forks }, k) => (
          <g key={k} className="mg-bolt__pose" style={{ animationDelay: `${k * 0.04}s` }} fill="none" strokeLinejoin="round" strokeLinecap="round">
            <polyline points={main} stroke={color} strokeOpacity="0.35" strokeWidth={width * 3.2} vectorEffect="non-scaling-stroke" />
            <polyline points={main} stroke={color} strokeWidth={width} vectorEffect="non-scaling-stroke" />
            {forks.map((f, j) => (
              <polyline key={j} points={f} stroke={color} strokeWidth={width * 0.45} vectorEffect="non-scaling-stroke" />
            ))}
            <polyline points={main} stroke="#fff" strokeWidth={width * 0.4} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ---------- round the wizard ----------
// For the ultimate, three flat lightning runes rise round him one after another, from the wall at his feet.
export function RisingRunes({ x }) {
  return (
    <div className="mg-rising" style={{ left: x }} aria-hidden="true">
      {[0, 1, 2].map((k) => (
        <div key={k} className="mg-rising__ring" style={{ '--k': k }}>
          <div className={`mg-spin${k % 2 ? ' mg-spin--back' : ''}`}>
            <Rune kind="volt" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- ice: the sky rune ----------
// A small ice rune leaves the staff, flies to the middle of the sky behind the balloons and opens out across it,
// then fades. Positions are in pixels in the sky; d is the open rune's width.
export function IceSigil({ from, to, d }) {
  const style = {
    width: d,
    height: d,
    margin: -d / 2,
    '--x0': `${from[0]}px`,
    '--y0': `${from[1]}px`,
    '--s0': 16 / d,
    '--x1': `${to[0]}px`,
    '--y1': `${to[1]}px`,
    '--s1': 76 / d,
  };
  return (
    <div className="mg-sigil" style={style} aria-hidden="true">
      <div className="mg-spin mg-spin--slow">
        <Rune kind="ice" />
      </div>
    </div>
  );
}

// ---------- bomb: the fire portal ----------
// Inside the targeted balloon, centred on its envelope: a fire rune flies in from the staff (`from`, in pixels),
// opens flat above the balloon (`lift` pixels up) like a portal and drops a pillar of fire through it; embers rise.
export function FirePortal({ from, lift }) {
  return (
    <span className="mg-portal" style={{ '--fx': `${from[0]}px`, '--fy': `${from[1]}px`, '--lift': `${-lift}px` }} aria-hidden="true">
      <span className="mg-portal__pillar" />
      <span className="mg-portal__rune">
        <span className="mg-spin mg-spin--fast">
          <Rune kind="fire" />
        </span>
      </span>
      {Array.from({ length: 8 }, (_, k) => (
        <i key={k} className="mg-portal__ember" style={{ '--k': k }} />
      ))}
    </span>
  );
}

// ---------- the ATP ultimate: Heaven's seal ----------
// The sky darkens, a bolt leaves the staff, and the lightning rune opens high in the sky behind the balloons; its five
// small circles charge one by one (the two bolts down to the balloons are UltStrike, inside them). Positions are in
// pixels in the sky: the staff `from`, the rune's centre `at` and width d.
export function UltSky({ from, at, d }) {
  return (
    <div className="mg-ult" aria-hidden="true">
      <div className="mg-ult__dim" />
      <div className="mg-ult__rune" style={{ left: at[0], top: at[1], width: d, height: d, margin: -d / 2, '--s0': 40 / d }}>
        <Rune kind="volt">
          {VOLT_SATELLITES.map(([x, y], k) => (
            <circle key={k} className="mg-ult__charge" cx={x} cy={y} r="7.5" fill="#60a5fa" style={{ '--k': k }} />
          ))}
        </Rune>
      </div>
      <Bolt x={from[0]} y={from[1]} toX={at[0]} toY={at[1]} color="#fbbf24" width={2.6} className="mg-ult__up" />
    </div>
  );
}

// Inside a struck balloon, centred on its envelope: a big bolt from a small circle of the rune (`from`, in pixels),
// then the balloon bursts in a gold and blue blast.
export function UltStrike({ from, blue }) {
  return (
    <span className="mg-strike" aria-hidden="true">
      <Bolt x={from[0]} y={from[1]} toX={0} toY={0} color={blue ? '#60a5fa' : '#fbbf24'} width={7} className="mg-strike__bolt" />
      <svg className="mg-blast" viewBox="-100 -100 200 200">
        <circle className="mg-blast__wave" r="90" fill="none" stroke="#fffbeb" vectorEffect="non-scaling-stroke" />
        <circle className="mg-blast__fire" r="50" fill="#fbbf24" fillOpacity="0.5" />
        <circle className="mg-blast__fire" r="16" fill="#fff" />
        <g className="mg-blast__sparks" strokeWidth="3" strokeLinecap="round">
          {Array.from({ length: 10 }, (_, k) => (
            <path key={k} d="M0 -30V-42" stroke={k % 2 ? '#60a5fa' : '#fbbf24'} transform={`rotate(${k * 36 + 17})`} />
          ))}
        </g>
      </svg>
    </span>
  );
}
