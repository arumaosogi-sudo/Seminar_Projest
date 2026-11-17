import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useScores } from '../scores.jsx';
import { Armin, MascotBar, useFx } from '../fx/Fx.jsx';
import { HudContext } from './FrameHead.jsx';
import { GAMES, MAX_SCORE, bestOf } from '../games/meta.js';
import { useGamesConfig } from '../config.js';
import { deliver, onOutboxChange, pendingFor } from '../outbox.js';
import PosterResult from './PosterResult.jsx';
import { CaseFileResult, DrawingResult, ManifestResult } from './StyledResults.jsx';

// Each game's own end screen (meta.js `resultStyle`: one name, or one per score key for Group Sort's two modes).
const RESULT_SCREENS = { poster: PosterResult, casefile: CaseFileResult, manifest: ManifestResult, drawing: DrawingResult };
const screenFor = (game, key) => RESULT_SCREENS[typeof game.resultStyle === 'object' ? game.resultStyle?.[key] : game.resultStyle];

const cheer = (score) =>
  score >= MAX_SCORE
    ? ['Perfect score! 10/10 🎉', 'wow']
    : score >= 9
    ? ['Excellent! Almost perfect 🌟', 'wow']
    : score >= 7
      ? ['Great job! Play again to push it higher.', 'happy']
      : score >= 5
        ? ['Nice! Review your mistakes and try again?', 'happy']
        : ['No worries. Review what you missed and try again!', 'sad'];

const SAVE_TEXT = {
  saving: 'Saving your score…',
  saved: '✓ Score saved',
  queued: '⏳ No connection. Your score is kept on this device and will upload by itself when you are back online.',
};

