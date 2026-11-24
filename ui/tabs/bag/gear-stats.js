// The gear Stats picker: −/+ rows (the Party stat sheet's .ps-st rows) that place a piece's points on at most two stats, and the "+1 DEX · +1 AGI" line.
import { h } from '../../kit/dom.js';
import { GEAR, defaultStat, statsOf } from '../../../modules/inventory/gear.js';

// The stats a piece may raise (the Party sheet's order, WIS before Charisma); a piece saved with LUK is read as WIS before it gets here (gear's gearStatKey).
const ROWS = ['STR', 'DEX', 'AGI', 'VIT', 'INT', 'WIS', 'CHA'];
const NAME = { STR: 'Strength', DEX: 'Dexterity', AGI: 'Agility', VIT: 'Vitality', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };
// The sheet's full words for the labels a module may show (a module's own name for the sixth stat); a name this list lacks shows no small word.
const FULL = { STR: 'Strength', VIT: 'Vitality', AGI: 'Agility', DEX: 'Dexterity', INT: 'Intelligence', WIS: 'Wisdom', LUK: 'Luck', CHA: 'Charisma' };
const labelOf = (labels, key) => (Array.isArray(labels) ? labels[GEAR.stats.indexOf(key)] : null) || key;
const customOf = labels => Array.isArray(labels) && labels.some((name, at) => name !== GEAR.stats[at]);

const clean = stats => Object.fromEntries(Object.entries(statsOf(stats)).sort(([a], [b]) => ROWS.indexOf(a) - ROWS.indexOf(b)));
const total = stats => Object.values(stats).reduce((sum, n) => sum + n, 0);

/** "+1 DEX · +1 AGI" for a piece's stats ('' for none), in the Party sheet's order. */
export const statsLine = (stats, labels = null) => Object.entries(clean(stats)).map(([k, n]) => `+${n} ${labelOf(labels, k)}`).join(' · ');

/** The pick a reader who touches nothing gets: the whole budget on the stat the name or slot suggests (the engine's defaultStat); {} with no slot or no budget. */
export function defaultPick(name, slot, budget) {
  const stat = slot && budget > 0 ? defaultStat(String(name ?? ''), slot) : null;
  return stat ? { [stat]: budget } : {};
}

/**
 * Builds the picker for `budget` points starting from `stats`: + is off once all points are placed or two stats already hold points; − is off at 0.
 * Returns { el, value(), full(), reset(budget, stats), touched() }; `onChange(value)` runs after each step.
 */
export function statsPicker({ budget = 0, stats = {}, labels = null, onChange } = {}) {
  let max = budget;
  let staged = clean(stats);
  let touched = false;
  const list = h('div', { class: 'gst-rows' });
  const count = h('p', { class: 'fine gst-n', 'aria-live': 'polite' });
  const el = h('div', { class: 'gst', dataset: { picker: 'stats' } }, list, count);
  const step = (k, sign) => () => {
    const n = staged[k] ?? 0;
    if (sign > 0 && canRaise(k)) staged = { ...staged, [k]: n + 1 };
    if (sign < 0 && n > 0) { const next = { ...staged, [k]: n - 1 }; staged = clean(next); }
    touched = true;
    draw();
    onChange?.(clean(staged));
  };
  function canRaise(k) {
    const used = Object.keys(staged);
    return total(staged) < max && (used.includes(k) || used.length < GEAR.maxStats);
  }
  function draw() {
    list.replaceChildren(...ROWS.map(k => h('div', { class: 'ps-st', dataset: { stat: k } },
      h('span', null, h('b', null, labelOf(labels, k)), h('small', null, customOf(labels) ? FULL[labelOf(labels, k).toUpperCase()] ?? '' : NAME[k])),
      h('span', { class: ['v', staged[k] ? 'up' : null] }, staged[k] ? `+${staged[k]}` : '0'),
      h('button', { type: 'button', class: 'ps-b', dataset: { minus: k }, 'aria-label': `Lower ${labelOf(labels, k)}`, disabled: !staged[k], onClick: step(k, -1) }, '−'),
      h('button', { type: 'button', class: 'ps-b', dataset: { plus: k }, 'aria-label': `Raise ${labelOf(labels, k)}`, disabled: !canRaise(k), onClick: step(k, 1) }, '+'))));
    count.textContent = max > 0 ? `${total(staged)} of ${max} point${max === 1 ? '' : 's'} · at most ${GEAR.maxStats} stats` : 'No points to place';
  }
  draw();
  return {
    el,
    value: () => clean(staged),
    full: () => total(staged) === max,
    touched: () => touched,
    reset(nextBudget, nextStats) {
      max = nextBudget;
      staged = clean(nextStats);
      touched = false;
      draw();
    },
  };
}
