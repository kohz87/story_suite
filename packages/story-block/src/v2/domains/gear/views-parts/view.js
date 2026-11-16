// Builds `gear.view`, the one answer the gear screens (Inventory tab, Party slot card) draw.

import { isPlainObject } from '../../common.js';
import { STRINGS } from '../../../../../../../core/strings.js';
import { readSheet } from '../../../../../../../modules/rpg/read.js';
import { GEAR } from '../stats.js';
import { statsFor, soakFor, handDef, slotWordOf, placeOf, gearBudget } from '../stats.js';
import { condWord } from '../conditions.js';
import { carryPicture, travelsWith, kindCarry, loadLevel } from '../carry.js';
import { soakRecord } from './soak.js';
import { bonusText } from './bonus-text.js';

const PLACES = GEAR.places;
const S = STRINGS.inventory.gear;

// ---- The gear screens' picture (Inventory tab, the slot card on the Party tab): `gear.view`.
// How full a condition bar is drawn for each word (Good full, Broken empty).
const FILL = Object.freeze({ good: 1, worn: 0.66, torn: 0.33, broken: 0 });


/**
 * `gear.view { owner?, who?, own? }`: everything the gear screens draw, in one answer (null while the feature is off):
 * { on, owner, carry: { load, capacity, pct, level: normal | heavy | over, lose, breakdown, away },
 *   rows: { [stack]: { bonus, cond, word, broken, place, by, byId } } (every stack: the stat bonus text, the condition word good | worn | torn | broken,
 *   where it is worn and by whom), bag: [{ stack, name, rarity, bonus, fits }] (the unworn, unbound equipment, `fits` its slot word), wearers: [{ value, label }] (who has a piece on, the main character first), owners: [{ value, label }] (who can wear: the main character first), slots: { [place]: { stack, name, rarity, bonus, cond, word, broken } | null } (what `owner` has on) }.
 * `names(id)` is how an owner is called ("Astra"); `owners` the wearers it offers. `who` (a name) picks the owner by name, `own` the main character's.
 */
