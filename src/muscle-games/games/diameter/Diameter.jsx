import { useEffect, useRef, useState } from 'react';
import { useFx } from '../../fx/Fx.jsx';
import { scoreOutOf10 } from '../meta.js';
import FrameHead from '../../components/FrameHead.jsx';
import { Lives } from '../../components/Hud.jsx';
import { DECOYS, STEPS, TOTAL_ANSWERS, art } from './levels.js';

// Diameter: zoom into a skeletal muscle in six steps (whole muscle → fascicle → muscle fiber → myofibril →
// sarcomere → myofilaments). Each step is a shape-fit puzzle on a grey render of the site's 3D model: a clue gives a part's function,
// the student finds that piece among the real pieces and decoys in the tray and drags it (or taps it, then taps its
// place) onto the model, where it snaps into its place and takes its colour. When the last piece is in, the full model shows a moment and
// the game moves on to the next step by itself, like Group Sort. Each part's place is numbered from the biggest part to
// the smallest, and every piece in the tray carries its name. Out of 10 = pieces placed over all 30 pieces of the
// six steps. A wrong answer takes no point away and adds no time, but costs one of 3 hearts; with none left the
// game ends (try again while hearts last; wrong tries are listed for review). No hints. The clock counts down from 5 minutes; when it runs out the game ends and pieces not placed score 0.
const W = 900; // every render is 900 x 600
const H = 600;
// shapes are tested on a half-size copy: a quarter of the pixels to read when a step loads (a 1-px slip is 2 px)
const MW = W / 2;
const MH = H / 2;
const TIME = 300; // seconds
const LIVES = 3;
const CLEARED_MS = 1400; // how long the finished model shows before the next stage
const mmss = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((v) => v[1]);

// art names whose tray picture shows only the part's biggest bit
const ONE = new Set(STEPS.flatMap((st) => st.parts.filter((p) => p.one).map((p) => `${st.id}-${p.id}`)));
// The box of the biggest connected bit of a mask (alpha > 30) inside the box x0..x1, y0..y1 (half-size pixels).
function biggestBit(a, x0, y0, x1, y1) {
  const seen = new Uint8Array(MW * MH);
  let best = { n: 0, x0, y0, x1, y1 };
  const stack = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * MW + x;
      if (seen[i] || a[i] <= 30) continue;
      const bit = { n: 0, x0: x, y0: y, x1: x, y1: y };
      seen[i] = 1;
      stack.push(i);
      while (stack.length) {
        const j = stack.pop();
        const px = j % MW;
        const py = (j / MW) | 0;
        bit.n++;
        if (px < bit.x0) bit.x0 = px;
        if (px > bit.x1) bit.x1 = px;
        if (py < bit.y0) bit.y0 = py;
        if (py > bit.y1) bit.y1 = py;
        for (const k of [px > 0 ? j - 1 : -1, px < MW - 1 ? j + 1 : -1, py > 0 ? j - MW : -1, py < MH - 1 ? j + MW : -1]) {
          if (k >= 0 && !seen[k] && a[k] > 30) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
      if (bit.n > best.n) best = bit;
    }
  }
  return best;
}