const newRunId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function dedupe(mistakes = []) {
  const seen = new Set();
  return mistakes.filter((m) => {
    const id = `${m.prompt}|${m.yours}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Page header in the main site's style: phones get a bar with a back chevron, wider screens a breadcrumb and big title.
function PageHead({ game }) {
  const subtitle = `Game ${GAMES.indexOf(game) + 1} · ${game.goal}`;
  return (
    <header className="mg-page-head">
      <div className="mg-page-head__bar">
        <Link to=".." className="mg-page-head__back" aria-label="Back to games">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div>
          <h1>{game.title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="mg-page-head__wide">
        <nav aria-label="Breadcrumb">
          <Link to="..">Games</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{game.title}</span>
        </nav>
        <h1>{game.title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

// Shared frame for every game: page header, Armin above the game, the live score out of 10 and session best (shown in
// each game's own frame header, see FrameHead), results, review and replay.
export default function GamePage({ game, Game }) {
  const { best, submit } = useScores();
  const fx = useFx();
  const { onGameFinish, gameHeader, playerId } = useGamesConfig();
  const [run, setRun] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const keyRef = useRef(game.keys[0]);
  const runIdRef = useRef(newRunId());
  // A game may register a function returning { score, info } for a run that is left before it ends.
  const exitReportRef = useRef(null);
  const reportedRef = useRef(false);

  const setScoreKey = useCallback((key) => {
    keyRef.current = key;
  }, []);

  // Runs before the game's own effects so the game can set its intro line; Armin points at the opening line.
  useLayoutEffect(() => {
    fx.say('', 'idle', 'point');
  }, [run, fx]);

  // Saves a run (score out of 10): session best and the host's onGameFinish hook (GAME-7 database).
  const record = useCallback(
    (final, info, completed) => {
      reportedRef.current = true;
      const key = info.key || keyRef.current;
      const isNewBest = submit(key, final);
      const mistakes = dedupe(info.mistakes);
      const runId = info.runId || runIdRef.current;
      // 'saving' → 'saved', or 'queued' when it failed and waits in the outbox for the next try.
      const saving = deliver(
        onGameFinish,
        {
          runId,
          gameId: game.id,
          mode: key.includes(':') ? key.split(':')[1] : null,
          scoreKey: key,
          score: final,
          maxScore: MAX_SCORE,
          completed,
          isNewBest,
          mistakes,
          summary: info.summary ?? '',
          finishedAt: new Date().toISOString(),
        },
        playerId
      );
      return { key, isNewBest, mistakes, runId, saving };
    },
    [game, submit, onGameFinish, playerId]
  );

  // Leaving (← Games, Back, restart) in the middle of a run still saves what was played, if the game supports it.
  const reportExit = useCallback(() => {
    if (reportedRef.current) return;
    const report = exitReportRef.current?.();
    if (report) record(report.score, report.info, false);
  }, [record]);
  const reportExitRef = useRef(reportExit);
  reportExitRef.current = reportExit;
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Deferred so StrictMode's dev-only unmount/remount does not count as leaving.
      setTimeout(() => {
        if (!mountedRef.current) reportExitRef.current();
      }, 0);
    };
  }, []);

  const setExitReport = useCallback((fn) => {
    exitReportRef.current = fn;
  }, []);

  const finish = useCallback(
    (final, info = {}) => {
      const { key, isNewBest, mistakes, runId, saving } = record(final, info, true);
      fx.sound('win');
      if (final >= 8) fx.burst(window.innerWidth / 2, window.innerHeight / 3, 48);
      // a full score: Armin jumps and cheers (in every game, Balloon Pop too); otherwise a line for the score
      if (final >= MAX_SCORE) fx.say(...cheer(final), 'jump');
      else fx.say(...cheer(final));
      setResult({ score: final, key, isNewBest, summary: info.summary, mission: info.mission, crates: info.crates, mistakes, runId, save: 'saving' });
      saving.then((save) => setResult((r) => (r?.runId === runId ? { ...r, save } : r)));
    },
    [fx, game, record]
  );

  // A queued run turns into "saved" once the outbox manages to send it.
  const queuedRunId = result?.save === 'queued' ? result.runId : null;
  useEffect(() => {
    if (!queuedRunId) return undefined;
    return onOutboxChange(() => {
      if (!pendingFor(playerId).includes(queuedRunId)) setResult((r) => (r?.runId === queuedRunId ? { ...r, save: 'saved' } : r));
    });
  }, [queuedRunId, playerId]);

  const restart = () => {
    reportExit();
    reportedRef.current = false;
    exitReportRef.current = null;
    runIdRef.current = newRunId();
    setRun((r) => r + 1);
    setScore(0);
    setResult(null);
    setScoreKey(game.keys[0]);
  };

  const ResultScreen = result ? screenFor(game, result.key) : null;

  return (
    <main className="mg-page mg-page--game">
      {gameHeader && <PageHead game={game} />}
      <MascotBar fallback={game.intro} />

      <div className="mg-game-stage">
        <HudContext.Provider value={{ score, best: bestOf(game, best) }}>
          <Game
            key={run}
            fresh={run > 0}
            runId={runIdRef.current}
            onScore={setScore}
            onFinish={finish}
            setScoreKey={setScoreKey}
            setExitReport={setExitReport}
          />
        </HudContext.Provider>
      </div>

      {ResultScreen && (
        <ResultScreen
          result={result}
          best={bestOf(game, best)}
          max={MAX_SCORE}
          saveText={onGameFinish ? SAVE_TEXT[result.save] : null}
          onRestart={restart}
        />
      )}
      {result && !ResultScreen && (
        <div className="mg-result" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="mg-result__card">
            {/* a full score: Armin jumps and cheers on the result card (the bar behind it is covered) */}
            {result.score >= MAX_SCORE && (
              <div className="mg-result__cheer">
                <Armin mood="wow" act="jump" className="mg-result__mascot" />
                <p>Perfect score! 🎉</p>
              </div>
            )}
            {result.isNewBest && <span className="mg-badge">🏆 New best!</span>}
            <h2 id="result-title">
              {game.title}
              {game.modeLabels ? ` · ${game.modeLabels[result.key]}` : ''}
            </h2>
            <p className="mg-result__score">
              {result.score}
              <small> / {MAX_SCORE}</small>
            </p>
            <p className="mg-result__best">
              Best this session: <strong>{bestOf(game, best)} / {MAX_SCORE}</strong>
            </p>
            {onGameFinish && (
              <p className={`mg-save mg-save--${result.save}`} role="status">
                {SAVE_TEXT[result.save]}
              </p>
            )}

            {result.mistakes.length > 0 && (
              <details className="mg-review" open={result.mistakes.length <= 3}>
                <summary>📖 Review your mistakes ({result.mistakes.length})</summary>
                <ul>
                  {result.mistakes.map((m, k) => (
                    <li key={k}>
                      <p className="mg-review__q">{m.prompt}</p>
                      <p className="mg-review__a">
                        <span className="mg-review__bad">✗ {m.yours}</span>
                        <span className="mg-review__good">✓ {m.answer}</span>
                      </p>
                      {m.why && <p className="mg-review__why">{m.why}</p>}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mg-result__actions">
              <button type="button" className="mg-btn mg-btn--primary" onClick={restart} autoFocus>
                ↻ Play again
              </button>
              <Link to=".." className="mg-btn mg-btn--secondary">
                Back to games
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
