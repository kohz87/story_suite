// Builds `gear.view`, the one answer the gear screens (Inventory tab, Party slot card) draw.

import { isPlainObject } from '../../../scene/domains/common.js';
import { STRINGS, fill } from '../../../../core/strings.js';
import { readSheet } from '../../../rpg/read.js';
import { ridersOf } from '../../../scene/mounts-parts/riders.js';
import { GEAR } from '../stats.js';
import { statsFor, soakFor, soakCap, weightFor, handDef, slotWordOf, placeOf, gearBudget } from '../stats.js';
import { condWord } from '../conditions.js';
import { carryPicture, travelsWith, kindCarry, loadLevel } from '../carry.js';
import { soakRecord } from './soak.js';
import { wornStacks } from './worn.js';
import { bonusText } from './bonus-text.js';
import { slotCarriers } from './slot-carriers.js';
import { memberLoads } from './member-load.js';

const PLACES = GEAR.places;
const S = STRINGS.inventory.gear;
const E = STRINGS.editMessages;

// Why the reader cannot set what an item carries (inventory.carry's refusals, in its order), '' when they can: a bound piece, a pack's item, money.
const carryWhy = (def, stack, names) => (typeof stack.bound === 'string' && stack.bound ? fill(E.bound, { name: names(stack.bound) || stack.bound, item: def.name })
    : def.id.startsWith('pack.') ? E.carryPack : def.kind === 'money' ? E.carryMoney : '');

// ---- The gear screens' picture (Inventory tab, the slot card on the Party tab): `gear.view`.
// How full a condition bar is drawn for each word (Good full, Broken empty).
const FILL = Object.freeze({ good: 1, worn: 0.66, torn: 0.33, broken: 0 });


/**
 * `gear.view { owner?, who?, own? }`: everything the gear screens draw, in one answer (null while the feature is off):
 * { on, owner, carry: { load, capacity, pct, level: normal | heavy | over, lose, breakdown, away, parts, people: [{ id, name, load, capacity, level, left?, unnamed? }] } (the whole party's load and capacity; `people` the members who hold things that weigh or have a bag of their own, then whoever left and still holds things),
 *   rows: { [stack]: { bonus, cond, word, broken, place, by, byId } } (every stack: the stat bonus text, the condition word good | worn | torn | broken,
 *   where it is worn and by whom; `gone` the name of an owner who left), bag: [{ stack, name, rarity, bonus, fits }] (the unworn, unbound equipment, `fits` its slot word), wearers: [{ value, label }] (who has a piece on, the main character first), owners: [{ value, label }] (who can wear: the main character first), slots: { [place]: { stack, name, rarity, bonus, cond, word, broken } | null } (what `owner` has on) }.
 * `names(id)` is how an owner is called ("Astra"); `owners` the wearers it offers. `who` (a name) picks the owner by name, `own` the main character's.
 */
