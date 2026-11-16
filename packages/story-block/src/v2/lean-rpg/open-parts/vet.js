// Holds a pre-call's requested new foes to the rules (vetOpen), reading the level, class or rank it wrote.
import { CLASS_NAMES, FOE_SLOTS } from '../names.js';
import { bandOfRank, foeLevelCap, levelOf, levelOfClass, partyLevels } from '../foes.js';
import { fold } from '../read.js';
import { oneLine } from './shared-text.js';
import { isNamedIn } from './named.js';
import { OPEN_MAX_COUNT, OPEN_MAX_NAME, RANK_MAX } from './limits.js';

// A level as an old planner record wrote it: "14", "Lv 14" or "level 14". An old "class: III" (or 3) stands for the level of that class.
const levelWritten = value => {
    const word = oneLine(value).replace(/^(?:level|lv\.?)\s*/iu, '');
    return /^\d+$/u.test(word) ? levelOf(Number(word)) : null;
};
const classWritten = value => {
    const word = oneLine(value).replace(/^class\s*/iu, '').toUpperCase();
    const soulClass = /^\d+$/u.test(word) ? Number(word) : CLASS_NAMES.indexOf(word) + 1;
    return levelOfClass(soulClass);
};


/**
 * The foes a pre-call asked for as new, held to the rules: `requested` = [{ name, count?, level?, rank?, class? }] (text as written), `sheet` = readSheet, `texts` = the
 * reader's latest message and the shown text of the reply before, `rankAt(level)` → `{ name } | null` (the `rpg.rank` query; none: ranks are not known).
 * → { open: [{ name, count, level } | { name, count, rank, from, to } | { name, count }], refused: [{ name, why }] }.
 * A name must share a distinctive word with the texts (never invented); one already on the sheet, or asked twice, is not new; the count is
 * held to 1–12 (none: 1). The level is the one written (held to 1–99); else the rank's band (a rank no pack names is passed over); else an old class
 * stands for its level; else the level is left to be drawn when the plan is rolled.
 */
export function vetOpen(requested, sheet, texts, { rankAt = null, stated = null } = {}) {
    const open = [], refused = [];
    // A new foe with a GUESSED level is at most the party's highest level + 20: a level or rank above that is held down to it.
    const cap = foeLevelCap(partyLevels(sheet));
    // (a standing group is already there; a Down one is beaten and a new group of its name is new: openFoes replaces it)
    const known = new Set((sheet?.foes ?? []).filter(foe => foe.filled && foe.hurt > 0).map(foe => fold(foe.name)));
    for (const entry of requested ?? []) {
        const name = oneLine(entry?.name).slice(0, OPEN_MAX_NAME).trim();
        if (!name) continue;
        const key = fold(name);
        if (known.has(key)) continue;
        if (!isNamedIn(name, texts)) { refused.push({ name, why: 'not named' }); continue; }
        known.add(key);
        const count = Number.parseInt(oneLine(entry.count), 10);
        const counted = Number.isInteger(count) ? Math.max(1, Math.min(OPEN_MAX_COUNT, count)) : 1;
        // A person's own Level (stated-level.js, read by the caller before the plan is recorded) passes the cap and wins over what the entry wrote.
        let given = null;
        try { given = counted === 1 && typeof stated === 'function' ? stated(name) : null; } catch { given = null; }
        if (given && Number.isInteger(given.level)) { open.push({ name, count: counted, level: levelOf(given.level) }); continue; }
        if (given && typeof given.rank === 'string' && Number.isInteger(given.from) && Number.isInteger(given.to) && given.from <= given.to) { open.push({ name, count: counted, rank: given.rank, from: given.from, to: given.to }); continue; }
        const level = levelWritten(entry.level) ?? (oneLine(entry.rank) ? null : classWritten(entry.class));
        if (level !== null) { open.push({ name, count: counted, level: Math.min(level, cap) }); continue; }
        const rank = oneLine(entry.rank).slice(0, RANK_MAX), band = rank ? bandOfRank(rank, rankAt) : null;
        open.push(band ? (band.from > cap ? { name, count: counted, level: cap } : { name, count: counted, rank, from: band.from, to: Math.min(band.to, cap) }) : { name, count: counted });
    }
    return { open: open.slice(0, FOE_SLOTS), refused };
}
