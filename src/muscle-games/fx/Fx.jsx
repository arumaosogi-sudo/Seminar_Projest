import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { isMuted, play, setMuted, vibrate } from './sound.js';

// Game juice shared by every game: confetti, floating points, sound, vibration and Armin's speech.
const ApiContext = createContext(null);
const StateContext = createContext(null);

export const CONFETTI = ['#14b8a6', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#fb7185'];
export const GOLD = ['#fbbf24', '#f59e0b', '#fde68a', '#fff7cc'];
export const ICE = ['#7dd3fc', '#bae6fd', '#e0f2fe', '#a5b4fc'];

export function FxProvider({ children }) {
  const [items, setItems] = useState([]);
  const [speech, setSpeech] = useState({ text: '', mood: 'idle', act: null, id: 0 });
  const [muted, setMutedState] = useState(isMuted);
  const seq = useRef(0);

  const api = useMemo(() => {
    const add = (item, life) => {
      const id = ++seq.current;
      setItems((list) => [...list, { ...item, id }]);
      setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), life);
    };
    return {
      burst(x, y, count = 16, palette = CONFETTI) {
        const bits = Array.from({ length: count }, (_, k) => ({
          dx: (Math.random() - 0.5) * 260,
          dy: -40 - Math.random() * 180,
          rot: Math.random() * 720 - 360,
          color: palette[k % palette.length],
          round: Math.random() < 0.4,
        }));
        add({ kind: 'burst', x, y, bits }, 1100);
      },
      float(x, y, text, tone = 'good') {
        add({ kind: 'float', x, y, text, tone }, 1000);
      },
      centerOf(target) {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
      // act: a move Armin plays once, then he stands still again ('point' at his first line, 'jump' to cheer)
      say(text, mood = 'happy', act = null) {
        setSpeech((s) => ({ text, mood, act, id: s.id + 1 }));
      },
      sound: play,
      vibrate,
      setMuted(value) {
        setMuted(value);
        setMutedState(value);
      },
    };
  }, []);

  return (
    <ApiContext.Provider value={api}>
      <StateContext.Provider value={{ speech, muted }}>
        {children}
        <div className="mg-fx-layer" aria-hidden="true">
          {items.map((it) =>
            it.kind === 'float' ? (
              <span key={it.id} className={`mg-fx-float mg-fx-float--${it.tone}`} style={{ left: it.x, top: it.y }}>
                {it.text}
              </span>
            ) : (
              <span key={it.id} className="mg-fx-burst" style={{ left: it.x, top: it.y }}>
                {it.bits.map((b, k) => (
                  <i
                    key={k}
                    style={{
                      '--dx': `${b.dx}px`,
                      '--dy': `${b.dy}px`,
                      '--rot': `${b.rot}deg`,
                      background: b.color,
                      borderRadius: b.round ? '50%' : '2px',
                    }}
                  />
                ))}
              </span>
            )
          )}
        </div>
      </StateContext.Provider>
    </ApiContext.Provider>
  );
}

export const useFx = () => useContext(ApiContext);
export const useFxState = () => useContext(StateContext);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

/* ---------- Armin, the muscle-buddy mascot ---------- */

// Sticker style: white head, red muscle body with white tendon lines, thick dark outline.
const INK = '#1f2937';
const MUSCLE = '#ef4444';
const MUSCLE_DARK = '#b91c1c';
const TENDON = '#ffffff';
const MOUTH = '#3a1414';
const LW = 3;
// Joints the limbs rotate around (styles.css rotates .mg-armin__arm / __leg per mood).
const SHOULDER = { l: [39, 88], r: [81, 88] };
const HIP = { l: [50, 122], r: [70, 122] };

const MOUTHS = {
  idle: 'M53 66 Q60 70 67 66',
  happy: 'M52 65 Q60 72 68 65',
  sad: 'M52 71 Q60 64 68 71',
};

// A round-capped stroke with an outline: draw the ink line a bit wider, then the colour on top.
function Outlined({ x1, y1, x2, y2, w, color }) {
  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={w + LW * 2} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
    </>
  );
}

// One arm or leg hanging straight down from its joint; CSS rotates the group around that joint.
function Limb({ part, side, joint: [x, y], length, width }) {
  const end = y + length;
  return (
    <g className={`mg-armin__${part} mg-armin__${part}--${side}`} style={{ transformOrigin: `${x}px ${y}px` }}>
      <Outlined x1={x} y1={y} x2={x} y2={end} w={width} color={MUSCLE} />
      {part === 'arm' ? (
        <>
          <line x1={x - 2} y1={y + 5} x2={x - 2} y2={end - 3} stroke={MUSCLE_DARK} strokeWidth="1.2" strokeLinecap="round" />
          <line x1={x + 2} y1={y + 5} x2={x + 2} y2={end - 3} stroke={MUSCLE_DARK} strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <line x1={x - 3} y1={end - 4} x2={x + 3} y2={end - 4} stroke={TENDON} strokeWidth="1.6" strokeLinecap="round" />
      )}
    </g>
  );
}

