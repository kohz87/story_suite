// Gear form: the fields and the plan of the Edit of a piece the reader added.

import { STRINGS } from '../../strings.js';
import { NOTE_MAX, SHOWN } from './shared-limits.js';
import { short } from './shared-short.js';
import { kindOptions, rarityOptions, slotOptions } from './shared-options.js';
import { wearerOptions } from './shared-wearer.js';
import { bonusFields, statsOf } from './bonus.js';

const F = STRINGS.inventory.gear.form;
const G = STRINGS.inventory.gear;
const E = STRINGS.editMessages;
const N = STRINGS.inventory;

/**
 * The fields of the Edit of a piece the reader added, from the item widget's props `p` (`value` the name, `itemCount`, `itemNote`, `gear`: `{ kind, rarity, stack,
 * owner, by, place, row: { defSlot, stats }, kit, owners }`).
 */
export function editFields(p) {
    const gear = p?.gear ?? {};
    const row = gear.row ?? {};
    const kit = gear.kit === true;
    const equipment = gear.kind === 'equipment';
    const fields = [
        { key: 'name', label: F.name, type: 'text', value: String(p?.value ?? ''), maxLength: 120, group: F.groupItem },
        { key: 'count', label: F.count, type: 'number', min: 1, value: Number(p?.itemCount ?? 1), group: F.groupItem, row: 'ck' },
        { key: 'kind', label: F.kind, type: 'choice', options: kindOptions(), value: gear.kind ?? 'goods', group: F.groupItem, row: 'ck' },
        { key: 'note', label: F.note, type: 'text', value: String(p?.itemNote ?? ''), maxLength: NOTE_MAX, group: F.groupItem },
        // (only the reader sets it; the story never does)
        { key: 'carry', label: F.carry, type: 'number', min: 0, max: 500, value: Number.isSafeInteger(row.carry) ? row.carry : 0, group: F.groupItem },
        { key: 'carryHelp', type: 'note', text: F.carryHelp, group: F.groupItem },
        { key: 'slot', label: F.slot, type: 'choice', options: slotOptions(), value: String(row.defSlot ?? ''), group: F.groupGear, row: 'sr', showWhen: SHOWN },
        { key: 'rarity', label: F.rarity, tone: true, type: 'choice', options: rarityOptions(), value: equipment || kit ? String(gear.rarity ?? 'common') : 'common', group: F.groupGear, row: 'sr', showWhen: SHOWN,
            ...(kit ? {} : { disabled: true, title: F.laterTitle }) },
        ...bonusFields(equipment ? row.stats : {}, !kit && !(equipment && row.repoint)),
        { key: 'by', label: F.equippedBy, type: 'choice', options: wearerOptions(gear.owners, String(gear.by ?? '')), value: String(gear.by ?? ''), group: F.groupGear, showWhen: SHOWN },
        ...(kit ? [] : [{ key: 'later', type: 'note', text: equipment && row.repoint ? F.repointHint.replace('{n}', String(row.repoint.budget)).replace('{points}', row.repoint.budget === 1 ? 'point' : 'points') : F.laterHint, group: F.groupGear, showWhen: SHOWN }]),
    ];
    return fields;
}

/** The `plan` of that Edit: `inventory.edit` for what changed (name, count, note, kind, slot, rarity, bonus), then who wears it (`item.equip` / `inventory.unequip`). */
export function editPlan(p) {
    const gear = p?.gear ?? {};
    return (changed, all) => {
        const stack = gear.stack;
        const payload = { stack, group: true };
        const name = short(all.name, 120);
        if (changed.name !== undefined) { if (!name) return { error: E.itemName }; if (name !== p.value) payload.name = name; }
        if (changed.count !== undefined) {
            if (!Number.isSafeInteger(all.count) || all.count < 1) return { error: N.countError };
            if (all.count !== p.itemCount) payload.qty = all.count;
        }
        if (changed.note !== undefined) payload.note = short(all.note, NOTE_MAX);
        const touched = ['kind', 'slot', 'rarity', 'stat1', 'points1', 'stat2', 'points2'].some(key => changed[key] !== undefined);
        if (touched) {
            if (changed.kind !== undefined) payload.kind = all.kind;
            if (all.kind === 'equipment') {
                if (changed.slot !== undefined) payload.slot = all.slot;
                // (Goods made Equipment while the kit is open saves the Rarity the form shows, touched or not; later it is Common, which the form shows too)
                if (changed.rarity !== undefined || (changed.kind !== undefined && gear.kit === true)) payload.rarity = all.rarity;
                if (['stat1', 'points1', 'stat2', 'points2'].some(key => changed[key] !== undefined)) {
                    const read = statsOf(all);
                    if (read.error) return { error: read.error };
                    payload.stats = read.stats;
                }
            }
        }
        const steps = [];
        if (Object.keys(payload).length > 2) steps.push({ command: 'inventory.edit', payload, keys: ['name', 'count', 'note', 'kind', 'slot', 'rarity', 'stat1', 'points1', 'stat2', 'points2'] });
        // (Carry after the edit: a rename of a shared piece gives it a definition of its own, and the carry must land on that one, not on the other pieces')
        if (changed.carry !== undefined) {
            if (!Number.isSafeInteger(all.carry) || all.carry < 0 || all.carry > 500) return { error: E.carryRange.replace('{max}', '500') };
            steps.push({ command: 'inventory.carry', payload: { stack, carry: all.carry }, keys: ['carry'] });
        }
        // Who wears it: only for equipment; leaving Equipment takes it off inside the edit itself.
        if (all.kind === 'equipment') {
            const placed = String(gear.place ?? ''), wearer = String(gear.by ?? '');
            const by = String(all.by ?? '');
            const slot = String(all.slot ?? '');
            if (!by || !slot) {
                if (by === '' && placed && changed.by !== undefined) steps.push({ command: 'inventory.unequip', payload: { stack }, keys: ['by'] });
            } else if (!(placed === slot && wearer === by) && (changed.by !== undefined || changed.slot !== undefined || changed.kind !== undefined)) {
                steps.push({ command: 'item.equip', payload: { stack, owner: by, slot, ...(by !== gear.owner ? { transfer: true } : {}) }, keys: ['by'] });
            }
        }
        if (!steps.length && all.kind === 'equipment' && (changed.by !== undefined || changed.slot !== undefined || !Object.keys(changed).length)) return { error: gear.place ? E.nothingChanged : E.nothingWorn };
        return { steps };
    };
}
