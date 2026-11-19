// Builds the three Mood meters (Feeling, Energy, Control; each -3..+3, 0 in the middle) from the dossier's `moodBars`, each in its own colour, and a mood change's words.
import { h } from '../../../kit/dom.js';

const AXES = Object.freeze([['feeling', 'Feeling'], ['energy', 'Energy'], ['control', 'Control']]);
const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** Returns the .mood3 grid (label, bar, value per axis); a missing moodBars reads as all zero. */
export function moodMeters(bars = {}) {
  return h('div', { class: 'mood3', dataset: { moodMeters: 'on' } }, AXES.flatMap(([key, label]) => {
    const v = Math.max(-3, Math.min(3, Math.round(Number(bars?.[key]) || 0)));
    const g = (v / 3) * 100;
    return [h('span', { class: `ax-${key}` }, label), h('i', { class: `ax-${key}` }, h('b', { style: { left: `${g < 0 ? 50 + g / 2 : 50}%`, width: `${Math.abs(g) / 2}%` } })), h('span', { class: 'mv' }, signed(v))];
  }));
}

/** A mood change's moves as coloured words ("Energy −1", "Feeling +1 · Control −1"). */
export function moodMove(moves = []) {
  return moves.flatMap((move, i) => {
    const label = AXES.find(([key]) => key === move.axis)?.[1] ?? move.axis;
    return [i ? ' · ' : null, h('b', { class: `ax-${move.axis}` }, `${label} ${signed(move.delta)}`)].filter(Boolean);
  });
}
