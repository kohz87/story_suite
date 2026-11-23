// Adapted from ui/wizard/stats.js (keep in step when that file changes). The wizard's Stats step for Text RPG: the Party stat sheet's rows (name, value, − and +) under the note, then
// Points left and Reset. The pool is 60, a stat goes from 5 to 15, and all of it is placed at the start (lower one to raise another).
import { h } from '../kit/dom.js';
import { STAT_KEYS } from '../words/stats.js';
import { pointsLeft } from './draft.js';
import { RULES, STAT_NAME } from './rules.js';
import { W, fill } from './words.js';

/** Draws the Stats step for the wizard session `ctx` ({ run, put, redraw }). */
export function drawStats(ctx) {
  const { run } = ctx;
  const stats = run.draft.stats;
  const left = pointsLeft(run.draft);
  const step = (stat, by) => () => {
    const next = run.draft.stats[stat] + by;
    if (next < RULES.min || next > RULES.max || (by > 0 && pointsLeft(run.draft) <= 0)) return;
    ctx.put({ ...run.draft, stats: { ...run.draft.stats, [stat]: next } });
    ctx.redraw();
  };
  const rows = STAT_KEYS.map(stat => {
    const value = stats[stat], key = stat.toUpperCase();
    return h('div', { class: 'ps-st', dataset: { stat } },
      h('span', null, h('b', null, key), h('small', null, STAT_NAME[stat])),
      h('span', { class: ['v', value > RULES.start[stat] ? 'up' : null] }, value),
      h('button', { type: 'button', class: 'ps-b', dataset: { minus: stat }, 'aria-label': `Lower ${key}`, disabled: value <= RULES.min, onClick: step(stat, -1) }, '−'),
      h('button', { type: 'button', class: 'ps-b', dataset: { plus: stat }, 'aria-label': `Raise ${key}`, disabled: value >= RULES.max || left <= 0, onClick: step(stat, 1) }, '+'));
  });
  return h('div', { class: 'wz-stats' },
    h('p', { class: 'ps-p', dataset: { wiz: 'stats-note' } }, fill(W.statsNote, { budget: RULES.total, min: RULES.min, max: RULES.max })),
    h('div', { class: 'wz-rows' }, rows),
    h('div', { class: 'wz-left' },
      h('span', { class: 'chip2 wz-left-pill' }, fill(W.pointsLeft, { n: left })),
      h('button', { type: 'button', class: 'ps-b', dataset: { wiz: 'reset' }, onClick: () => { ctx.put({ ...run.draft, stats: { ...RULES.start } }); ctx.redraw(); } }, W.statsReset)));
}
