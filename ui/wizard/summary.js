// The wizard's summary of the character so far, kept for the step's life (typing redraws it in place, so the field keeps its focus). One set of
// nodes serves both layouts: on a phone the row (44 px tile, name, the points or skills pill, the stats and skills lines); from 1100 px
// (wizard.css) the left column's card (the persona's portrait or the initial, the seven stats as tiles, raised ones green, the skills as a list).

import { h } from '../kit/dom.js';
import { isSafePortraitUrl } from '../kit/safe-url.js';
import { skillLine } from '../../modules/rpg/charfile.js';
import { STATS_V1 as STATS } from '../../modules/rpg/names.js';
import { RPG_STRINGS, fill } from '../../modules/rpg/strings.js';
import { draftCreation, draftSlots, pointsLeft, readDraft, statsLine } from '../../modules/rpg/view/wizard-data.js';

const W = RPG_STRINGS.wizard;
// (after "You · Lv 4" on the desktop card once a saved character is imported: the mock's wiz-who-import frame)
const IMPORTED = ' · imported';
const safe = (fn, fallback) => { try { return fn() ?? fallback; } catch { return fallback; } };

// The tile: the persona's picture for a You with a name (the card shows it from 1100 px), else the initial, or "?" before a name.
function avatar(now, world) {
  const pic = now.kind === 'you' && now.name ? safe(() => world?.portrait?.(), null) : null;
  const ok = isSafePortraitUrl(pic);
  return h('span', { class: ['wz-ava', ok ? 'wz-pic' : null], 'aria-hidden': 'true', style: ok ? { '--wz-pic': `url("${pic}")` } : null }, [...now.name][0]?.toUpperCase() ?? '?');
}

// A stat is green once it is above where it started (the creation start, or an imported file's own number).
const tiles = now => {
  const startOf = stat => (now.from ? now.from.stats?.[stat] : draftCreation(now).start);
  return h('div', { class: 'wz-tiles' }, STATS.map(stat => h('span', { class: now.stats[stat] > startOf(stat) ? 'hi' : null }, stat.toUpperCase(), h('b', null, String(now.stats[stat])))));
};

/** Fills `row` (the summary <section>) with the wizard session `run`'s character so far; `world` gives the persona's portrait. → `row`. */
export function fillSummary(row, run, world = null) {
  const now = readDraft(run.draft);
  const names = now.skills.filter(skill => skill.name).map(skill => (Number.isSafeInteger(skill.rank) ? skillLine({ name: skill.name, rank: skill.rank }) : skill.name));
  const count = now.skills.length;
  const pill = run.step === 'who' || run.step === 'stats' ? fill(W.pointsLeft, { n: pointsLeft(now) }) : fill(count === 1 ? W.skillCountOne : W.skillCount, { n: count, max: draftSlots(now) });
  row.replaceChildren(
    avatar(now, world),
    h('div', { class: 'wz-k wz-who' }, h('b', null, now.name || W.title), h('small', null, `${now.kind === 'you' ? W.you : W.companion} · ${fill(W.soulFrom, { level: now.level ?? 1 })}`,
      run.imported ? h('span', { class: 'wz-imp-tag' }, IMPORTED) : null)),
    h('span', { class: 'chip2 wz-pill', role: 'status' }, pill),
    h('div', { class: 'wz-k' }, h('small', null, W.statsHead), h('span', null, statsLine(now)), tiles(now)),
    h('div', { class: 'wz-k' }, h('small', null, W.skillsHead), h('span', null, names.join(', ') || W.noSkills),
      names.length ? h('ul', { class: 'wz-sk' }, names.map(name => h('li', null, name))) : h('i', { class: 'wz-sk' }, W.noSkills)));
  return row;
}