// The alpha of a piece's render (where it is opaque, it is that part) and its bounding box.
const masks = new Map();
function loadMask(name) {
  if (masks.has(name)) return masks.get(name);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = MW;
      c.height = MH;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, MW, MH);
      const d = x.getImageData(0, 0, MW, MH).data;
      const a = new Uint8Array(MW * MH);
      let area = 0;
      let x0 = MW;
      let y0 = MH;
      let x1 = 0;
      let y1 = 0;
      for (let i = 0; i < MW * MH; i++) {
        a[i] = d[i * 4 + 3];
        if (a[i] > 30) {
          area++;
          const px = i % MW;
          const py = (i / MW) | 0;
          if (px < x0) x0 = px;
          if (px > x1) x1 = px;
          if (py < y0) y0 = py;
          if (py > y1) y1 = py;
        }
      }
      // the tray picture, cut from the full-size render: the whole part, or for a part in thin bits spread over the
      // model (`one` in levels.js) just its biggest bit, so it reads on a small plate
      const b = ONE.has(name) ? biggestBit(a, x0, y0, x1, y1) : { x0, y0, x1, y1 };
      const t = document.createElement('canvas');
      t.width = (b.x1 - b.x0 + 3) * 2;
      t.height = (b.y1 - b.y0 + 3) * 2;
      t.getContext('2d').drawImage(img, (b.x0 - 1) * 2, (b.y0 - 1) * 2, t.width, t.height, 0, 0, t.width, t.height);
      // the box in full-size pixels
      resolve({ a, area, box: { x0: x0 * 2, y0: y0 * 2, x1: x1 * 2 + 1, y1: y1 * 2 + 1 }, thumb: t.toDataURL() });
    };
    img.onerror = () => resolve(null);
    img.src = art(name);
  });
  masks.set(name, p);
  return p;
}
// The places a part's number could sit: solid bits of the part (thin parts like titin have none, so any bit of it),
// nearest its middle first, at least 40 px of the render apart. d = how far from the middle. In 0-1.
function spotOptions(mask) {
  if (!mask) return [];
  const { a, box } = mask;
  const solid = (x, y) => a[y * MW + x] > 120 && a[y * MW + x - 3] > 120 && a[y * MW + x + 3] > 120 && a[(y - 3) * MW + x] > 120 && a[(y + 3) * MW + x] > 120;
  const cx = (box.x0 + box.x1) / 4;
  const cy = (box.y0 + box.y1) / 4;
  const spots = [];
  const collect = (ok) => {
    for (let y = 14; y < MH - 14; y += 2) for (let x = 14; x < MW - 14; x += 2) if (ok(x, y)) spots.push([x, y, (x - cx) ** 2 + (y - cy) ** 2]);
  };
  collect(solid);
  if (!spots.length) collect((x, y) => a[y * MW + x] > 60);
  spots.sort((p, q) => p[2] - q[2]);
  const out = [];
  for (const sp of spots) {
    if (out.length >= 16) break;
    if (out.every(([x, y]) => (sp[0] - x) ** 2 + (sp[1] - y) ** 2 >= 20 ** 2)) out.push(sp);
  }
  return out.map(([x, y, d]) => ({ x: x / MW, y: y / MH, d: Math.sqrt(d) / MW }));
}
// How big a part looks on the picture: how many of its pixels show.
const sizeOf = (m) => m?.area ?? 0;
// Each number on its part, at the first spot (nearest the part's middle) that is clear of the numbers already placed.
// 30 x 30 px numbers, 36 px apart on screen (w, h = the picture's size on screen); in 0-1.
function numberSpots(list, w, h) {
  const placed = [];
  return list.map((spots) => {
    const ok = spots.find((p) => placed.every((q) => ((p.x - q.x) * w) ** 2 + ((p.y - q.y) * h) ** 2 >= 36 ** 2)) ?? spots[0];
    if (!ok) return null;
    placed.push(ok);
    return { x: ok.x, y: ok.y, left: `${ok.x * 100}%`, top: `${ok.y * 100}%` };
  });
}

// The picture under the finger while a piece is dragged. Only one can exist: it lives on <body>, so anything that
// ends a drag without a pointerup on the piece (released outside the window, a second finger, the stage changing,
// leaving the game) must still remove it, or it stays stuck on the screen.
function clearGhosts() {
  document.querySelectorAll('.mg-zp__ghost').forEach((g) => g.remove());
}

