import { Link } from 'react-router-dom';
import { STAGES } from '../games/sort/data.js';
import muscleArt from '../games/diameter/art/muscle-full.webp';
import filamentsArt from '../games/diameter/art/filaments-full.webp';

// End screens in each game's own style (chosen with the user, 2026-11-15). Every one shows the same things: a red
// rubber stamp that says whether the mission was completed or failed, the score, the best score, and each wrong
// answer with the right one. Picture Match: a case report on the detective's desk. Conveyor Sort: a delivery manifest
// on a clipboard. Diameter: an engineering drawing sheet with its title block.

// One line per wrong item (a fact or clue may hold several wrong tries).
export function wrongAnswers(mistakes) {
  const seen = new Set();
  return mistakes.filter((m) => !seen.has(m.prompt) && seen.add(m.prompt));
}

function Stamp({ className, children }) {
  return <span className={`mg-rstamp ${className ?? ''}`}>{children}</span>;
}

function Actions({ again, onRestart, theme }) {
  return (
    <div className={`mg-ractions mg-ractions--${theme}`}>
      <button type="button" className="mg-rbtn mg-rbtn--main" onClick={onRestart} autoFocus>
        ↻ {again}
      </button>
      <Link to=".." className="mg-rbtn">
        Back to games
      </Link>
    </div>
  );
}

function Save({ text, state, className }) {
  if (!text) return null;
  return (
    <p className={`mg-rsave mg-rsave--${state} ${className ?? ''}`} role="status">
      {text}
    </p>
  );
}

const Of = ({ value, max }) => (
  <>
    {value}
    <small> /{max}</small>
  </>
);

