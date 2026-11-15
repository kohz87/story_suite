// Gear form: the fields and the plan of "+ Add item".

import { STRINGS } from '../../strings.js';
import { FORM_KINDS, NAME_MAX, NOTE_MAX, SHOWN } from './shared-limits.js';
import { short } from './shared-short.js';
import { kindOptions, rarityOptions, slotOptions } from './shared-options.js';
import { wearerOptions } from './shared-wearer.js';
import { bonusFields, statsOf } from './bonus.js';

const F = STRINGS.inventory.gear.form;
const G = STRINGS.inventory.gear;
const E = STRINGS.editMessages;
const N = STRINGS.inventory;

/** The fields of "+ Add item". `kit`: the starting kit is open; `owners`: who can wear it, [{ value, label }]. */
export function addFields({ kit = false, owners = [] } = {}) {
    const fields = [
        { key: 'name', label: F.name, type: 'text', value: '', maxLength: NAME_MAX, group: F.groupItem },
        { key: 'count', label: F.count, type: 'number', min: 1, value: 1, group: F.groupItem, row: 'ck' },
        { key: 'kind', label: F.kind, type: 'choice', options: kindOptions(), value: 'goods', group: F.groupItem, row: 'ck' },
        { key: 'note', label: F.note, type: 'text', value: '', maxLength: NOTE_MAX, group: F.groupItem },
        { key: 'slot', label: F.slot, type: 'choice', options: slotOptions(), value: '', group: F.groupGear, row: 'sr', showWhen: SHOWN },
        { key: 'rarity', label: F.rarity, tone: true, type: 'choice', options: rarityOptions(), value: 'common', group: F.groupGear, row: 'sr', showWhen: SHOWN, ...(kit ? {} : { disabled: true, title: F.laterTitle }) },
        ...(kit ? bonusFields({}, false) : []),
        { key: 'equip', label: F.equipOn, type: 'choice', options: wearerOptions(owners), value: '', group: F.groupGear, showWhen: SHOWN },
        ...(kit ? [] : [{ key: 'later', type: 'note', text: F.laterHint, group: F.groupGear, showWhen: SHOWN }, { key: 'copy', type: 'note', text: F.copyHint, group: F.groupGear, showWhen: SHOWN }]),
    ];
    return fields;
}
/** The `plan` of "+ Add item": one `inventory.add` (and, when asked, the putting on inside it, so a refusal leaves nothing half done). */
export function addPlan({ kit = false } = {}) {
    return (_changed, all) => {
        const name = short(all.name, NAME_MAX);
        if (!name) return { error: E.itemName };
        const qty = all.count;
        if (!Number.isSafeInteger(qty) || qty < 1) return { error: N.countError };
        const payload = { name, qty, kind: all.kind };
        const note = short(all.note, NOTE_MAX);
        if (note) payload.note = note;
        if (all.kind === 'equipment') {
            if (all.slot) payload.slot = all.slot;
            if (kit) {
                const read = statsOf(all);
                if (read.error) return { error: read.error };
                if (all.rarity && all.rarity !== 'common') payload.rarity = all.rarity;
                if (Object.keys(read.stats).length) payload.stats = read.stats;
            }
            if (all.equip) payload.equip = all.equip;
        }
        return { steps: [{ command: 'inventory.add', payload, keys: Object.keys(all) }] };
    };
}
