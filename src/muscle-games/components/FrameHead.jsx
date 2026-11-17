import { createContext, useContext, useEffect } from 'react';
import { useFx } from '../fx/Fx.jsx';
import { MAX_SCORE } from '../games/meta.js';

// The live score and session best of the game being played, given by GamePage to the game's frame header.
export const HudContext = createContext({ score: 0, best: null });

// The header row inside every game's frame (like Diameter's drawing sheet): a title on the left, then the game's own
// pills (time left, questions or pairs) and the score out of 10 and the session best. Each game styles it in its look
// through its frame's class; `pill` and `title` let a game reuse its own class names.
export default function FrameHead({ title, children, className = 'mg-fhead', titleClass = 'mg-fhead__title', pill = 'mg-fpill' }) {
  const { score, best } = useContext(HudContext);
  return (
    <div className={className}>
      <span className={titleClass}>{title}</span>
      {children}
      <span className={`${pill} mg-fpill--score`} aria-label={`Score ${score} out of ${MAX_SCORE}`}>
        Score {score}/{MAX_SCORE}
      </span>
      <span className={pill} aria-label={`Best this session ${best ?? 'none yet'}`}>
        Best {best ?? '—'}
      </span>
    </div>
  );
}

// "1:05"
export const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.max(0, t) % 60).padStart(2, '0')}`;

// Time left, as a pill in the frame header. In the last 10 s (or quarter) it turns red; the last 5 s tick.
export function TimePill({ left, total, pill = 'mg-fpill' }) {
  const fx = useFx();
  const secs = Math.max(0, Math.ceil(left));
  const low = left > 0 && left <= Math.min(10, total * 0.25);
  useEffect(() => {
    if (low && secs <= 5) fx.sound('tick');
  }, [secs, low, fx]);
  return (
    <span className={`${pill}${low ? ' mg-fpill--low' : ''}`} role="timer" aria-label={`${secs} seconds left`}>
      ⏱ {mmss(secs)}
    </span>
  );
}
