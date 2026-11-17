import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFx } from '../../fx/Fx.jsx';
import { Lives, useCountdown } from '../../components/Hud.jsx';
import FrameHead, { TimePill } from '../../components/FrameHead.jsx';
import { scoreOutOf10 } from '../meta.js';
import { shuffle } from '../util.js';
import { STAGES, TOTAL_FACTS, groupOf } from './data.js';

// Picture Match: the same two stages as Conveyor Sort (data.js). Each stage is two cases; a case pins the stage's
// pictures and six of its facts on an evidence board (stage 1: 3 pictures, two facts each; stage 2: 6 pictures, one
// fact each). Tap a picture, then a fact that goes with it.
// A wrong match costs a heart; with no hearts left the game ends.
const TIME = 180;
const LIVES = 3;
const ROUND_BREAK_MS = 1100;
const PER_STAGE = 2; // cases per stage, each with an equal share of every group's facts
const makeCases = () => STAGES.flatMap((stage, si) => {
  const facts = shuffle(stage.facts);
  return Array.from({ length: PER_STAGE }, (_, k) => ({
    si,
    k,
    stage,
    facts: stage.groups.flatMap((g) => {
      const mine = facts.filter((f) => f.answer === g.id);
      const n = mine.length / PER_STAGE;
      return mine.slice(k * n, (k + 1) * n);
    }),
  }));
});
export const TOTAL_PAIRS = TOTAL_FACTS;

function dealCase(c) {
  const pics = shuffle(c.stage.groups.map((g) => ({ uid: `${g.id}-pic`, pair: g.id, kind: 'pic', g })));
  const texts = shuffle(c.facts.map((f, i) => ({ uid: `${f.answer}-txt-${i}`, pair: f.answer, kind: 'text', text: f.text, f })));
  return { pics, texts };
}