// ── Picture Match: CASE CLOSED / CASE UNSOLVED ──────────────────────────────────────────────────────────────────
export function CaseFileResult({ result, best, max, saveText, onRestart }) {
  const failed = result.mission === 'failed';
  const wrong = wrongAnswers(result.mistakes);
  const [a, b] = STAGES[0].groups;
  return (
    <div className="mg-result mg-result--desk" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="mg-rwrap">
        <div className="mg-case">
          <div className="mg-case__tab">CASE Nº 02 · OL2</div>
          <div className="mg-case__folder">
            <article className="mg-case__sheet">
              <span className="mg-case__clip" aria-hidden="true" />
              <figure className="mg-case__photo mg-case__photo--a" aria-hidden="true">
                <a.Art />
                <figcaption>Exhibit A</figcaption>
              </figure>
              <figure className="mg-case__photo mg-case__photo--b" aria-hidden="true">
                <b.Art />
                <figcaption>Exhibit B</figcaption>
              </figure>
              <p className="mg-case__unit">
                MYO CITY POLICE
                <br />
                MUSCLE CRIMES UNIT
              </p>
              <h2 id="result-title" className="mg-case__title">
                CASE REPORT
              </h2>
              <p className="mg-case__sub">
                Suspects: skeletal · cardiac · smooth
                <br />
                Scene: inside skeletal muscle
              </p>
              <div className="mg-case__rule" />
              <div className="mg-case__scores">
                <div className="mg-case__points">
                  <span>YOUR SCORE</span>
                  <b className="mg-case__big">
                    <Of value={result.score} max={max} />
                  </b>
                  <span>BEST SCORE</span>
                  <b>
                    <Of value={best} max={max} />
                  </b>
                </div>
                <div className="mg-case__verdict">
                  <Stamp className={failed ? 'mg-rstamp--dark' : ''}>
                    Case
                    <br />
                    {failed ? 'unsolved' : 'closed'}
                  </Stamp>
                  {result.summary && <small>{result.summary}</small>}
                </div>
              </div>
              <div className="mg-case__rule" />
              {wrong.length > 0 ? (
                <>
                  <p className="mg-case__label">MISFILED EVIDENCE · CORRECT FILE</p>
                  <ol className="mg-case__wrong">
                    {wrong.map((m) => (
                      <li key={m.prompt}>
                        “{m.prompt}”<b>→ {m.answer}</b>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="mg-case__clean">No evidence misfiled. Every fact is in its file.</p>
              )}
              <div className="mg-case__foot">
                <Save text={saveText} state={result.save} />
                <div className="mg-case__sign">
                  <span>Det. Armin</span>
                  <small>LEAD INVESTIGATOR</small>
                </div>
              </div>
            </article>
          </div>
          <svg className="mg-desk__lens" viewBox="0 0 110 110" aria-hidden="true">
            <circle cx="40" cy="40" r="30" fill="#bfe3ff33" stroke="#c9a24a" strokeWidth="7" />
            <circle cx="40" cy="40" r="26" fill="none" stroke="#fff6" strokeWidth="2" strokeDasharray="20 120" />
            <path d="M62 62l36 36" stroke="#3a1e0a" strokeWidth="12" strokeLinecap="round" />
            <path d="M62 62l10 10" stroke="#c9a24a" strokeWidth="10" />
          </svg>
        </div>
        <Actions again="Play again" onRestart={onRestart} theme="desk" />
      </div>
    </div>
  );
}

// ── Conveyor Sort: SHIPMENT COMPLETE / SHIPMENT FAILED ──────────────────────────────────────────────────────────
const BARS = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 2];

export function ManifestResult({ result, best, max, saveText, onRestart }) {
  const failed = result.mission === 'failed';
  const wrong = wrongAnswers(result.mistakes);
  const crates = result.crates ?? [];
  const total = STAGES.reduce((n, st) => n + st.facts.length, 0);
  let x = 0;
  return (
    <div className="mg-result mg-result--dock" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="mg-rwrap">
        <div className="mg-clipboard">
          <span className="mg-clipboard__clip" aria-hidden="true" />
          <article className="mg-manifest">
            <header className="mg-manifest__head">
              <div>
                <small>MYO FACTORY · DOCK 2</small>
                <h2 id="result-title">
                  DELIVERY
                  <br />
                  MANIFEST
                </h2>
              </div>
              <svg className="mg-manifest__barcode" viewBox="0 0 96 30" aria-hidden="true">
                {BARS.map((w, i) => {
                  const r = <rect key={i} x={x} width={w} height="24" />;
                  x += w + 2;
                  return r;
                })}
                <text x="48" y="30" textAnchor="middle">
                  OL2-{String(total).padStart(4, '0')}-MYO
                </text>
              </svg>
            </header>
            <div className="mg-manifest__load">
              <svg viewBox="0 0 64 54" aria-hidden="true">
                <path d="M6 14l26-10 26 10v28l-26 10-26-10z" fill="#c8894a" stroke="#6b4220" strokeWidth="2" />
                <path d="M6 14l26 10 26-10M32 24v28" stroke="#6b4220" strokeWidth="2" fill="none" />
                <path d="M12 22l14 5M12 30l14 5M12 38l14 5M38 28l14-5M38 36l14-5" stroke="#8a5a2e" />
              </svg>
              <div>
                <small>
                  {total} CRATES · {STAGES.length} STAGES
                </small>
                <div className="mg-manifest__crates" aria-label={`${crates.filter(Boolean).length} of ${total} crates packed right`}>
                  {Array.from({ length: total }, (_, i) => (
                    <i key={i} className={i < crates.length ? (crates[i] ? 'is-ok' : 'is-bad') : ''} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mg-manifest__stamp">
              <Stamp>{failed ? 'You’re fired' : 'You’re hired'}</Stamp>
            </div>
            <div className="mg-manifest__lcds">
              <div>
                <span>YOUR SCORE</span>
                <b>
                  <Of value={result.score} max={max} />
                </b>
              </div>
              <div>
                <span>BEST SCORE</span>
                <b>
                  <Of value={best} max={max} />
                </b>
              </div>
            </div>
            {wrong.length > 0 ? (
              <div className="mg-manifest__table">
                <p>WRONG BIN → CORRECT BIN</p>
                <ul>
                  {wrong.map((m) => (
                    <li key={m.prompt}>
                      <span aria-hidden="true">✗</span>
                      <div>
                        {m.prompt}
                        <b>→ {m.answer}</b>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mg-manifest__clean">Every crate went to the right bin.</p>
            )}
            <footer className="mg-manifest__foot">
              <Save text={saveText} state={result.save} />
              <div>
                <small>SIGNED · FLOOR MANAGER</small>
                <span>Armin</span>
              </div>
            </footer>
          </article>
        </div>
        <Actions again="Play again" onRestart={onRestart} theme="dock" />
      </div>
    </div>
  );
}

// ── Diameter: BUILD COMPLETE / BUILD FAILED ─────────────────────────────────────────────────────────────────────
export function DrawingResult({ result, best, max, saveText, onRestart }) {
  const failed = result.mission === 'failed';
  const wrong = wrongAnswers(result.mistakes);
  return (
    <div className="mg-result mg-result--blueprint" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="mg-rwrap">
        <article className="mg-dwg">
          <p className="mg-dwg__meta">
            <span>DIAMETER / DWG-06</span>
            <span>REV C</span>
            <span>SHEET 6 OF 6</span>
          </p>
          <h2 id="result-title" className="mg-dwg__title">
            {failed ? 'MUSCLE, UNFINISHED' : 'MUSCLE, ASSEMBLED'}
          </h2>
          <p className="mg-dwg__sub">GENERAL ARRANGEMENT · WHOLE MUSCLE TO MYOFILAMENTS</p>
          <div className="mg-dwg__view" aria-hidden="true">
            <img className="mg-dwg__muscle" src={muscleArt} alt="" draggable={false} />
            <div className="mg-dwg__detail">
              <img src={filamentsArt} alt="" draggable={false} />
            </div>
            <svg viewBox="0 0 334 170" preserveAspectRatio="none">
              <g stroke="#e8f1ff" fill="none" strokeWidth=".8">
                <path d="M150 70 L206 40M150 90 L206 118" strokeDasharray="4 3" />
                <path d="M14 152h180M14 146v12M194 146v12M216 150h104M216 144v12M320 144v12" />
              </g>
              <g fill="#9fc3f0" fontFamily="Consolas, monospace" fontSize="9">
                <text x="84" y="164">Ø 30 cm</text>
                <text x="250" y="164">Ø 15 nm</text>
                <text x="200" y="22">DETAIL A</text>
                <text x="8" y="14">VIEW 1:1</text>
              </g>
              <circle cx="150" cy="80" r="10" stroke="#f5c518" fill="none" strokeWidth="1.2" />
              <text x="146" y="84" fontSize="10" fontFamily="Consolas, monospace" fill="#f5c518">
                A
              </text>
            </svg>
          </div>
          <div className="mg-dwg__stamp">
            <Stamp>{failed ? 'Build failed' : 'Build complete'}</Stamp>
          </div>
          {wrong.length > 0 ? (
            <>
              <p className="mg-dwg__label">REVISIONS · WRONG PIECE → RIGHT PIECE</p>
              <ul className="mg-dwg__revs">
                {wrong.map((m, i) => (
                  <li key={m.prompt}>
                    <span>△{i + 1}</span>
                    <div>
                      “{m.prompt}” → <b>{m.answer}</b>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mg-dwg__label">NO REVISIONS · EVERY PIECE IN PLACE</p>
          )}
          <div className="mg-dwg__block">
            <div className="mg-dwg__cell mg-dwg__cell--score">
              YOUR SCORE
              <b>
                <Of value={result.score} max={max} />
              </b>
            </div>
            <div className="mg-dwg__cell mg-dwg__cell--best">
              BEST
              <b>{best}</b>
            </div>
            <div className="mg-dwg__cell">
              SCALE<span>1 : 120 000</span>
            </div>
            <div className="mg-dwg__cell">
              DRAWN<span>APPRENTICE</span>
            </div>
            <div className="mg-dwg__cell">
              CHECKED<span className="mg-dwg__sign">Armin</span>
            </div>
          </div>
          <Save text={saveText} state={result.save} className="mg-dwg__save" />
        </article>
        <Actions again="Play again" onRestart={onRestart} theme="blueprint" />
      </div>
    </div>
  );
}
