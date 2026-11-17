import { createElement } from 'react';

// The pictures are 2D renders of the main site's 3D models (scripts/diameter-art: sort.json + sort-cards.py).
const PICS = import.meta.glob('./art/*.webp', { eager: true, query: '?url', import: 'default' });
// the URL of one picture, for the mode covers
export const picUrl = (id) => PICS[`./art/${id}.webp`];
const pic = (id, alt) => () => createElement('img', { className: 'mg-pic', src: PICS[`./art/${id}.webp`], alt, draggable: false });

// Both Group Sort modes play the same two stages, taken from the main site's lessons. Stage 1 sorts facts into the
// three muscle types (4 each); stage 2 into the six levels of skeletal muscle, whole muscle to myofilaments (2 each).
// Picture Match ties each fact to its picture, Conveyor Sort packs each fact's crate into its group.
export const STAGES = [
  {
    id: 'types',
    title: 'Three types of muscle',
    lesson: 'Cardiac and smooth muscle tissue',
    groups: [
      { id: 'skeletal', label: 'Skeletal', Art: pic('skeletal', 'Skeletal muscle of the arm, on the bones') },
      { id: 'cardiac', label: 'Cardiac', Art: pic('cardiac', 'Branched cardiac muscle cells joined end to end') },
      { id: 'smooth', label: 'Smooth', Art: pic('smooth', 'A spindle-shaped smooth muscle cell') },
    ],
    facts: [
      { answer: 'skeletal', text: 'Many nuclei at the edge of the cell', why: 'Skeletal fibers have multiple, peripheral nuclei.' },
      { answer: 'skeletal', text: 'Generally under voluntary control', why: 'Only skeletal muscle is generally voluntary.' },
      { answer: 'skeletal', text: 'Attached to the skeleton for movement and posture', why: 'Skeletal muscle pulls on the skeleton.' },
      { answer: 'skeletal', text: 'Long, cylindrical cells', why: 'Skeletal muscle cells are long cylinders.' },
      { answer: 'cardiac', text: 'Cells joined by intercalated discs', why: 'Intercalated discs join cardiac cells end to end.' },
      { answer: 'cardiac', text: 'Short, branched cells, one central nucleus', why: 'Cardiac cells branch and usually have one central nucleus.' },
      { answer: 'cardiac', text: 'Striated but involuntary', why: 'Cardiac muscle has sarcomeres (striated) yet is involuntary.' },
      { answer: 'cardiac', text: 'Forms the heart wall and pumps blood', why: 'Cardiac muscle forms the muscular wall of the heart.' },
      { answer: 'smooth', text: 'Spindle-shaped cells, no striations', why: 'Smooth muscle has no organized sarcomeres, so it is not striated.' },
      { answer: 'smooth', text: 'Calmodulin, not troponin, senses Ca²⁺', why: 'Smooth muscle uses calmodulin instead of troponin.' },
      { answer: 'smooth', text: 'Walls of hollow organs and blood vessels', why: 'Gut, bladder, uterus and vessels contain smooth muscle.' },
      { answer: 'smooth', text: 'No T-tubules; has caveolae', why: 'Smooth muscle lacks T-tubules; caveolae help with Ca²⁺ handling.' },
    ],
  },
  {
    id: 'levels',
    title: 'Inside skeletal muscle',
    lesson: 'Skeletal muscle tissue and the muscle fiber · Myofilaments and the sarcomere',
    groups: [
      { id: 'muscle', label: 'Whole muscle', Art: pic('muscle', 'The biceps on its own, with its tendons') },
      { id: 'fascicle', label: 'Fascicle', Art: pic('fascicle', 'A fascicle: a bundle of muscle fibers') },
      { id: 'fiber', label: 'Muscle fiber', Art: pic('fiber', 'One muscle fiber') },
      { id: 'myofibril', label: 'Myofibril', Art: pic('myofibril', 'A myofibril') },
      { id: 'sarcomere', label: 'Sarcomere', Art: pic('sarcomere', 'One sarcomere') },
      { id: 'filaments', label: 'Actin + myosin', Art: pic('filaments', 'Actin and myosin filaments') },
    ],
    facts: [
      { answer: 'muscle', text: 'Wrapped by the epimysium', why: 'The epimysium surrounds the entire muscle.' },
      { answer: 'muscle', text: 'An organ: fibers plus connective tissue, vessels and nerves', why: 'A skeletal muscle is an organ, not just muscle cells.' },
      { answer: 'fascicle', text: 'Wrapped by the perimysium', why: 'Each fascicle is enclosed by the perimysium.' },
      { answer: 'fascicle', text: 'A bundle of muscle fibers', why: 'Muscle fibers are grouped into bundles called fascicles.' },
      { answer: 'fiber', text: 'Wrapped by the endomysium', why: 'The endomysium is a delicate layer around each muscle fiber.' },
      { answer: 'fiber', text: 'One cell with T-tubules and a sarcoplasmic reticulum', why: 'A fiber is one multinucleated cell; T-tubules and the SR lie inside it.' },
      { answer: 'myofibril', text: 'A rod of repeating sarcomeres', why: 'Myofibrils are made of repeating sarcomeres.' },
      { answer: 'myofibril', text: 'Long contractile rods that fill the sarcoplasm', why: 'Myofibrils fill much of the sarcoplasm of the fiber.' },
      { answer: 'sarcomere', text: 'From one Z disc to the next Z disc', why: 'One sarcomere extends from one Z disc to the next.' },
      { answer: 'sarcomere', text: 'The basic unit of force generation', why: 'The sarcomere is the basic functional unit of striated muscle.' },
      { answer: 'filaments', text: 'Thick = myosin, thin = actin', why: 'Thick filaments are mainly myosin; thin filaments are mainly actin.' },
      { answer: 'filaments', text: 'Tropomyosin and troponin sit on the thin filament', why: 'The thin filament carries the regulatory proteins tropomyosin and troponin.' },
    ],
  },
];

export const TOTAL_FACTS = STAGES.reduce((n, st) => n + st.facts.length, 0);
export const groupOf = (stage, id) => stage.groups.find((g) => g.id === id);
