// Builds the three Mood meters (Feeling, Energy, Control; each -3..+3, 0 in the middle) from the dossier's `moodBars`.
import { h } from '../../../kit/dom.js';

const AXES = Object.freeze([['feeling', 'Feeling'], ['energy', 'Energy'], ['control', 'Control']]);
const signed = n => (n > 0 ? `+${n}` : String(n));

/** Returns the .mood3 grid (label, bar, value per axis); a missing moodBars reads as all zero. */
export function moodMeters(bars = {}) {
  return h('div', { class: 'mood3', dataset: { moodMeters: 'on' } }, AXES.flatMap(([key, label]) => {
    const v = Math.max(-3, Math.min(3, Math.round(Number(bars?.[key]) || 0)));
    const g = (v / 3) * 100;
    return [h('span', null, label), h('i', null, h('b', { style: { left: `${g < 0 ? 50 + g / 2 : 50}%`, width: `${Math.abs(g) / 2}%` } })), h('span', { class: 'mv' }, signed(v))];
  }));
}