export default function Memory({ onScore, onFinish }) {
  const fx = useFx();
  const [round, setRound] = useState(0);
  const cases = useMemo(makeCases, []);
  const kase = cases[round];
  const deck = useMemo(() => dealCase(kase), [kase]);
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState({}); // fact card uid -> its picture's group
  const picDone = (pair) => deck.texts.every((t) => t.pair !== pair || matched[t.uid]);
  const [wrongPair, setWrongPair] = useState([]);
  const [between, setBetween] = useState(false);
  const [closed, setClosed] = useState(false); // shows the CASE CLOSED stamp
  const [over, setOver] = useState(false);
  const [strings, setStrings] = useState([]);
  const boardRef = useRef(null);
  const st = useRef({ misses: 0, found: 0, lives: LIVES, mistakes: [] });
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const s = st.current;

  // Out of 10: pairs found over all 18 pairs. A wrong match costs a heart, not a point.
  const score = () => scoreOutOf10(s.found, TOTAL_PAIRS);
  const [left] = useCountdown(TIME, { running: !between && !over, onExpire: () => end(false) });

  useEffect(() => {
    fx.say(`Stage 1: ${STAGES[0].title}. Tap a picture, then the fact that goes with it!`, 'happy', 'point');
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, [fx]);

  // Tie each found pair's pins together. Positions are measured from the board's padding box (where the string layer
  // sits, inside its wooden border), and re-measured every frame for a moment after a match while the cards settle
  // (the tapped cards slide back from their lifted look), and again when the board changes size.
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return undefined;
    const measure = () => {
      const box = board.getBoundingClientRect();
      const ox = box.left + board.clientLeft;
      const oy = box.top + board.clientTop;
      const pin = (uid) => {
        const r = board.querySelector(`[data-card="${uid}"] .mg-pcard__pin`)?.getBoundingClientRect();
        return r && { x: r.left + r.width / 2 - ox, y: r.top + r.height / 2 - oy };
      };
      setStrings(
        Object.entries(matched).flatMap(([uid, pair]) => {
          const a = pin(`${pair}-pic`);
          const b = pin(uid);
          return a && b ? [{ pair: uid, a, b }] : [];
        })
      );
    };
    measure();
    const until = performance.now() + 700;
    let raf = requestAnimationFrame(function tick() {
      measure();
      if (performance.now() < until) raf = requestAnimationFrame(tick);
    });
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    board.addEventListener('transitionend', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      board.removeEventListener('transitionend', measure);
    };
  }, [matched, deck]);

  function end(completed) {
    if (s.over) return;
    s.over = true;
    setOver(true);
    setClosed(completed);
    fx.say(completed ? 'All pairs found! 🎉' : s.lives <= 0 ? 'Out of hearts 💔' : 'Time’s up! ⏰', completed ? 'wow' : 'sad');
    later(
      () =>
        onFinish(score(), {
          summary: `${s.found}/${TOTAL_PAIRS} pairs · ${s.misses} wrong`,
          mistakes: s.mistakes,
          mission: completed ? 'complete' : 'failed', // end screen: CASE CLOSED or CASE UNSOLVED
        }),
      1100
    );
  }

  const roundCleared = () => {
    if (round + 1 >= cases.length) {
      end(true);
      return;
    }
    const next = cases[round + 1];
    setBetween(true);
    setClosed(true);
    fx.sound('win');
    fx.say(next.si !== kase.si ? `Stage ${kase.si + 1} cleared! Stage ${next.si + 1}: ${next.stage.title}` : `Case ${kase.k + 1} cleared! Next case…`, 'wow');
    later(() => {
      setRound(round + 1);
      setMatched({});
      setSelected(null);
      setBetween(false);
      setClosed(false);
    }, ROUND_BREAK_MS);
  };

  const tap = (card) => {
    if (between || over || s.lives <= 0 || (card.kind === 'text' ? matched[card.uid] : picDone(card.pair)) || wrongPair.length) return;
    if (!selected || selected.uid === card.uid || selected.kind === card.kind) {
      fx.sound('flip');
      setSelected(selected?.uid === card.uid ? null : card);
      return;
    }
    const [pic, text] = card.kind === 'pic' ? [card, selected] : [selected, card];
    setSelected(null);
    if (pic.pair === text.pair) {
      s.found += 1;
      onScore(score());
      const { x, y } = fx.centerOf(`[data-card="${card.uid}"]`);
      fx.sound('good');
      fx.burst(x, y, 20);
      fx.float(x, y - 20, '✓');
      const nextMatched = { ...matched, [text.uid]: pic.pair };
      setMatched(nextMatched);
      if (Object.keys(nextMatched).length === deck.texts.length) roundCleared();
    } else {
      s.misses += 1;
      s.lives -= 1;
      onScore(score());
      s.mistakes.push({ prompt: text.text, yours: pic.g.label, answer: groupOf(kase.stage, text.f.answer).label, why: text.f.why });
      if (s.lives <= 0) later(() => end(false), 500);
      fx.sound('bad');
      fx.vibrate(100);
      setWrongPair([pic.uid, text.uid]);
      later(() => setWrongPair([]), 700);
    }
  };

  // `i` staggers the pin-up animation.
  const cardStyle = (c, i) => ({ '--i': i });

  const cardClass = (c) =>
    `mg-pcard mg-pcard--${c.kind}${selected?.uid === c.uid ? ' mg-pcard--selected' : ''}${(c.kind === 'text' ? matched[c.uid] : picDone(c.pair)) ? ' mg-pcard--matched' : ''}${
      c.kind === 'pic' && Object.values(matched).includes(c.pair) ? ' mg-pcard--tied' : ''
    }${
      wrongPair.includes(c.uid) ? ' mg-pcard--wrong' : ''
    }`;

  return (
    <section className="mg-memory mg-frame mg-frame--noir">
      {/* a film-noir detective's office, the game on an evidence board in a wooden frame (see .mg-frame--noir) */}
      <FrameHead title={`Picture Match · ${kase.stage.title}`}>
        <TimePill left={left} total={TIME} />
        <span className="mg-fpill">
          Stage {kase.si + 1}/{STAGES.length} · Case {kase.k + 1}/{PER_STAGE}
        </span>
        <span className="mg-fpill" aria-label={`${s.found} of ${TOTAL_PAIRS} pairs found`}>
          Pairs {s.found}/{TOTAL_PAIRS}
        </span>
        <span className="mg-fpill mg-fpill--lives">
          <Lives lives={s.lives} max={LIVES} />
        </span>
      </FrameHead>
      <div className="mg-cork" ref={boardRef}>
        <div className={`mg-pmatch${deck.pics.length === 3 ? ' mg-pmatch--three' : ''}${between ? ' mg-pmatch--fade' : ''}`} key={round}>
          <div className="mg-pmatch__col">
            <p className="mg-pmatch__label">Evidence</p>
            <div className={`mg-pmatch__grid${deck.pics.length === 3 ? ' mg-pmatch__grid--three' : ''}`}>
              {deck.pics.map((c, i) => (
                <button
                  key={c.uid}
                  type="button"
                  data-card={c.uid}
                  className={cardClass(c)}
                  style={cardStyle(c, i)}
                  onClick={() => tap(c)}
                  aria-pressed={selected?.uid === c.uid}
                  aria-label={`Picture: ${c.g.label}`}
                >
                  <i className="mg-pcard__pin" />
                  <span className="mg-pcard__photo">
                    <c.g.Art />
                  </span>
                  <span className="mg-pcard__caption">{c.g.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mg-pmatch__col">
            <p className="mg-pmatch__label">Facts</p>
            <div className="mg-pmatch__grid">
              {deck.texts.map((c, i) => (
                <button
                  key={c.uid}
                  type="button"
                  data-card={c.uid}
                  className={cardClass(c)}
                  style={cardStyle(c, deck.pics.length + i)}
                  onClick={() => tap(c)}
                  aria-pressed={selected?.uid === c.uid}
                >
                  <i className="mg-pcard__pin" />
                  <strong>{c.text}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
        {closed && <p className="mg-cork__stamp">CASE CLOSED</p>}
        {/* strings run from pin centre to pin centre; the pins are drawn again on top so the string sits behind them */}
        <svg className="mg-cork__strings" aria-hidden="true">
          <defs>
            <radialGradient id="mg-pin-red" cx="35%" cy="30%" r="70%">
              <stop offset="0.25" stopColor="#ffb4b4" />
              <stop offset="0.45" stopColor="#d63a3a" />
              <stop offset="1" stopColor="#a82424" />
            </radialGradient>
          </defs>
          {strings.map(({ pair, a, b }) => (
            <path
              key={`${round}-${pair}`}
              d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + Math.hypot(b.x - a.x, b.y - a.y) * 0.12} ${b.x} ${b.y}`}
              pathLength="1"
              stroke="var(--string)"
            />
          ))}
          {strings.flatMap(({ pair, a, b }) => [a, b].map((p, k) => <circle key={`${round}-${pair}-${k}`} cx={p.x} cy={p.y} r="7" />))}
        </svg>
      </div>
    </section>
  );
}