export function gearView(state, args, { condOf, carryOf, penalty, mounts, roster = null, names, owners, kit = () => false, empty = () => false }) {
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
            // What one unit weighs in load and the soak the piece has of its own (torn or not), with the most its slot allows: the Bag Edit's Weight and Soak (any unbound piece).
            weight: weightFor(def), soakOwn: def.kind === 'equipment' && Number.isSafeInteger(def.soak) ? Math.min(def.soak, soakCap(def.slot)) : 0, soakMax: def.kind === 'equipment' ? soakCap(def.slot) : 0,
            // What the reader set for it to add to carrying (0: none), and whether the item's own Edit form offers its Carry field (not a pack's, not money, not a hand-made piece: that form has its own).
            carry: Number.isSafeInteger(def.carry) && !def.id.startsWith('pack.') ? def.carry : 0,
            carryEdit: !def.id.startsWith('pack.') && def.kind !== 'money' && !handDef(inventory, def),
            // (the Bag's Edit shows Carries on every item: read-only with this reason when the engine would refuse it)
            carryWhy: carryWhy(def, stack, names),
            // A piece the reader added by hand (its Edit offers Kind, Slot, Rarity and Bonus): its own slot and stat points.
            ...(handDef(inventory, def) ? { hand: true, defSlot: def.kind === 'equipment' ? placeOf(slotWordOf(def.slot) ?? '') : '', stats: statsFor(def, stack) } : {}),
            // The reader may choose the slot of any equipment none of whose pieces is a cast member's (their own, the story's or a pack's: edit-parts/slot-edit.js).
            ...(def.kind === 'equipment' && !stacks.some(other => other.def === stack.def && typeof other.bound === 'string' && other.bound)
                && !Object.values(inventory?.kept ?? {}).some(list => Array.isArray(list) && list.some(entry => entry?.def === stack.def)) ? { slotEdit: true } : {}),
            // Any unbound equipment piece with points to give: its Edit lets the reader move them between stats (edit.js repoint); `budget` is the total that stays.
            ...(def.kind === 'equipment' && def.slot && gearBudget(def) > 0 && typeof stack.bound !== 'string' ? { repoint: { budget: gearBudget(def), stats: statsFor(def, stack) } } : {}),
            // A cast member's signature piece: whose it is, for the chip ("Bound to Mara").
            ...(typeof stack.bound === 'string' && stack.bound ? { bound: { who: names(stack.bound) || stack.bound } } : {}),
        };
    }
    const worn = wornStacks(state, owner);
    const slotOf = ({ stack, def }, place) => {
        const cond = condOf(stack, inventory);
        return { stack: stack.id, name: def.name, rarity: def.rarity, bonus: bonusText(statsFor(def, stack)), soak: soakFor(def, cond, place), cond, word: condWord(cond), broken: cond <= 0,
            ...(typeof stack.bound === 'string' && stack.bound ? { bound: { who: names(stack.bound) || stack.bound } } : {}) };
    };
    const slots = Object.fromEntries(PLACES.map(place => [place, worn[place] ? slotOf(worn[place], place) : null]));
    // The bag (the slot card's "Equip from bag"): equipment nobody wears and that is not a cast member's signature piece, with the slot word it fits.
    const bag = stacks.filter(stack => typeof stack.equipped !== 'string' && !(typeof stack.bound === 'string' && stack.bound) && defs[stack.def].kind === 'equipment' && slotWordOf(defs[stack.def].slot))
        .map(stack => ({ stack: stack.id, name: defs[stack.def].name, rarity: defs[stack.def].rarity, bonus: bonusText(statsFor(defs[stack.def], stack)), soak: soakFor(defs[stack.def], condOf(stack, inventory)), fits: slotWordOf(defs[stack.def].slot) }));
    // Who wears something, for the Inventory's Worn list: the main character first, then by name (a member who left still counts: their pieces are listed).
    const wearers = [...new Set(stacks.filter(stack => typeof stack.equipped === 'string').map(stack => stack.owner))].map(value => ({ value, label: names(value) || value }))
        .sort((a, b) => (a.value === 'party' ? -1 : b.value === 'party' ? 1 : a.label.localeCompare(b.label, 'en')));
    const picture = carryPicture(state, { carryOf, mounts, roster, nameOf: names });
    const place = state?.domains?.scene?.place?.name ?? '';
    const memberCount = picture.shared.members;
    // The members with room of their own. While any is listed, a shared bag with one member of its own names them too ("Wessel carries 30"): the sheet's name, else the roster's main character's.
    const theirs = memberLoads(picture, stacks);
    // What someone who left still holds is marked with their name, so the Bag can offer to take it back.
    for (const gone of picture.left) for (const stack of stacks) if (stack.owner === gone.id) rows[stack.id].gone = gone.name;
    const pcName = roster?.members.find(member => member.id === roster.pc)?.name ?? null;
    const whose = entry => (memberCount > 1 ? entry.name : !theirs.parts.length ? null : readSheet(state).characters.length ? entry.name : pcName);
    // "Carries 25 · Sling Bag +10 · Horse +40 (with the party)": what each member can carry (their strength gives it), then what each item and mount adds.
    const rideNames = new Set((Array.isArray(mounts) ? mounts : []).filter(row => row && travelsWith(row.where, place)).map(row => row.name));
    const shown = (picture.sources.party ?? []).map((entry, at) => ({ label: entry.name, value: entry.carry, dim: false,
        text: at < memberCount ? (whose(entry) ? `${whose(entry)} ${S.carries} ${entry.carry}` : `Carries ${entry.carry}`)
            : `${entry.name} +${entry.carry}${rideNames.has(entry.name) ? ` ${S.withParty}` : ''}` }));
    // Then what each member with an owner of their own adds, and a line for each of them: the bar is the whole party's, the numbers the encumbrance rule reads.
    const counted = [...shown, ...theirs.parts];
    const breakdown = counted.map(part => part.text).join(' · ');
    const heldBags = stacks.filter(stack => carryOf(defs[stack.def]) && stack.owner === 'party' && (defs[stack.def].kind !== 'equipment' || stack.equipped !== null));
    const mountRowsOf = (Array.isArray(mounts) ? mounts : []).filter(row => row).map(row => ({
        name: row.name, withParty: travelsWith(row.where, place), riders: ridersOf(row.where),
        carry: (Number.isSafeInteger(row.carry) && row.carry > 0 ? row.carry : kindCarry(row.kind)) * (Number.isSafeInteger(row.count) && row.count > 0 ? row.count : 1), where: String(row.where).trim(),
    }));
    // The Mount and Bag slots of the Party paper-doll: what `owner` rides and carries, and every mount and bag the pickers list.
    const doll = slotCarriers({ owner, stacks, defs, mounts, place, names, carryOf });
    const awayRows = mountRowsOf.filter(row => !row.withParty).map(row => ({ ...row, text: `${row.name} +${row.carry} · ${row.where}, not with you` }));
    const away = awayRows.map(row => row.text);
    return {
        on: true, owner, owners: list, rows, slots, bag, wearers, soak: soakRecord(state, owner, condOf),
        // The starting kit (the chat has no message from the reader yet): Rarity and Bonus may be set by hand.
        kit: { open: kit() === true, ...(empty() === true ? { empty: true } : {}) },
        carry: {
            load: picture.load, capacity: picture.capacity, pct: picture.capacity > 0 ? Math.round(picture.load * 100 / picture.capacity) : 0,
            level: loadLevel(picture.load, picture.capacity), lose: Math.abs(penalty), breakdown, away, people: theirs.people,
            // The same breakdown as rows ({ label, value, text, dim }: dim for what is left behind), for the Bag's load chips.
            parts: [...counted, ...awayRows.map(({ name, carry, text }) => ({ label: name, value: carry, text, dim: true }))],
        },
        // What carries the load: the mounts (with the party or left behind) and the party's carrying items, (`riders`: the names its `where` says ride or lead it), so the Bag can link a mount or a bag to its slot.
        carriers: { mounts: mountRowsOf.map(({ name, carry, withParty, riders }) => ({ name, carry, withParty, riders })), bags: heldBags.map(stack => ({ stack: stack.id, name: defs[stack.def].name, carry: carryOf(defs[stack.def]) })),
            // (the Party pickers' lists: every mount with kind, pace, seats and where; every bag-like item with whose it is)
            rides: doll.mounts, packs: doll.packs },
        // What `owner` rides and carries as a bag (the Mount and Bag slots), or null.
        ride: doll.ride, bagSlot: doll.bag,
    };
}
