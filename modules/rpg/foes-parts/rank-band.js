// Finds a rank's band of levels through the rank query, and words a foe's level with its rank.
import { FOE_LEVEL } from './level-basics.js';

/**
 * A rank's band `{ from, to }`, found with `rankAt(level)` → `{ name } | null` (the `rpg.rank` query): the levels 1..99 whose rank has this name
 * (compared without case); null when none has. A query that throws or answers nothing means no band.
 */
export function bandOfRank(name, rankAt) {
    const wanted = String(name ?? '').trim().toLowerCase();
    if (!wanted || typeof rankAt !== 'function') return null;
    let from = null, to = null;
    for (let level = FOE_LEVEL.min; level <= FOE_LEVEL.max; level += 1) {
        let found = null;
        try { found = rankAt(level); } catch { return null; }
        const hit = typeof found?.name === 'string' && found.name.trim().toLowerCase() === wanted;
        if (hit) { if (from === null) from = level; to = level; } else if (from !== null) break;
    }
    return from === null ? null : { from, to };
}

/** How a foe's level reads in a line: "Rank E · Lv 14" when `rankAt` names one, else "Lv 14". */
export function foeLabel(level, rankAt = null) {
    let name = null;
    try { name = typeof rankAt === 'function' ? rankAt(level)?.name ?? null : null; } catch { name = null; }
    return name ? `Rank ${name} · Lv ${level}` : `Lv ${level}`;
}
