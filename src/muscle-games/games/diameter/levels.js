// OL3 — structural organization of skeletal muscle, as one zoom from the whole muscle to the myofilaments.
// Every picture is rendered from the main site's 3D models (public/models/*.glb, the /explore zoom chain): a grey
// render of the whole model, and each part on its own, in colour, from the same camera, showing only the pixels of
// that part that are visible in the model (made with scripts/diameter-art). Clues use the wording of the 3D model's info panels
// (src/content/exploreZoom.ts in the main site, which follows the lecture sheet). `see`: a see-through wrapping
// layer, shown at that opacity once placed (as in the 3D viewer), so the parts it wraps stay visible. `one`: the part is
// a few thin bits spread over the model (Z discs, M lines, titin), so its tray picture shows just its biggest bit, large
// enough to read on a plate. `scale`: the real size, written on the drawing's dimension line.
const ART = import.meta.glob('./art/*.webp', { eager: true, query: '?url', import: 'default' });
export const art = (name) => ART[`./art/${name}.webp`];

// Pieces that do not belong in the step being built: from another muscle type, or from another level of the zoom.
export const DECOYS = {
  idisc: { art: 'decoy-idisc', name: 'Intercalated disc', why: 'it joins cardiac muscle cells, not skeletal fibers' },
  dense: { art: 'decoy-dense', name: 'Dense bodies', why: 'they anchor the thin filaments of smooth muscle' },
  perimysium: { art: 'fascicle-perimysium', name: 'Perimysium', why: 'it wraps a fascicle; you meet it one zoom level further out' },
  ttubule: { art: 'fiber-ttubule', name: 'T-tubules', why: 'they belong inside a single muscle fiber, deeper in the zoom' },
  sr: { art: 'fiber-sr', name: 'Sarco\u00adplasmic reticulum', why: 'it wraps the myofibrils of a fiber, one level further out' },
  zdisc: { art: 'sarcomere-zdisc', name: 'Z discs', why: 'they cap the ends of a sarcomere, one zoom level further out' },
};

