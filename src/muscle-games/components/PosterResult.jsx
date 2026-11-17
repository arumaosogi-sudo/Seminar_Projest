import { Link } from 'react-router-dom';

// Balloon Pop's end screen: a WANTED poster nailed up in the night town, stamped in red MISSION COMPLETE (all 10 clues
// played with a heart left) or MISSION FAILED (out of hearts or time first). It shows only
// the score, the best score and the clues that were missed with their right answers.

// One line per missed clue (a clue may hold a wrong tap and then reach the castle: list it once).
function missedClues(mistakes) {
  const seen = new Set();
  return mistakes.filter((m) => !seen.has(m.prompt) && seen.add(m.prompt));
}

// Pen-and-ink drawing: the wizard zaps a balloon, which bursts, while another drifts by under the moon.
function Engraving() {
  return (
    <svg className="mg-poster__art" viewBox="0 0 220 120" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="186" cy="20" r="11" strokeWidth="1" />
        <path d="M178 14h16M176 19h20M176 24h20M178 29h16" strokeWidth=".5" />
        <g strokeWidth="1.3">
          <ellipse cx="150" cy="40" rx="20" ry="24" />
          <path d="M150 16v48M137 20q-7 20 0 40M163 20q7 20 0 40M131 34q19 4 38 0M132 48q18 4 36 0" />
          <path d="M136 58l8 15M164 58l-8 15M143 73h14v9h-14zM143 77h14M147 73v9M153 73v9" />
        </g>
        <path d="M160 22l6 6M162 30l6 6M164 38l5 5M163 47l5 5M160 55l4 4" strokeWidth=".5" />
        <path d="M70 50l18-8-6 9 22-11-8 11 18-6" stroke="#8a1b1b" strokeWidth="1.6" />
        <g strokeWidth="1">
          <path d="M112 30l4-9M118 36l9-3M110 22l-2-8M120 26l7-6M106 40l-4 6M100 24q4-4 8 0t8 0M104 46q3 3 6 0M96 30l-4-2M124 44l4 3" />
          <circle cx="114" cy="38" r="3" />
        </g>
        <g strokeWidth="1.3">
          <path d="M36 112l16-50 16 50z" />
          <path d="M48 62q6 16 0 24M60 62q-6 16 0 24M50 64q4 10 4 22" />
          <path d="M68 70l6-22" strokeWidth="1.8" />
          <circle cx="74" cy="46" r="3.5" />
        </g>
        {/* the face and the hat are drawn last, filled with the paper colour, so the robe and head lines don't show through */}
        <g strokeWidth="1.3" fill="#ead6a6">
          <circle cx="54" cy="58" r="7" />
          <path d="M45 52q2-9-3-15t-6-8q10 4 17 11t9 12z" />
          <ellipse cx="54" cy="52" rx="12.5" ry="3.2" transform="rotate(-6 54 52)" />
          <path d="M44 44q8 2 15 0" fill="none" strokeWidth=".6" />
        </g>
        <path d="M40 108l6-18M44 108l7-22M48 108l7-24M56 108l4-14M60 108l3-10M64 108l2-6" strokeWidth=".5" />
        <path d="M0 114q30-6 60-1t60-2 100 2" strokeWidth="1" />
        <path d="M8 118h30M90 118h40M170 117h40" strokeWidth=".5" />
        <path d="M14 30l2-4 2 4-4-2h4zM96 8l1.5-3 1.5 3-3-1.5h3zM206 52l1.5-3 1.5 3-3-1.5h3z" strokeWidth=".7" />
      </g>
    </svg>
  );
}

function WaxSeal() {
  return (
    <svg className="mg-poster__seal" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="mg-wax" cx=".38" cy=".32">
          <stop offset="0" stopColor="#e2474b" />
          <stop offset=".55" stopColor="#a3171d" />
          <stop offset="1" stopColor="#5e080c" />
        </radialGradient>
      </defs>
      <path
        d="M32 2c5 3 9 0 13 4s2 8 6 11 7 4 7 10-4 7-3 12 2 9-3 12-8 1-12 5-6 7-11 6-6-5-11-6-9 1-11-4-1-8-4-12-6-5-4-11 6-6 6-11 1-8 6-10 7 1 11-1 4-6 9-5z"
        fill="url(#mg-wax)"
      />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#5e080c" strokeWidth="2" />
      <circle cx="32" cy="32" r="16" fill="none" stroke="#e77a7c" strokeOpacity=".5" />
      <path d="M21 39c3-8 6-13 10-14s5 2 7 0 2-5 4-4-1 7-4 10-7 4-10 6-6 3-7 2z" fill="#7a0d12" />
      <text x="32" y="51" textAnchor="middle" fontSize="6" fill="#f3c2c2" fontFamily="Georgia, serif" letterSpacing="1">
        OL1
      </text>
    </svg>
  );
}

export default function PosterResult({ result, best, max, saveText, onRestart }) {
  const missed = missedClues(result.mistakes);
  const failed = result.mission === 'failed';
  return (
    <div className="mg-result mg-result--poster" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="mg-poster-wrap">
        <svg width="0" height="0" className="mg-poster__defs" aria-hidden="true">
          <filter id="mg-burn">
            <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="4" />
            <feDisplacementMap in="SourceGraphic" scale="12" />
          </filter>
        </svg>
        <article className="mg-poster">
          <span className="mg-poster__nail mg-poster__nail--tl" />
          <span className="mg-poster__nail mg-poster__nail--tr" />
          <span className="mg-poster__nail mg-poster__nail--bl" />
          <p className="mg-poster__rule">Tower Guild · Notice Nº 01</p>
          <h2 id="result-title" className="mg-poster__title">WANTED</h2>
          <p className="mg-poster__sub">The rogue balloons of Myo Town</p>
          <div className="mg-poster__scene">
            <Engraving />
            <span className={`mg-poster__stamp${failed ? ' mg-poster__stamp--failed' : ''}`}>{failed ? 'Mission failed' : 'Mission complete'}</span>
          </div>

          <div className="mg-poster__scores">
            <div>
              <span>Your score</span>
              <b>
                {result.score}
                <small> / {max}</small>
              </b>
            </div>
            <div>
              <span>Best score</span>
              <b>
                {best}
                <small> / {max}</small>
              </b>
            </div>
          </div>

          {missed.length > 0 ? (
            <>
              <p className="mg-poster__rule">Wrong answers</p>
              <ul className="mg-poster__missed">
                {missed.map((m) => (
                  <li key={m.prompt}>
                    <span>“{m.prompt}”</span>
                    <b>→ {m.answer}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mg-poster__clean">{failed ? 'No wrong answers, but time ran out.' : 'No wrong answers. Every balloon is down!'}</p>
          )}

          {saveText && (
            <p className={`mg-poster__save mg-poster__save--${result.save}`} role="status">
              {saveText}
            </p>
          )}
          <WaxSeal />
        </article>

        <div className="mg-poster__actions">
          <button type="button" className="mg-poster__btn mg-poster__btn--gold" onClick={onRestart} autoFocus>
            ↻ Play again
          </button>
          <Link to=".." className="mg-poster__btn">
            Back to games
          </Link>
        </div>
      </div>
    </div>
  );
}
