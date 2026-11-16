// Gear form: the "Equipped by" / "Equip on" choice of who can wear a piece.

import { STRINGS } from '../../../../../../core/strings.js';

const F = STRINGS.inventory.gear.form;
const G = STRINGS.inventory.gear;

// (the first owner is the main character: "Astra (you)")
export const wearerOptions = (owners, by = '') => [{ value: '', label: G.none }, ...(Array.isArray(owners) ? owners : []).map((entry, at) => ({ value: String(entry?.value ?? ''), label: `${String(entry?.label ?? '')}${at === 0 && entry?.label && !/\(you\)/.test(String(entry.label)) ? ` ${F.you}` : ''}` })), ...(by && !(Array.isArray(owners) ? owners : []).some(entry => String(entry?.value) === by) ? [{ value: by, label: G.left }] : [])];
