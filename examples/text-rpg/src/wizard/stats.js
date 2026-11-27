// Adapted from ui/wizard/stats.js (keep in step when that file changes). The wizard's Stats step for Text RPG, the RPG's: the Party stat sheet's rows (name, value, − and +) under the note, then Points left and Reset.
// Every stat starts at 5, the reader spends 10 points and a stat goes up to 10 (a saved character spends its own points from its own stats). Create is held until all of them are placed.
import { h } from '../kit/dom.js';
import { STAT_KEYS } from '../words/stats.js';
import { levelOf, startOf } from './limits.js';
import { extraOf, pointsLeft, poolOf, statBounds } from './points.js';
import { RULES, STAT_NAME } from './rules.js';
import { W, fill } from './words.js';

/** Draws the Stats step for the wizard session `ctx` ({ run, put, redraw }). */
export function drawStats(ctx) {
  const { run } = ctx;
  const stats = run.draft.stats;
  const left = pointsLeft(run.draft);
  const step = (stat, by) => () => {
    const [low, high] = statBounds(run.draft, stat);
    const next = run.draft.stats[stat] + by;
    if (next < low || next > high || (by > 0 && pointsLeft(run.draft) <= 0)) return;
    ctx.put({ ...run.draft, stats: { ...run.draft.stats, [stat]: next } });
    ctx.redraw();
  };
  const rows = STAT_KEYS.map(stat => {
    const value = stats[stat], key = stat.toUpperCase(), [low, high] = statBounds(run.draft, stat);
    return h('div', { class: 'ps-st', dataset: { stat } },
      h('span', null, h('b', null, key), h('small', null, STAT_NAME[stat])),
      h('span', { class: ['v', value > startOf(run.draft, stat) ? 'up' : null] }, value),
      h('button', { type: 'button', class: 'ps-b', dataset: { minus: stat }, 'aria-label': `Lower ${key}`, disabled: value <= low, onClick: step(stat, -1) }, '−'),
      h('button', { type: 'button', class: 'ps-b', dataset: { plus: stat }, 'aria-label': `Raise ${key}`, disabled: value >= high || left <= 0, onClick: step(stat, 1) }, '+'));
  });
  return h('div', { class: 'wz-stats' },
    h('p', { class: 'ps-p', dataset: { wiz: 'stats-note' } }, run.draft.from ? fill(W.statsNoteImport, { n: poolOf(run.draft), min: RULES.min, max: RULES.max }) : [fill(W.statsNote, { start: RULES.min, budget: RULES.points, max: RULES.max }), extraOf(run.draft) > 0 ? fill(W.statsNoteLevel, { level: levelOf(run.draft), extra: extraOf(run.draft) }) : ''].filter(Boolean).join(' ')),
    h('div', { class: 'wz-rows' }, rows),
    h('div', { class: 'wz-left' },
      h('span', { class: 'chip2 wz-left-pill' }, fill(W.pointsLeft, { n: left })),
      h('button', { type: 'button', class: 'ps-b', dataset: { wiz: 'reset' }, onClick: () => { ctx.put({ ...run.draft, stats: Object.fromEntries(STAT_KEYS.map(stat => [stat, startOf(run.draft, stat)])) }); ctx.redraw(); } }, W.statsReset)));
}
