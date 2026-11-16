// Gear form: the choice lists (kind, rarity, slot, stat) of its select fields.

import { STRINGS } from '../../../../core/strings.js';
import { GEAR } from '../../../../packages/story-block/src/v2/domains/gear.js';
import { FORM_KINDS } from './shared-limits.js';

const F = STRINGS.inventory.gear.form;
const G = STRINGS.inventory.gear;
const N = STRINGS.inventory;

export const kindOptions = () => FORM_KINDS.map(value => ({ value, label: F.kinds[value] }));
export const rarityOptions = () => Object.keys(GEAR.budget).map(value => ({ value, label: N.rarities[value] }));
export const slotOptions = () => [{ value: '', label: G.none }, ...Object.entries(G.slots).map(([value, label]) => ({ value, label }))];
export const statOptions = () => [{ value: '', label: F.noStat }, ...GEAR.stats.map(value => ({ value, label: value }))];
