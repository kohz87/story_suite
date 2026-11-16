// The key, version and size limits of a saved character file.

/** The key that marks the file, and the version of its shape. */
export const CHAR_FILE = 'storySuiteCharacter';
export const CHAR_VERSION = 1;

/** What the file may hold: the RPG's own limits where it has them (names.js CREATION, the Character block's fields), the inventory's elsewhere. */
export const FILE_LIMITS = Object.freeze({
    bytes: 65536, level: Object.freeze([1, 99]), soul: Object.freeze([1, 9]), points: 60, stat: Object.freeze([1, 20]), rank: 3,
    items: 60, itemName: 60, itemNote: 300, qty: 999, carry: 500, money: 1_000_000_000,
});
