import { Link } from 'react-router-dom';
import { GAMES, MAX_SCORE, bestOf } from './games/meta.js';
import { useScores } from './scores.jsx';
import { BalloonScene, DiameterScene, GroupSortScene } from './covers.jsx';
import { Armin } from './fx/Fx.jsx';
import { useGamesConfig } from './config.js';

const SCENES = { 'balloon-pop': BalloonScene, 'group-sort': GroupSortScene, diameter: DiameterScene };

function GameCard({ g, n }) {
  const { best } = useScores();
  const Scene = SCENES[g.id];
  const top = bestOf(g, best);

  return (
    <li className="mg-game-card">
      <div className="mg-game-card__cover">
        <Scene />
      </div>
      <div className="mg-game-card__body">
        <div className="mg-game-card__titlerow">
          <h2>
            <span className="mg-game-card__num">Game {n}</span>
            {g.title}
          </h2>
        </div>
        <p className="mg-game-card__goal">{g.goal}</p>
        <div className="mg-game-card__tags">
          <span className="mg-lo-tag" title={g.loText}>
            {g.lo}
          </span>
          <span className="mg-chip">⏱ {g.minutes}</span>
          <span className="mg-chip">🎯 {MAX_SCORE} points</span>
        </div>
        <p className="mg-game-card__best">
          {top === undefined ? 'No score yet this session' : `Best this session: ${top} / ${MAX_SCORE}`}
        </p>
        <Link to={g.id} className="mg-btn mg-btn--primary mg-btn--block mg-btn--pulse" aria-label={`Play ${g.title}`}>
          ▶ Play
        </Link>
      </div>
    </li>
  );
}

export default function GamesHub() {
  const { hubTitle } = useGamesConfig();
  return (
    <main className="mg-page">
      <header className="mg-hub-hero">
        <Armin mood="happy" className="mg-hub-hero__mascot" />
        <div>
          {hubTitle && (
            <>
              <p className="mg-eyebrow">Muscular Tissues I</p>
              <h1>Games</h1>
            </>
          )}
          <p className="mg-lede">
            Hi, I’m <strong>Armin</strong>, your muscle buddy! Each game is worth 10 points and your best
            score counts. Every game is open, so play in any order.
          </p>
        </div>
      </header>

      <ul className="mg-games-grid">
        {GAMES.map((g, i) => (
          <GameCard key={g.id} g={g} n={i + 1} />
        ))}
      </ul>
    </main>
  );
}
