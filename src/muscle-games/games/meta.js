export const GAMES = [
  {
    id: 'balloon-pop',
    title: 'Balloon Pop',
    goal: 'Zap the balloon that matches each muscle function or property.',
    lo: 'OL1',
    loText: 'Explain the major functions and physiological properties of muscular tissue',
    minutes: '3–4 min',
    keys: ['balloon-pop'],
    resultStyle: 'poster', // end screen: a WANTED poster stamped MISSION COMPLETE (components/PosterResult.jsx)
    intro: 'Tap the balloon that matches the clue and the wizard zaps it! Each right answer = 1 point. Pop a fire orb 🔥 to burn away a wrong balloon!',
  },
  {
    id: 'group-sort',
    title: 'Group Sort',
    goal: 'Sort muscle facts by picture or on a conveyor belt: the three muscle types, then the layers inside skeletal muscle.',
    lo: 'OL2',
    loText: 'Differentiate the gross and microscopic characteristics of skeletal, cardiac and smooth muscle',
    minutes: '3 min',
    keys: ['group-sort:memory', 'group-sort:conveyor'],
    // end screens (components/StyledResults.jsx): a case report for Picture Match, a delivery manifest for Conveyor
    resultStyle: { 'group-sort:memory': 'casefile', 'group-sort:conveyor': 'manifest' },
    modeLabels: { 'group-sort:memory': 'Picture Match', 'group-sort:conveyor': 'Conveyor' },
    intro: 'Pick a mode: Picture Match or Conveyor Sort?',
  },
  {
    id: 'diameter',
    title: 'Diameter',
    goal: 'Build a muscle from its 3D parts and zoom in, from the whole muscle to the myofilaments.',
    lo: 'OL3',
    loText: 'Explain the structural organization of skeletal muscle from the whole muscle to the molecular level',
    minutes: '5 min',
    keys: ['diameter'],
    resultStyle: 'drawing', // end screen: an engineering drawing sheet (components/StyledResults.jsx)
    intro: 'Read each clue, find the right piece and fit it onto the 3D model, then zoom in! 🔬 You have 3 hearts: a wrong piece costs one.',
  },
];

// Every game is scored out of 10 from the share of answers that were right (the course's collected score).
export const MAX_SCORE = 10;
export const scoreOutOf10 = (right, total) => (total > 0 ? Math.round((100 * right) / total) / 10 : 0);
// A game's best is its best run in any mode (Group Sort has two).
export const bestOf = (game, best) => {
  const scores = game.keys.map((k) => best[k]).filter((v) => v !== undefined);
  return scores.length ? Math.max(...scores) : undefined;
};

export const gameById = (id) => GAMES.find((g) => g.id === id);
