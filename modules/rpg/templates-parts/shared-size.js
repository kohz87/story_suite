// The size of each bar (health, stamina, mana) from the stats, and the rule that resizes a bar when the size changes.
import { get } from './shared-fields.js';

export const SIZE = {
    health: ['add', 4, ['floorDiv', get('vit'), 5]],
    stamina: ['add', 3, ['floorDiv', get('agi'), 5]],
    mana: ['add', 3, ['floorDiv', get('int'), 5]],
};

export const sizeRule = (id, key, sizeKey, size) => ({ id, when: ['ne', get(sizeKey), size],
    then: [
        // New blocks arrive full: the rise in size is added to what is there, except while Down (0 stays 0).
        { op: 'add', path: [key], value: ['mul', ['min', get(key), 1], ['max', 0, ['sub', size, get(sizeKey)]]], bounds: 'clamp' },
        { op: 'set', path: [sizeKey], value: size },
        // A bar that shrank holds at most its new size (its new size is never below 3, so a character who is up stays up).
        { op: 'set', path: [key], value: ['min', get(key), size] }] });
