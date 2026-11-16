// Levels: rank bands, the rank a level is in, and the level label.

import { isObject, whole } from './shared-guards.js';
import { LEVEL_MAX, LEVEL_MIN, clampLevel } from './bounds.js';

/** `ranks` as a clean list: the entries that are whole bands with a name, ascending by `from` (a damaged list gives what is whole). */
export function bandsOf(ranks) {
    if (!Array.isArray(ranks)) return [];
    return ranks.filter(rank => isObject(rank) && typeof rank.name === 'string' && rank.name && whole(rank.from) && whole(rank.to) && rank.from >= LEVEL_MIN && rank.to <= LEVEL_MAX && rank.from <= rank.to)
        .map(({ name, from, to }) => ({ name, from, to })).sort((a, b) => a.from - b.from);
}

/** The rank whose band holds `level`: { name, from, to }, or null. */
export function rankOf(level, ranks) {
    if (!whole(level)) return null;
    return bandsOf(ranks).find(rank => level >= rank.from && level <= rank.to) ?? null;
}

/**
 * The label for a level. Without `playerRank` (a foe, or a character with no player-rank source): "Rank E · Lv 14" with a rank for the level, else "Lv 14".
 * With the pack's `playerRank` { module, field, label } (a party member): "Lv 14 · Guild F" when `value` (the field's current value, playerRankValue) is
 * filled, else "Lv 14" alone.
 */
export function levelLabel(level, ranks, { playerRank = null, value } = {}) {
    const shown = clampLevel(level);
    if (isObject(playerRank)) {
        const text = typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim() : '';
        const label = typeof playerRank.label === 'string' ? playerRank.label.trim() : '';
        return text ? `Lv ${shown} · ${label ? `${label} ` : ''}${text}` : `Lv ${shown}`;
    }
    const rank = rankOf(shown, ranks);
    return rank ? `Rank ${rank.name} · Lv ${shown}` : `Lv ${shown}`;
}

/** A rank by name (case and spacing folded) → { name, from, to } | null. */
export function rankNamed(name, ranks) {
    const key = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().toLowerCase() : '';
    return key ? bandsOf(ranks).find(rank => rank.name.toLowerCase() === key) ?? null : null;
}
