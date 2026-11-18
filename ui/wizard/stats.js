// The wizard's Stats step in the new view: the Party stat sheet's rows (name, value, − and +; mock v7 .ps-st) under the creation budget, Reset,
// the old step's notes, and the HP · MP · SP line that follows the stats. The bounds and the points left are wizard-data's (statBounds, pointsLeft).

import { h } from '../kit/dom.js';
import { STATS_V1 as STATS } from '../../modules/rpg/names.js';
import { RPG_STRINGS, fill } from '../../modules/rpg/strings.js';
import { barsLine, draftCreation, pointsLeft, readDraft, startStats, statBounds } from '../../modules/rpg/view/wizard-data.js';

const W = RPG_STRINGS.wizard;
const LEVEL_WORD = 'Level';
const STAT_NAME = { str: 'Strength', vit: 'Vitality', agi: 'Agility', dex: 'Dexterity', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const safe = (fn, fallback) => { try { return fn() ?? fallback; } catch { return fallback; } };

/** The notes under the rows: the budget sentence (an imported character's own), and "From the pack: …" when the pack sets the numbers. */
function notes(now, world) {
  const creation = draftCreation(now), standard = creation.standard === true;
  const flat = !(creation.min < creation.start);
  const words = { ...creation, label: LEVEL_WORD, floor: flat ? W.statsFloor : '', range: fill(flat ? W.statsRangeUp : W.statsRangeDown, creation) };
  const text = now.from ? fill(standard ? W.statsNoteImportStandard : W.statsNoteImport, { ...words, n: now.from.points }) : fill(standard ? W.statsNoteStandard : W.statsNote, words);
  const pack = standard ? safe(world.packNote, '') : '';
  return [h('p', { class: 'ps-p', dataset: { wiz: 'stats-note' } }, text), pack ? h('p', { class: 'ps-p', dataset: { wiz: 'pack' } }, fill(RPG_STRINGS.settings.fromPack, { name: pack })) : null];
}

/** Draws the Stats step for the wizard session `ctx` ({ run, world, put, summary, redraw }). */
export function drawStats(ctx) {
  const { run, world } = ctx;
  const now = readDraft(run.draft);
  const left = pointsLeft(now);
  const startOf = stat => (now.from ? now.from.stats[stat] : draftCreation(now).start);
  const step = (stat, by) => () => {
    const snap = readDraft(run.draft);
    const [min, max] = statBounds(snap, stat);
    const next = snap.stats[stat] + by;
    if (next < min || next > max || (by > 0 && pointsLeft(snap) <= 0)) return;
    ctx.put({ ...run.draft, stats: { ...snap.stats, [stat]: next } });
    ctx.redraw();
  };
  const rows = STATS.map(stat => {
    const [min, max] = statBounds(now, stat), value = now.stats[stat], key = stat.toUpperCase();
    return h('div', { class: 'ps-st', dataset: { stat } },
      h('span', null, h('b', null, key), h('small', null, STAT_NAME[stat])),
      h('span', { class: ['v', value > startOf(stat) ? 'up' : null] }, value),
      h('button', { type: 'button', class: 'ps-b', dataset: { minus: stat }, 'aria-label': `Lower ${key}`, disabled: value <= min, onClick: step(stat, -1) }, '−'),
      h('button', { type: 'button', class: 'ps-b', dataset: { plus: stat }, 'aria-label': `Raise ${key}`, disabled: value >= max || left <= 0, onClick: step(stat, 1) }, '+'));
  });
  const standard = draftCreation(now).standard === true;
  return h('div', { class: 'wz-stats' },
    h('div', { class: 'wz-rows' }, rows),
    h('div', { class: 'ps-row wz-left' },
      h('button', { type: 'button', class: 'ps-b', dataset: { wiz: 'reset' }, onClick: () => { ctx.put({ ...run.draft, stats: startStats(readDraft(run.draft)) }); ctx.redraw(); } }, W.statsReset)),
    notes(now, world),
    standard ? h('p', { class: 'ps-p wz-growth', dataset: { wiz: 'growth' } }, barsLine(now)) : null);
}
