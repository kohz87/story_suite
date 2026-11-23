// Adapted from ui/wizard/summary.js (keep in step when that file changes). The wizard's summary of the character so far, kept for the step's life (typing redraws it in place, so a field keeps
// its focus): the initial's tile, the name, the points or skills pill, the stats as a line and as tiles (raised ones green) and the skills. (The reader's portrait is not read here.)
import { h } from '../kit/dom.js';
import { STAT_KEYS } from '../words/stats.js';
import { pointsLeft } from './draft.js';
import { RULES } from './rules.js';
import { W, fill, statsLine } from './words.js';

const tiles = stats => h('div', { class: 'wz-tiles' }, STAT_KEYS.map(stat => h('span', { class: stats[stat] > RULES.start[stat] ? 'hi' : null }, stat.toUpperCase(), h('b', null, String(stats[stat])))));

/** Fills `row` (the summary <section>) with the wizard session `run`'s character so far. → `row`. */
export function fillSummary(row, run) {
  const { draft } = run;
  const names = draft.skills.map(skill => skill.name).filter(Boolean);
  const count = draft.skills.length;
  const pill = run.step === 'who' || run.step === 'stats' ? fill(W.pointsLeft, { n: pointsLeft(draft) }) : fill(count === 1 ? W.skillCountOne : W.skillCount, { n: count, max: RULES.skills });
  row.replaceChildren(
    h('span', { class: 'wz-ava', 'aria-hidden': 'true' }, [...draft.name][0]?.toUpperCase() ?? '?'),
    h('div', { class: 'wz-k wz-who' }, h('b', null, draft.name || W.title), h('small', null, W.you)),
    h('span', { class: 'chip2 wz-pill', role: 'status' }, pill),
    h('div', { class: 'wz-k' }, h('small', null, W.statsHead), h('span', null, statsLine(draft.stats)), tiles(draft.stats)),
    h('div', { class: 'wz-k' }, h('small', null, W.skillsHead), h('span', null, names.join(', ') || W.noSkills),
      names.length ? h('ul', { class: 'wz-sk' }, names.map(name => h('li', null, name))) : h('i', { class: 'wz-sk' }, W.noSkills)));
  return row;
}
