// The Bag "+ Add" form's gear fields (Gear in fights on, Kind = Equipment): Slot, Rarity (the starting kit's only) and the Stats picker, and what Add sends.
import { h } from '../../kit/dom.js';
import { GEAR, gearSlotOf } from '../../../modules/inventory/gear.js';
import { STRINGS } from '../../../core/strings.js';
import { statsPicker, defaultPick } from './gear-stats.js';

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const cap = text => text[0].toUpperCase() + text.slice(1);
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const field = (label, control) => h('label', { class: 'ef' }, label, control);

/** The slot a piece goes to: the reader's pick, else the one its name suggests (null: none). */
export const slotFor = (name, slot) => slot || gearSlotOf(null, String(name ?? '')) || null;

/**
 * What Add sends for a piece of equipment: `add` joins the inventory.add payload (slot; rarity and stats only while the starting kit is open), `repoint` the stats
 * to move onto the new piece after it (the kit is closed, so the add cannot carry them: the engine's repoint edit does), or `error` for a pick not all placed.
 * An untouched pick, or one equal to the default, sends no stats: the engine gives the default itself (today's result).
 */
export function gearAddPlan({ kit = false, name = '', slot = '', rarity = 'common', pick = {}, touched = false } = {}) {
  const shown = kit ? rarity : 'common';
  const budget = GEAR.budget[shown] ?? 0;
  const add = { ...(slot ? { slot } : {}), ...(kit && shown !== 'common' ? { rarity: shown } : {}) };
  const own = touched && !same(pick, defaultPick(name, slotFor(name, slot), budget));
  if (!own) return { add, repoint: null };
  const placed = Object.values(pick).reduce((sum, n) => sum + n, 0);
  if (placed !== budget) return { error: `Place all ${budget} point${budget === 1 ? '' : 's'}: ${placed} placed.` };
  return kit ? { add: { ...add, stats: pick }, repoint: null } : { add, repoint: pick };
}

/** Builds the Slot, Rarity and Stats fields; `nameOf()` reads the typed name. Returns { el, plan(), refresh() } (refresh: the name changed). */
export function gearAddFields({ kit = false, nameOf = () => '' } = {}) {
  const slot = h('select', { 'aria-label': 'Slot' }, [h('option', { value: '' }, 'From the name'), ...GEAR.slots.map(s => h('option', { value: s }, cap(s)))]);
  slot.value = '';
  const rarity = kit
    ? h('select', { 'aria-label': 'Rarity' }, RARITIES.map(r => h('option', { value: r }, cap(r))))
    : h('span', { class: 'gst-fixed', dataset: { rarity: 'fixed' } }, 'Common');
  if (kit) rarity.value = 'common';
  const budget = () => GEAR.budget[kit ? rarity.value : 'common'] ?? 0;
  const fallback = () => defaultPick(nameOf(), slotFor(nameOf(), slot.value), budget());
  const picker = statsPicker({ budget: budget(), stats: fallback() });
  // (a name or slot change moves an untouched pick to the new default; a rarity change starts the pick again on the new budget)
  const refresh = force => { if (force || !picker.touched()) picker.reset(budget(), fallback()); };
  slot.addEventListener('change', () => refresh(false));
  if (kit) rarity.addEventListener('change', () => refresh(true));
  const el = h('div', { class: 'gst-add', dataset: { gear: 'add' } },
    field('Slot', slot),
    field('Rarity', rarity),
    kit ? null : h('p', { class: 'fine', dataset: { why: 'rarity' } }, STRINGS.editMessages.kitClosed),
    h('div', { class: 'ef' }, 'Stats', picker.el));
  return {
    el,
    refresh: () => refresh(false),
    plan: () => gearAddPlan({ kit, name: nameOf(), slot: slot.value, rarity: kit ? rarity.value : 'common', pick: picker.value(), touched: picker.touched() }),
  };
}
