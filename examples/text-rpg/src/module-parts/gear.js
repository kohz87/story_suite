// What a member wears: the gear stat bonuses, capped by rarity, and the worn pieces' names, from the `gear.view` query.
import { effectiveStat, gearCap } from '../rules/healing.js';
import { STAT_KEYS } from '../words/stats.js';
import { effectiveStats } from './effective.js';

/** The gear's seven stats in its own order: Text RPG counts them by position, so the sixth (WIS) is its sixth stat (wis); LUK, what an older gear build called it, is the same place. */
export const GEAR_ORDER = Object.freeze(['STR', 'VIT', 'AGI', 'DEX', 'INT', 'WIS', 'CHA']);

/** Runs a query and returns its answer, or null when it is missing, throws or answers nothing. */
export function ask(query, name, args) {
    try { return typeof query === 'function' ? query(name, args) ?? null : null; } catch { return null; }
}

/** `{ cap: { AGI: 2, WIS: 1 }, names: ['ash staff'] }` for a member; the reader's character wears from the shared `party` bag. */
export function gearOf(query, member) {
    const answer = ask(query, 'gear.view', { owner: member?.pc ? 'party' : member?.id });
    const pieces = [];
    const names = [];
    for (const piece of Object.values(answer?.slots ?? {})) {
        if (!piece || piece.broken === true) continue;
        if (typeof piece.name === 'string' && piece.name) names.push(piece.name);
        const bonus = {};
        for (const [, n, stat] of String(piece.bonus ?? '').matchAll(/\+(\d+)\s+([A-Za-z]+)/g)) {
            const at = GEAR_ORDER.indexOf(stat.toUpperCase() === 'LUK' ? 'WIS' : stat.toUpperCase());
            if (at >= 0) bonus[STAT_KEYS[at].toUpperCase()] = Number(n);
        }
        if (Object.keys(bonus).length) pieces.push({ bonus, rarity: piece.rarity });
    }
    return { cap: gearCap(pieces), names };
}

/** A member's effective stats with the gear bonus added to each, kept in 1..30: `{ str: 13, … }`. */
export function totalStats(member, cap = {}) {
    const total = {};
    const stats = effectiveStats(member);
    for (const key of STAT_KEYS) total[key] = effectiveStat(stats[key], cap[key.toUpperCase()] ?? 0);
    return total;
}