export function gearView(state, args, { condOf, carryOf, penalty, mounts, names, owners, kit = () => false, empty = () => false }) {
    const inventory = state?.domains?.inventory;
    const defs = isPlainObject(inventory?.defs) ? inventory.defs : {};
    const stacks = Object.values(isPlainObject(inventory?.stacks) ? inventory.stacks : {}).filter(stack => isPlainObject(stack) && isPlainObject(defs[stack.def]))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const list = owners();
    let owner = typeof args?.owner === 'string' && args.owner ? args.owner : null;
    if (!owner && typeof args?.who === 'string' && args.who.trim()) {
        const key = args.who.trim().toLowerCase();
        owner = args.own === true ? 'party' : list.find(entry => entry.label.toLowerCase() === key)?.value ?? null;
    }
    if (!owner && !(typeof args?.who === 'string' && args.who.trim())) owner = 'party';
    const rows = {};
    for (const stack of stacks) {
        const def = defs[stack.def];
        const cond = condOf(stack, inventory);
        const worn = typeof stack.equipped === 'string';
        rows[stack.id] = {
            bonus: def.kind === 'equipment' ? bonusText(statsFor(def, stack)) : '', cond, word: condWord(cond), broken: cond <= 0,
            place: worn ? stack.equipped : '', by: worn ? names(stack.owner) : '', byId: worn ? stack.owner : '',
            // The slot the Edit form offers: where it is worn, else the place its own slot names ('' for none: a bag).
            slotKey: worn ? stack.equipped : (def.kind === 'equipment' && slotWordOf(def.slot) ? placeOf(slotWordOf(def.slot)) : ''),
            fill: FILL[condWord(cond)], soak: soakFor(def, cond),
            // What the reader set for it to add to carrying (0: none), and whether the item's own Edit form offers its Carry field (not a pack's, not money, not a hand-made piece: that form has its own).
            carry: Number.isSafeInteger(def.carry) && !def.id.startsWith('pack.') ? def.carry : 0,
            carryEdit: !def.id.startsWith('pack.') && def.kind !== 'money' && !handDef(inventory, def),
            // A piece the reader added by hand (its Edit offers Kind, Slot, Rarity and Bonus): its own slot and stat points.
            ...(handDef(inventory, def) ? { hand: true, defSlot: def.kind === 'equipment' ? placeOf(slotWordOf(def.slot) ?? '') : '', stats: statsFor(def, stack) } : {}),
            // Any unbound equipment piece with points to give: its Edit lets the reader move them between stats (edit.js repoint); `budget` is the total that stays.
            ...(def.kind === 'equipment' && def.slot && gearBudget(def) > 0 && typeof stack.bound !== 'string' ? { repoint: { budget: gearBudget(def), stats: statsFor(def, stack) } } : {}),
            // A cast member's signature piece: whose it is, for the chip ("Bound to Mara").
            ...(typeof stack.bound === 'string' && stack.bound ? { bound: { who: names(stack.bound) || stack.bound } } : {}),
        };
    }
    const slots = Object.fromEntries(PLACES.map(place => [place, null]));
    for (const stack of stacks) {
        if (stack.owner !== owner || typeof stack.equipped !== 'string' || !Object.hasOwn(slots, stack.equipped) || slots[stack.equipped]) continue;
        const def = defs[stack.def];
        const cond = condOf(stack, inventory);
        slots[stack.equipped] = { stack: stack.id, name: def.name, rarity: def.rarity, bonus: bonusText(statsFor(def, stack)), soak: soakFor(def, cond, stack.equipped), cond, word: condWord(cond), broken: cond <= 0,
            ...(typeof stack.bound === 'string' && stack.bound ? { bound: { who: names(stack.bound) || stack.bound } } : {}) };
    }
    // The bag (the slot card's "Equip from bag"): equipment nobody wears and that is not a cast member's signature piece, with the slot word it fits.
    const bag = stacks.filter(stack => typeof stack.equipped !== 'string' && !(typeof stack.bound === 'string' && stack.bound) && defs[stack.def].kind === 'equipment' && slotWordOf(defs[stack.def].slot))
        .map(stack => ({ stack: stack.id, name: defs[stack.def].name, rarity: defs[stack.def].rarity, bonus: bonusText(statsFor(defs[stack.def], stack)), soak: soakFor(defs[stack.def], condOf(stack, inventory)), fits: slotWordOf(defs[stack.def].slot) }));
    // Who wears something, for the Inventory's Worn list: the main character first, then by name (a member who left still counts: their pieces are listed).
    const wearers = [...new Set(stacks.filter(stack => typeof stack.equipped === 'string').map(stack => stack.owner))].map(value => ({ value, label: names(value) || value }))
        .sort((a, b) => (a.value === 'party' ? -1 : b.value === 'party' ? 1 : a.label.localeCompare(b.label, 'en')));
    const picture = carryPicture(state, { carryOf, mounts });
    const shared = picture.shared;
    const place = state?.domains?.scene?.place?.name ?? '';
    const memberCount = Math.max(1, readSheet(state).characters.length);
    // "Strength 25 · Sling Bag +10 · Horse +40 (with the party)": each member's strength, then what each item and mount adds.
    const rideNames = new Set((Array.isArray(mounts) ? mounts : []).filter(row => row && travelsWith(row.where, place)).map(row => row.name));
    const breakdown = (picture.sources.party ?? []).map((entry, at) => (at < memberCount ? (memberCount === 1 ? `${S.strength} ${entry.carry}` : `${entry.name} ${S.strength.toLowerCase()} ${entry.carry}`)
        : `${entry.name} +${entry.carry}${rideNames.has(entry.name) ? ` ${S.withParty}` : ''}`)).join(' · ');
    const away = (Array.isArray(mounts) ? mounts : []).filter(row => row && !travelsWith(row.where, place)).map(row => {
        const carry = (Number.isSafeInteger(row.carry) && row.carry > 0 ? row.carry : kindCarry(row.kind)) * (Number.isSafeInteger(row.count) && row.count > 0 ? row.count : 1);
        return `${row.name} +${carry} · ${String(row.where).trim()}, not with you`;
    });
    return {
        on: true, owner, owners: list, rows, slots, bag, wearers, soak: soakRecord(state, owner, condOf),
        // The starting kit (the chat has no message from the reader yet): Rarity and Bonus may be set by hand.
        kit: { open: kit() === true, ...(empty() === true ? { empty: true } : {}) },
        carry: {
            load: shared.load, capacity: shared.capacity, pct: shared.capacity > 0 ? Math.round(shared.load * 100 / shared.capacity) : 0,
            level: loadLevel(shared.load, shared.capacity), lose: Math.abs(penalty), breakdown, away,
        },
    };
}
