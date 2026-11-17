import { createContext, useCallback, useContext, useRef, useState } from 'react';

// Best scores (out of 10) for this browser session only; the host saves every run to its database (GAME-7).
const KEY = 'muscle-games:session';
const ScoresContext = createContext(null);

function load() {
  try {
    const data = JSON.parse(sessionStorage.getItem(KEY));
    // Bests above 10 come from the old points system and are dropped.
    return { best: Object.fromEntries(Object.entries(data?.best || {}).filter(([, v]) => v <= 10)) };
  } catch {
    return { best: {} };
  }
}

export function ScoresProvider({ children }) {
  const [state, setState] = useState(load);
  const ref = useRef(state);

  const save = (next) => {
    ref.current = next;
    setState(next);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: keep in memory */
    }
  };

  // Records a finished run under a score key; returns true when it beats the session best.
  const submit = useCallback((key, score) => {
    const prev = ref.current.best[key];
    if (prev !== undefined && score <= prev) return false;
    save({ ...ref.current, best: { ...ref.current.best, [key]: score } });
    return true;
  }, []);

  return (
    <ScoresContext.Provider value={{ best: state.best, submit }}>{children}</ScoresContext.Provider>
  );
}

export const useScores = () => useContext(ScoresContext);
