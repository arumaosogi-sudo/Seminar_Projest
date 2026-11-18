import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useGamesConfig } from './config.js';

// Best scores (out of 10) per score key. Two sources, the higher one counts:
//  - savedBest from the host (the student's runs saved in its database, GAME-7), so the games page shows the same
//    best as the instructor sees, also in a new tab or on another device;
//  - this browser session (runs played in this tab), so a new best shows at once, before the host reloads its data.
// The session copy is kept per player, so a shared classroom computer never shows one student's best to the next.
const KEY = 'muscle-games:session';
const ScoresContext = createContext(null);

const storageKey = (playerId) => (playerId ? `${KEY}:${playerId}` : KEY);

function load(playerId) {
  try {
    const data = JSON.parse(sessionStorage.getItem(storageKey(playerId)));
    // Bests above 10 come from the old points system and are dropped.
    return { best: Object.fromEntries(Object.entries(data?.best || {}).filter(([, v]) => v <= 10)) };
  } catch {
    return { best: {} };
  }
}

/** The higher of the two sources for every key either one has. */
function merge(saved, session) {
  const out = { ...session };
  for (const [k, v] of Object.entries(saved || {})) {
    if (typeof v === 'number' && v <= 10 && (out[k] === undefined || v > out[k])) out[k] = v;
  }
  return out;
}

export function ScoresProvider({ children }) {
  const { savedBest, playerId } = useGamesConfig();
  const [state, setState] = useState(() => load(playerId));
  const ref = useRef(state);
  const best = useMemo(() => merge(savedBest, state.best), [savedBest, state.best]);
  const bestRef = useRef(best);
  bestRef.current = best;

  const save = (next) => {
    ref.current = next;
    setState(next);
    try {
      sessionStorage.setItem(storageKey(playerId), JSON.stringify(next));
    } catch {
      /* storage unavailable: keep in memory */
    }
  };

  // Records a finished run under a score key; returns true when it beats the best so far (saved or this session).
  const submit = useCallback(
    (key, score) => {
      const prev = bestRef.current[key];
      const sessionPrev = ref.current.best[key];
      if (sessionPrev === undefined || score > sessionPrev) save({ ...ref.current, best: { ...ref.current.best, [key]: score } });
      return prev === undefined || score > prev;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerId]
  );

  return <ScoresContext.Provider value={{ best, submit }}>{children}</ScoresContext.Provider>;
}

export const useScores = () => useContext(ScoresContext);
