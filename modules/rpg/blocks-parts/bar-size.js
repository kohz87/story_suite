// Works out a bar's size in blocks and its reading as the views take it.
import { blocksFor, foeHealthBlocks } from '../formula.js';
import { foeBlocksByLevel, hardBlocksByLevel, isHardBar } from '../foes.js';
import { barOf, scaleOf, statsOfFields, wordsOf } from './schema-reading.js';
import { spreadWord } from './stage-words.js';
import { whole } from './shared-whole.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * How many blocks the bar `key` of a block has now, or null when the field is not a block bar. `key` is `health`, `mana`, `stamina` or a
 * foe slot's `hurtN`; `fields` holds the stats (a character) or the slot's level (a foe).
 */
export function sizeOf(schema, fields, key) {
    const bar = barOf(schema);
    if (!bar) return null;
    if (bar === 'foe') {
        const slot = /^hurt(\d+)$/.exec(String(key))?.[1];
        // A block of the Levels rules has `level{n}`: 4 + level/30 blocks; one of the earlier rules has `class{n}` (4 + class/3).
        if (slot && Object.hasOwn(fields ?? {}, `level${slot}`)) { const level = whole(fields[`level${slot}`]) || 1; return isHardBar(schema) ? hardBlocksByLevel(level) : foeBlocksByLevel(level); }
        return foeHealthBlocks(slot ? whole(fields?.[`class${slot}`]) || 1 : 1);
    }
    return blocksFor(statsOfFields(fields), scaleOf(schema))[bar];
}

/**
 * One bar as the views read it: `{ value, size, word }` with the value held to 0..size. `schema` is the field's; the caller falls back to the
 * stage reading when `barOf(schema)` is null.
 */
export function barReading(schema, fields, key) {
    const bar = barOf(schema), size = sizeOf(schema, fields, key);
    if (!bar) return null;
    const value = Math.min(size, Math.max(0, whole(fields?.[key])));
    return { value, size, word: spreadWord(wordsOf(bar), value, size) };
}

/** The bars of a character that are blocks: `{ health, stamina, mana }` readings, or null when its Health field is not a block bar. */
export function characterBars(definition, fields) {
    const state = isRecord(definition?.state) ? definition.state : {};
    if (!barOf(state.health)) return null;
    return Object.fromEntries(['health', 'stamina', 'mana'].map(key => [key, barReading(state[key], fields, key)]));
}
