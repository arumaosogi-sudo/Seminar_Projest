import { Component, useEffect, useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ScoresProvider } from './scores.jsx';
import { FxProvider } from './fx/Fx.jsx';
import { GamesConfigContext } from './config.js';
import GamesHub from './GamesHub.jsx';
import GamePage from './components/GamePage.jsx';
import BalloonPop from './games/BalloonPop.jsx';
import GroupSort from './games/GroupSort.jsx';
import Diameter from './games/diameter/Diameter.jsx';
import { gameById } from './games/meta.js';
import { flush, pendingFor } from './outbox.js';
import './styles.css';

class GameErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[MuscleGames] crashed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mg-page mg-crash" role="alert">
        <h1>Something went wrong</h1>
        <p className="mg-muted">The game couldn’t load. Try reloading the page.</p>
        <button type="button" className="mg-btn mg-btn--primary" onClick={() => window.location.reload()}>
          ↻ Reload
        </button>
      </div>
    );
  }
}

/**
 * Drop-in games module for a React Router v6 site. Mount it on a splat route:
 *   <Route path="/games/*" element={<MuscleGames onGameFinish={saveRun} />} />
 * Every link inside is relative, so any base path works.
 * hubTitle={false} drops the hub's own eyebrow + "Games" heading, for hosts that render their own page header there.
 * gameHeader={false} drops each game's page header (back link, title), for hosts that render their own on game pages too.
 * playerId identifies the signed-in student: runs that could not be saved wait in this browser (outbox.js) and are
 * sent again only while the same player is signed in.
 */
export default function MuscleGames({ onGameFinish, hubTitle = true, gameHeader = true, playerId = null, className = '' }) {
  const config = useMemo(() => ({ onGameFinish, hubTitle, gameHeader, playerId }), [onGameFinish, hubTitle, gameHeader, playerId]);

  // Retry runs that failed to save: now, when the device comes back online, and every 20 s while any are waiting.
  useEffect(() => {
    const retry = () => {
      if (pendingFor(playerId).length) flush(onGameFinish, playerId);
    };
    retry();
    window.addEventListener('online', retry);
    const timer = setInterval(retry, 20_000);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(timer);
    };
  }, [onGameFinish, playerId]);

  return (
    <div className={`mg-root ${className}`.trim()}>
      <GamesConfigContext.Provider value={config}>
        <ScoresProvider>
          <FxProvider>
            <GameErrorBoundary>
              <Routes>
                <Route index element={<GamesHub />} />
                <Route path="balloon-pop" element={<GamePage key="balloon-pop" game={gameById('balloon-pop')} Game={BalloonPop} />} />
                <Route path="group-sort" element={<GamePage key="group-sort" game={gameById('group-sort')} Game={GroupSort} />} />
                <Route path="diameter" element={<GamePage key="diameter" game={gameById('diameter')} Game={Diameter} />} />
                <Route path="*" element={<Navigate to=".." replace />} />
              </Routes>
            </GameErrorBoundary>
          </FxProvider>
        </ScoresProvider>
      </GamesConfigContext.Provider>
    </div>
  );
}