export const STEPS = [
  {
    id: 'muscle',
    title: 'Whole muscle',
    say: 'Step 1: the whole muscle. Build the arm from its parts!',
    parts: [
      { id: 'biceps', name: 'Biceps brachii', clue: 'A skeletal muscle is a complex organ: muscle fibers, connective tissue, blood vessels and nerves. This one bends the elbow.' },
      { id: 'epimysium', see: 0.5, name: 'Epimysium', clue: 'The outer layer around the entire muscle — mainly dense connective tissue that helps transmit the force of contraction.' },
      { id: 'triceps', name: 'Triceps brachii', clue: 'Muscles frequently act in opposing groups: this one straightens the elbow.' },
      { id: 'bone', name: 'Humerus, radius and ulna', clue: 'Skeletal muscles produce movement by exerting force on these, across the joints.' },
    ],
    decoys: ['idisc', 'perimysium'],
    scale: 'Whole biceps ≈ 30 cm long',
    zoom: 'Zoom into the biceps: a bundle of fibers',
  },
  {
    id: 'fascicle',
    title: 'Fascicle',
    say: 'Step 2: a fascicle, a bundle of muscle fibers.',
    parts: [
      { id: 'perimysium', see: 0.5, name: 'Perimysium', clue: 'Encloses each fascicle; organises groups of fibers and gives pathways for blood vessels and nerves.' },
      { id: 'fibers', name: 'Muscle fibers', clue: 'Long, cylindrical, multinucleated cells, each wrapped by its own endomysium.' },
      { id: 'endomysium', see: 0.4, name: 'Endomysium', clue: 'A delicate layer around each muscle fiber — much thinner than the other two layers.' },
      { id: 'nerve', name: 'Motor neuron', clue: 'One of these and all the skeletal muscle fibers it controls make a motor unit.' },
      { id: 'vessel', name: 'Blood vessel', clue: 'Brings blood to the fascicle, running along the pathways the perimysium provides.' },
    ],
    decoys: ['dense', 'ttubule'],
    scale: 'One fascicle ≈ 1 mm across',
    zoom: 'Zoom into one muscle fiber',
  },
  {
    id: 'fiber',
    title: 'Muscle fiber',
    say: 'Step 3: inside one muscle fiber.',
    parts: [
      { id: 'nmj', name: 'Neuro\u00admuscular junction', clue: 'The synapse where the axon terminal releases ACh into the cleft; junctional folds beneath hold many ACh receptors.' },
      { id: 'myofibril', name: 'Myofibrils', clue: 'Long contractile structures that fill much of the sarcoplasm, made of repeating sarcomeres.' },
      { id: 'sarcolemma', name: 'Sarcolemma', clue: 'The plasma membrane of the fiber — keeps its ionic environment and conducts electrical excitation along the surface.' },
      { id: 'ttubule', name: 'T-tubules', clue: 'Inward extensions of the sarcolemma that carry the electrical excitation deep into the fiber.' },
      { id: 'sr', name: 'Sarco\u00adplasmic reticulum', clue: 'A specialised smooth endoplasmic reticulum around the myofibrils that stores Ca²⁺ and releases it in a regulated way.' },
      { id: 'cisternae', name: 'Terminal cisternae', clue: 'Enlarged regions of the SR next to the T-tubules — sites for storage and rapid release of Ca²⁺.' },
      { id: 'nuclei', name: 'Nuclei', clue: 'There are many in one fiber, and they usually lie close to the sarcolemma.' },
    ],
    decoys: ['idisc', 'perimysium'],
    scale: 'One fiber ≈ 10–100 µm across',
    zoom: 'Zoom into a myofibril',
  },
  {
    id: 'myofibril',
    title: 'Myofibril',
    say: 'Step 4: a myofibril, sarcomere after sarcomere.',
    parts: [
      { id: 'zdisc', one: true, name: 'Z discs', clue: 'Mark the boundary between neighbouring sarcomeres; thin filaments are anchored here.' },
      { id: 'thick', name: 'Thick filaments (A\u00a0band)', clue: 'Mainly myosin. Their whole length, including where they overlap thin filaments, is the dark A band.' },
      { id: 'thin', name: 'Thin filaments (I\u00a0band)', clue: 'Mainly actin. Where they lie alone, with no thick filaments, they make the light I band.' },
      { id: 'mline', one: true, name: 'M lines', clue: 'Sit at the centre of each sarcomere; their proteins organise and stabilise the thick filaments.' },
    ],
    decoys: ['dense', 'sr'],
    scale: 'One myofibril ≈ 1–2 µm across',
    zoom: 'Zoom into one sarcomere',
  },
  {
    id: 'sarcomere',
    title: 'Sarcomere',
    say: 'Step 5: one sarcomere, Z disc to Z disc.',
    parts: [
      { id: 'zdisc', one: true, name: 'Z discs', clue: 'One sarcomere runs from one of these to the next; during contraction they move closer together.' },
      { id: 'thick', name: 'Thick filament (myosin)', clue: 'A motor protein that turns ATP into mechanical work; its globular heads project outward and bind actin.' },
      { id: 'thin', name: 'Thin filaments (actin)', clue: 'G-actin joins into helical strands of F-actin; each actin has a site where a myosin head can bind.' },
      { id: 'mline', name: 'M line', clue: 'At the centre of the sarcomere — its proteins organise and stabilise the thick filaments.' },
      { id: 'titin', one: true, name: 'Titin', clue: 'A large elastic protein that keeps the thick filaments in place and resists over-stretching.' },
    ],
    decoys: ['idisc', 'sr'],
    scale: 'One sarcomere ≈ 2.5 µm, Z disc to Z disc',
    zoom: 'Zoom into the myofilaments',
  },
  {
    // the main site's last skeletal zoom level (/models/filaments.glb): six thin filaments round one thick filament.
    // Actin and the thick filament's core are see-through, as tropomyosin and troponin lie behind them.
    id: 'filaments',
    title: 'Myofilaments',
    say: 'Step 6: the myofilaments, thick and thin.',
    parts: [
      { id: 'thick', see: 0.5, name: 'Thick filament (myosin)', clue: 'The main protein of the thick filament — its long tails point toward the centre of the sarcomere.' },
      { id: 'heads', name: 'Myosin heads (cross-bridges)', clue: 'Globular heads that bind actin and split ATP; they attach, pull the thin filament toward the centre (power stroke), detach and repeat.' },
      { id: 'actin', see: 0.5, name: 'Actin', clue: 'The main protein of the thin filament: G-actin joins into helical strands of F-actin, each with a site where a myosin head can bind.' },
      { id: 'tropomyosin', name: 'Tropomyosin', clue: 'A long, fibrous regulatory protein lying along the thin filament; in a relaxed fiber it covers the myosin-binding sites.' },
      { id: 'troponin', one: true, name: 'Troponin (TnC · TnI · TnT)', clue: 'Small complexes along the thin filament: one part binds Ca²⁺, one inhibits actin–myosin interaction, one binds tropomyosin.' },
    ],
    decoys: ['dense', 'zdisc'],
    scale: 'Thick filament ≈ 15 nm across, thin ≈ 7 nm',
  },
];

// One point per piece to place (30 in all); the score out of 10 is pieces placed / TOTAL_ANSWERS.
export const TOTAL_ANSWERS = STEPS.reduce((n, s) => n + s.parts.length, 0);