function Eye({ x, y, mood }) {
  const wow = mood === 'wow';
  const sad = mood === 'sad';
  const white = wow ? 10.5 : sad ? 8.5 : 9.5;
  const pupil = wow ? 7.5 : sad ? 5.8 : 6.8;
  const glint = wow ? 2.4 : sad ? 1.7 : 2.1;
  const py = y + (sad ? 2 : 0.5);
  return (
    <>
      <circle cx={x} cy={y} r={white + 4} fill={MUSCLE} />
      <ellipse cx={x} cy={y} rx={white} ry={sad ? white - 1 : white} fill="#fff" stroke={MUSCLE_DARK} strokeWidth="1" />
      <g className="mg-armin__pupil">
        <circle cx={x} cy={py} r={pupil} fill="#141414" />
        <circle cx={x + pupil * 0.35} cy={py - pupil * 0.38} r={glint} fill="#fff" />
        <circle cx={x - pupil * 0.35} cy={py + pupil * 0.4} r={glint * 0.45} fill="#fff" opacity=".85" />
      </g>
    </>
  );
}

export function Armin({ mood = 'idle', act = null, className = '', ...svgProps }) {
  const eyeY = mood === 'sad' ? 50 : 48;
  return (
    <svg viewBox="-6 0 132 150" className={`mg-armin mg-armin--${mood}${act ? ` mg-armin--act-${act}` : ''} ${className}`} aria-hidden="true" {...svgProps}>
      <g className="mg-armin__body">
        <Limb part="leg" side="l" joint={HIP.l} length={15} width={13} />
        <Limb part="leg" side="r" joint={HIP.r} length={15} width={13} />
        <path
          d="M44 80 Q60 76 76 80 Q86 82 86 92 L84 116 Q82 127 70 127 L50 127 Q38 127 36 116 L34 92 Q34 82 44 80Z"
          fill={MUSCLE}
          stroke={INK}
          strokeWidth={LW}
        />
        {/* tendons: linea alba, pecs, abs, groin and shoulders */}
        <g fill="none" stroke={TENDON} strokeWidth="2.2" strokeLinecap="round">
          <path d="M60 84 V121" />
          <path d="M41 96 Q50 101 58 97" />
          <path d="M79 96 Q70 101 62 97" />
          <path d="M51 105 H69" />
          <path d="M52 112 H68" />
          <path d="M42 109 Q49 122 58 124" />
          <path d="M78 109 Q71 122 62 124" />
          <path d="M46 81 L39 88" />
          <path d="M74 81 L81 88" />
        </g>
        <Limb part="arm" side="l" joint={SHOULDER.l} length={20} width={10} />
        <Limb part="arm" side="r" joint={SHOULDER.r} length={20} width={10} />
        <g className="mg-armin__head">
          <ellipse cx="21" cy="50" rx="5" ry="8" fill="#fff" stroke={INK} strokeWidth={LW} />
          <ellipse cx="99" cy="50" rx="5" ry="8" fill="#fff" stroke={INK} strokeWidth={LW} />
          <path d="M60 10 C30 10 20 30 21 48 C22 68 36 80 60 80 C84 80 98 68 99 48 C100 30 90 10 60 10Z" fill="#fff" stroke={INK} strokeWidth={LW} />
          <Eye x={45} y={eyeY} mood={mood} />
          <Eye x={75} y={eyeY} mood={mood} />
          {mood === 'sad' && <path d="M32 32 l14 5 M88 32 l-14 5" stroke="#141414" strokeWidth="2.5" strokeLinecap="round" />}
          {/* facial muscles: masseter on the cheeks, orbicularis oris round the mouth */}
          <ellipse cx="32" cy="65" rx="6.5" ry="6" fill={MUSCLE} />
          <ellipse cx="88" cy="65" rx="6.5" ry="6" fill={MUSCLE} />
          <rect x="47" y="62" width="26" height="12" rx="6" fill={MUSCLE} />
          {mood === 'wow' ? (
            <circle cx="60" cy="68" r="4.5" fill={MOUTH} />
          ) : (
            <path d={MOUTHS[mood] ?? MOUTHS.idle} stroke={MOUTH} strokeWidth="3" fill="none" strokeLinecap="round" />
          )}
          <ellipse cx="60" cy="77" rx="12" ry="3.2" fill={MUSCLE} />
        </g>
      </g>
    </svg>
  );
}

export function MascotBar({ fallback }) {
  const { speech } = useFxState();
  return (
    <div className="mg-mascot-bar">
      <Armin key={`m${speech.id}`} mood={speech.mood} act={speech.act} className="mg-mascot-bar__mascot" />
      <p key={`b${speech.id}`} className={`mg-mascot-bar__bubble${speech.act === 'point' ? ' mg-mascot-bar__bubble--nudge' : ''}`} role="status" aria-live="polite">
        {speech.text || fallback}
      </p>
    </div>
  );
}