// A piece in the tray: drag it onto the picture, or tap it to pick it up. The move and release are followed on the
// window, so the drag always ends wherever the finger or mouse is let go.
function Piece({ piece, picked, done, wrong, onPick, onDrop }) {
  const end = useRef(null); // stops the drag in progress, if any
  const latest = useRef({});
  latest.current = { piece, onPick, onDrop };
  useEffect(() => () => end.current?.(), []);

  const down = (e) => {
    if (done || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    end.current?.();
    clearGhosts();
    const start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    let ghost = null;
    const move = (ev) => {
      if (ev.pointerId !== start.id) return;
      if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        ghost = document.createElement('img');
        ghost.className = 'mg-zp__ghost';
        ghost.src = latest.current.piece.thumb;
        ghost.alt = '';
        document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      }
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      ghost?.remove();
      end.current = null;
    };
    const up = (ev) => {
      if (ev.pointerId !== start.id) return;
      const dragged = !!ghost;
      stop();
      const { piece: pc, onPick: pick, onDrop: drop } = latest.current;
      if (dragged) drop(pc, ev.clientX, ev.clientY);
      else pick(pc);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    end.current = stop;
  };
  return (
    <button
      type="button"
      className={`mg-zp__piece${picked ? ' mg-zp__piece--picked' : ''}${done ? ' mg-zp__piece--done' : ''}${wrong ? ' mg-zp__piece--wrong' : ''}`}
      onPointerDown={down}
      onDragStart={(e) => e.preventDefault()}
      disabled={done}
      aria-label={piece.name}
      data-piece={piece.id}
      aria-pressed={picked}
    >
      <span className="mg-zp__pno" aria-hidden="true">
        P-{String(piece.n).padStart(2, '0')}
      </span>
      <span className="mg-zp__plate">
        <img className="mg-zp__thumb" src={piece.thumb} alt="" draggable="false" />
      </span>
      <span className="mg-zp__pname" lang="en">
        {piece.name}
      </span>
    </button>
  );
}

export default function Diameter({ onScore, onFinish, runId, setExitReport }) {
  const fx = useFx();
  const st = useRef({ runId, right: 0, answered: 0, lives: LIVES, mistakes: [], done: false, t0: null }); // t0: when the first model is on screen
  const s = st.current;
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];
  const [pieces, setPieces] = useState([]); // the tray, shuffled
  const [marks, setMarks] = useState({}); // part id -> { n, left, top }: the numbers on the picture
  const [ready, setReady] = useState(false);
  const [placed, setPlaced] = useState([]); // part ids in the picture
  const [partIdx, setPartIdx] = useState(0); // which clue
  const [cleared, setCleared] = useState(false); // every piece of this stage is in place
  const [picked, setPicked] = useState(null);
  const [wrong, setWrong] = useState(null);
  const [msg, setMsg] = useState('');
  const [pops, setPops] = useState([]);
  const [left, setLeft] = useState(TIME); // seconds left
  const [lives, setLives] = useState(LIVES);
  const stepNow = useRef(0); // stepIdx for the clock's interval, which keeps its first render's closure
  const firstTry = useRef(true);
  const stageRef = useRef(null);
  const maskOf = useRef({});

  const score = () => scoreOutOf10(s.right, TOTAL_ANSWERS);
  stepNow.current = stepIdx;
  const report = (timeUp) => ({
    runId: s.runId,
    summary: `${s.right}/${TOTAL_ANSWERS} pieces placed · ${Math.min(stepNow.current + 1, STEPS.length)}/${STEPS.length} steps${
      s.lives <= 0 ? ' · out of hearts' : timeUp ? " · time's up" : ''
    }`,
    mistakes: s.mistakes,
  });

  useEffect(() => {
    // Leaving after at least one answer still saves the run.
    setExitReport?.(() => (!s.done && s.answered > 0 ? { score: score(), info: report() } : null));
    const id = setInterval(() => {
      if (s.t0 == null) return;
      const t = Math.max(0, TIME - Math.floor((performance.now() - s.t0) / 1000));
      setLeft(t);
      if (t === 0) {
        clearInterval(id);
        finish(true);
      }
    }, 250);
    return () => {
      clearInterval(id);
      clearGhosts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a new step: load the masks of its parts and decoys, then deal the tray
  useEffect(() => {
    let live = true;
    clearGhosts();
    setReady(false);
    setMarks({});
    setPieces([]);
    fx.say(step.say, 'happy', step === STEPS[0] ? 'point' : null); // Armin points at the first clue only
    const list = [
      ...step.parts.map((p) => ({ id: p.id, art: `${step.id}-${p.id}` })),
      ...step.decoys.map((d) => ({ id: `decoy:${d}`, art: DECOYS[d].art, decoy: d })),
    ];
    Promise.all(list.map((p) => loadMask(p.art))).then((ms) => {
      if (!live) return;
      maskOf.current = Object.fromEntries(list.map((p, k) => [p.art, ms[k]]));
      // numbered from the biggest part on the picture to the smallest (the clues keep their own order)
      const mask = (id) => maskOf.current[`${step.id}-${id}`];
      const order = step.parts.map((p) => p.id).sort((a, b) => sizeOf(mask(b)) - sizeOf(mask(a)));
      const r = stageRef.current?.getBoundingClientRect();
      const spots = numberSpots(order.map((id) => spotOptions(mask(id))), r?.width || 600, r?.height || 400);
      setMarks(Object.fromEntries(order.map((id, k) => [id, { n: k + 1, ...spots[k] }])));
      // each tray piece carries its name (a decoy, the name of what it really is)
      const nameOf = (p) => (p.decoy ? DECOYS[p.decoy].name : step.parts.find((x) => x.id === p.id).name);
      setPieces(shuffle(list).map((p, k) => ({ ...p, n: k + 1, name: nameOf(p), thumb: maskOf.current[p.art]?.thumb ?? art(p.art) })));
      setReady(true);
      if (s.t0 == null) s.t0 = performance.now();
      // load the next stage while this one is played, one picture at a time, so it shows at once and play stays smooth
      const next = STEPS[STEPS.indexOf(step) + 1];
      const todo = next ? [...next.parts.map((x) => `${next.id}-${x.id}`), ...next.decoys.map((d) => DECOYS[d].art), `${next.id}-grey`, `${next.id}-full`] : [];
      const more = () => {
        if (live && todo.length) loadMask(todo.shift()).then(() => setTimeout(more, 80));
      };
      setTimeout(more, 1000);
    });
    return () => {
      live = false;
    };
  }, [step, fx]);

  // Like Group Sort: when the last piece snaps in, the model shows in full colour for a moment and the game moves on to
  // the next stage by itself (or ends after the last). No card, no button, nothing else to tap.
  const advance = useRef(null);
  useEffect(() => {
    if (!cleared) return undefined;
    const go = setTimeout(() => advance.current?.(), CLEARED_MS);
    return () => clearTimeout(go);
  }, [cleared]);

  const at = (clientX, clientY) => {
    const r = stageRef.current.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    return { fx: (clientX - r.left) / r.width, fy: (clientY - r.top) / r.height, px: clientX - r.left, py: clientY - r.top, x: clientX, y: clientY };
  };
  const pop = (text, p, bad) => {
    const id = Math.random();
    setPops((ps) => [...ps, { id, text, x: p.px, y: p.py, bad }]);
    setTimeout(() => setPops((ps) => ps.filter((q) => q.id !== id)), 1000);
  };

  // One point per piece placed (the user's rule, as in Balloon Pop: a wrong try first never takes the point away).
  // A wrong try is just wrong: no point lost, no time added; the first per clue is listed for review.
  const answer = (ok, p, mistake) => {
    const first = firstTry.current;
    if (first) s.answered += 1;
    if (ok) s.right += 1;
    if (!ok) {
      firstTry.current = false;
      if (mistake && first) s.mistakes.push(mistake);
      fx.sound('bad');
      fx.vibrate(100);
      pop('✗ Wrong', p, true);
      s.lives -= 1;
      setLives(s.lives);
      if (s.lives <= 0) {
        fx.say('Out of hearts 💔', 'sad');
        setTimeout(() => finish(), 700);
      }
    } else {
      fx.sound('snap');
      fx.burst(p.x, p.y, 14);
      pop(first ? '✓ Right' : '✓', p);
    }
    onScore(score());
  };

  const tryPiece = (piece, p) => {
    if (cleared || s.lives <= 0 || s.done) return;
    const want = step.parts[partIdx];
    // The question is which piece fits the clue: the right piece let go anywhere on the picture snaps into its place
    // and counts as right (thin parts are hard to hit exactly with a finger). Only a wrong piece or a decoy is wrong.
    const ok = piece.id === want.id;
    if (ok) {
      answer(true, p);
      setPlaced((pl) => [...pl, want.id]);
      setPicked(null);
      setMsg(`✓ ${want.name}`);
      firstTry.current = true;
      if (partIdx + 1 < step.parts.length) setPartIdx(partIdx + 1);
      else {
        setCleared(true);
        fx.sound('win');
      }
      return;
    }
    const d = piece.decoy && DECOYS[piece.decoy];
    answer(false, p, { prompt: want.clue, yours: d ? d.name : step.parts.find((x) => x.id === piece.id)?.name, answer: want.name });
    setWrong(piece.id);
    setTimeout(() => setWrong(null), 400);
    setMsg(d ? `✗ That is the ${d.name} — ${d.why}.` : '✗ Not this piece — read the clue again.');
  };

  const dropPiece = (piece, clientX, clientY) => {
    const p = at(clientX, clientY);
    if (p) tryPiece(piece, p);
  };
  const pickPiece = (piece) => {
    if (cleared) return;
    setPicked(piece);
    setMsg('Now tap where it goes on the model');
  };
  // tap on the picture: drop the picked piece there
  const tapStage = (e) => {
    const p = at(e.clientX, e.clientY);
    if (p && picked) tryPiece(picked, p);
  };

  function finish(timeUp) {
    if (s.done) return;
    s.done = true;
    // end screen: BUILD COMPLETE when all 6 stages were built with hearts and time left, else BUILD FAILED
    onFinish(score(), { ...report(timeUp), mission: !timeUp && s.lives > 0 ? 'complete' : 'failed' });
  }
  const goNext = () => {
    if (stepIdx + 1 >= STEPS.length) {
      finish();
      return;
    }
    // no zoom: the next stage simply takes the place of this one
    setStepIdx(stepIdx + 1);
    setPlaced([]);
    setPartIdx(0);
    setCleared(false);
    setPicked(null);
    setMsg('');
  };
  advance.current = goNext;

  return (
    <section className="mg-zp">
      <FrameHead className="mg-zp__top" titleClass="mg-zp__dwg" pill="mg-zp__pill" title={`Diameter / DWG-0${stepIdx + 1} · ${step.title}`}>
        <span className={`mg-zp__pill${left <= 30 ? ' mg-zp__pill--low' : ''}`} role="timer" aria-label={`${mmss(left)} left`}>
          ⏱ {mmss(left)}
        </span>
        <span className="mg-zp__pill">
          Stage {stepIdx + 1}/{STEPS.length}
        </span>
        <span className="mg-zp__pill mg-fpill--lives">
          <Lives lives={lives} max={LIVES} />
        </span>
      </FrameHead>
      <ol className="mg-zp__steps" aria-label="Zoom steps">
        {STEPS.map((x, k) => (
          <li key={x.id} className={k === stepIdx ? 'mg-on' : k < stepIdx || (k === stepIdx && cleared) ? 'mg-done' : undefined}>
            {String(k + 1).padStart(2, '0')} {x.title}
          </li>
        ))}
      </ol>

      <div className="mg-zp__clue" role="status" aria-live="polite">
        {cleared ? (
          <>
            <b>✓ Stage {stepIdx + 1} built: {step.title}</b>
            {step.zoom ? `Next: ${step.zoom}…` : 'Every part is in place.'}
          </>
        ) : (
          <>
            <b>
              Clue {partIdx + 1} of {step.parts.length} · find the piece and put it in place
            </b>
            {step.parts[partIdx].clue}
          </>
        )}
      </div>

      <div key={step.id} ref={stageRef} className="mg-zp__stage" onClick={tapStage}>
        <img className="mg-zp__base" src={art(`${step.id}-grey`)} alt={`${step.title}, rendered from the 3D model`} draggable="false" />
        {/* built: the whole model appears in colour, including the parts that were only context */}
        <img className={`mg-zp__full${cleared ? ' mg-on' : ''}`} src={art(`${step.id}-full`)} alt="" draggable="false" />
        {step.parts.map((p) => {
          const on = placed.includes(p.id);
          return <img key={p.id} className={`mg-zp__part${on ? ' mg-on' : ''}`} src={art(`${step.id}-${p.id}`)} alt="" draggable="false" style={on && p.see ? { opacity: p.see } : undefined} />;
        })}
        {/* the empty spots: a faint tint in the shape of each part still to place */}
        {step.parts
          .filter((p) => !placed.includes(p.id))
          .map((p) => {
            const url = `url("${art(`${step.id}-${p.id}`)}")`;
            return <span key={`slot-${p.id}`} className="mg-zp__slot" style={{ maskImage: url, WebkitMaskImage: url }} />;
          })}
        {step.parts.map((p) =>
          marks[p.id]?.left ? (
            <span key={`n-${p.id}`} className={`mg-zp__num${placed.includes(p.id) ? ' mg-on' : ''}`} style={{ left: marks[p.id].left, top: marks[p.id].top }} aria-hidden="true">
              {marks[p.id].n}
            </span>
          ) : null
        )}
        {pops.map((q) => (
          <span key={q.id} className={`mg-zp__pop${q.bad ? ' mg-zp__pop--bad' : ''}`} style={{ left: q.x, top: q.y }}>
            {q.text}
          </span>
        ))}
        {!ready && <span className="mg-zp__loading">Loading the model…</span>}
      </div>

      {/* the drawing's dimension line: the real size of what is on the board */}
      <p className="mg-zp__dim">{step.scale}</p>
      <p className="mg-zp__msg">{msg}</p>

      <div className="mg-zp__tray">
        {pieces.map((p) => (
          <Piece key={p.id} piece={p} picked={picked?.id === p.id} done={placed.includes(p.id)} wrong={wrong === p.id} onPick={pickPiece} onDrop={dropPiece} />
        ))}
      </div>
      <p className="mg-zp__tip">Drag a piece onto the model, or tap a piece and then tap where it goes.</p>
    </section>
  );
}
