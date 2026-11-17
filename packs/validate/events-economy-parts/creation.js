// Checking the start section.

import { LIMITS, RECORD_LIMITS, START_FIELDS } from '../../limits.js';
import { oneLine } from '../../../core/text.js';
import { isObject, isInt } from '../core.js';

export function checkStart(start, add, ref) {
    if (!isObject(start)) {
        add('BAD_START', 'start', 'start must be an object: { "scene": { … }, "inventory": { … } }.');
        return null;
    }
    for (const key of Object.keys(start)) if (!START_FIELDS.includes(key)) add('UNKNOWN_FIELD', `start.${key}`, `"${key}" is not a start field (expected ${START_FIELDS.join(', ')}).`);
    const out = { scene: { place: null, present: [] }, inventory: { items: [], money: 0 } };
    const scene = start.scene ?? {};
    if (!isObject(scene)) add('BAD_START', 'start.scene', 'start.scene must be an object.');
    else {
        if (scene.place !== undefined) {
            const place = scene.place;
            const fields = ['name', 'kind', 'region'];
            if (!isObject(place) || typeof place.name !== 'string' || !place.name.trim()
                || Object.keys(place).some(key => !fields.includes(key))
                || fields.some(field => place[field] !== undefined && (typeof place[field] !== 'string' || place[field].length > LIMITS.name))) {
                add('BAD_START', 'start.scene.place', 'start.scene.place must be { "name": …, "kind": …, "region": … } with short text values.');
            } else out.scene.place = { name: oneLine(place.name), kind: oneLine(place.kind ?? ''), region: oneLine(place.region ?? '') };
        }
        if (scene.present !== undefined) {
            if (!Array.isArray(scene.present) || scene.present.some(name => typeof name !== 'string' || !name.trim() || name.length > LIMITS.name)) add('BAD_START', 'start.scene.present', 'start.scene.present must be a list of names.');
            else out.scene.present = scene.present.map(name => oneLine(name));
        }
        for (const key of Object.keys(scene)) if (key !== 'place' && key !== 'present') add('UNKNOWN_FIELD', `start.scene.${key}`, `"${key}" is not a start.scene field (expected place, present).`);
    }
    const inventory = start.inventory ?? {};
    if (!isObject(inventory)) add('BAD_START', 'start.inventory', 'start.inventory must be an object.');
    else {
        for (const key of Object.keys(inventory)) if (key !== 'items' && key !== 'money') add('UNKNOWN_FIELD', `start.inventory.${key}`, `"${key}" is not a start.inventory field (expected items, money).`);
        const items = inventory.items ?? [];
        if (!Array.isArray(items)) add('BAD_START', 'start.inventory.items', 'start.inventory.items must be a list.');
        else items.forEach((entry, index) => {
            const at = `start.inventory.items[${index}]`;
            const line = typeof entry === 'string' ? { item: entry } : entry;
            if (!isObject(line) || Object.keys(line).some(key => !['item', 'qty', 'note'].includes(key))) return add('BAD_START', at, `${at} is an item name or { "item": …, "qty": …, "note": … }.`);
            const id = ref(line.item);
            // A start item must be defined by this pack: the start state has no story to name it.
            if (!id || !id.startsWith('pack.')) return add('UNKNOWN_REF', `${at}.item`, `The start gives "${line.item}", which is not an item of this pack.`);
            if (!isInt(line.qty ?? 1, 1)) return add('BAD_START', `${at}.qty`, `${at}.qty must be a whole number of 1 or more.`);
            if (line.note !== undefined && (typeof line.note !== 'string' || line.note.length > RECORD_LIMITS.note)) return add('BAD_START', `${at}.note`, `${at}.note must be text of at most 500 characters.`);
            out.inventory.items.push({ item: id, qty: line.qty ?? 1, note: line.note ?? '' });
        });
        // Money is one whole number of the chat's one currency, like item values (MODULES §F1).
        const money = inventory.money ?? 0;
        if (!isInt(money)) add('BAD_START', 'start.inventory.money', 'start.inventory.money must be a whole number of 0 or more.');
        else out.inventory.money = money;
    }
    return out;
}
