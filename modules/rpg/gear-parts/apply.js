// Lays gear over the stats of a sheet and writes what it added to each Line for the log.
import { fold } from '../read.js';
import { STAT_MAX, ENCUMBERED_STATS } from './shared-marks.js';
import { isObject } from './shared-helpers.js';

/**
 * The sheet with the gear laid over the stats: each member's stats are stat + gear (held to 30), AGI and DEX then + the encumbered penalty (never under 1).
 * `base` keeps the stats as the block holds them (the bars' sizes follow those, never the gear). Without gear the sheet itself.
 */
export function applyGear(sheet, gear) {
    if (!gear || !sheet?.characters) return sheet;
    return {
        ...sheet,
        characters: sheet.characters.map(character => {
            const entry = gear.who?.[character.key];
            if (!entry || (!entry.add && !entry.enc)) return character;
            const stats = { ...character.stats };
            for (const [stat, n] of Object.entries(entry.add ?? {})) if (Number.isInteger(stats[stat])) stats[stat] = n > 0 ? Math.max(stats[stat], Math.min(STAT_MAX, stats[stat] + n)) : stats[stat] + n;
            if (entry.enc) for (const stat of ENCUMBERED_STATS) if (Number.isInteger(stats[stat])) stats[stat] = Math.max(1, stats[stat] + entry.enc);
            return { ...character, stats, base: character.base ?? character.stats };
        }),
    };
}

/** The stats a Line rolled with (one stat, or the pair). */
const statsOfLine = line => [line.pc?.stat, line.pc?.second].filter((stat, at, all) => typeof stat === 'string' && all.indexOf(stat) === at);

/**
 * What the gear added to one Line, for the log: [{ name, stat, n }] ("Cane Sword", "dex", 2), with the encumbered penalty as { name: 'Encumbered', stat, n: -2 }.
 * Only the stats the roll used are named. [] when there was none.
 */
export function gearOfLine(line, gear) {
    const entry = gear?.who?.[fold(line?.pc?.who)];
    if (!entry) return [];
    const used = statsOfLine(line), out = [];
    for (const item of entry.items ?? []) for (const [stat, n] of Object.entries(item.stats)) if (used.includes(stat)) out.push({ name: item.name, stat, n });
    if (entry.enc) for (const stat of ENCUMBERED_STATS) if (used.includes(stat)) out.push({ name: 'Encumbered', stat, n: entry.enc });
    return out;
}

/** Writes each Line's `pc.gear` (the gear that was in its roll), for the log; a line that had none is left as it is. */
export function noteGear(lines, gear) {
    for (const line of lines) {
        if (!isObject(line?.pc)) continue;
        const used = gearOfLine(line, gear);
        if (used.length) line.pc = { ...line.pc, gear: used };
    }
}
