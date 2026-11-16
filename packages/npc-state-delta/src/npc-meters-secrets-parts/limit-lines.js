// Per-NPC limits as editor lines and editor lines back to limits.
import { MAX_METERS_PER_NPC, slug } from '../npc-meters-config.js';
import { normalizeLimits } from '../npc-meters-presets.js';

/**
 * Per-NPC limits as editor lines: `trust: floor -20, ceiling 60` (one meter per line), and back.
 * Lines read `meter: ceiling N` / `max N` / `floor N` / `min N` (either or both); others are problems.
 */
export function limitsToLines(limits) {
    return Object.entries(normalizeLimits(limits))
        .map(([meter, limit]) => `${meter}: ${[limit.floor !== undefined ? `floor ${limit.floor}` : '', limit.ceiling !== undefined ? `ceiling ${limit.ceiling}` : ''].filter(Boolean).join(', ')}`)
        .join('\n');
}
export function limitsFromLines(text) {
    const limits = {};
    const problems = [];
    for (const line of String(text ?? '').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = /^([\p{L}][\p{L}\p{N} _-]*?)\s*:\s*(.+)$/u.exec(trimmed);
        const meter = match ? slug(match[1]) : '';
        const limit = {};
        let ok = Boolean(meter);
        for (const part of match ? match[2].split(/[,;]/) : []) {
            const piece = /^\s*(ceiling|max|floor|min)\s*[:=]?\s*([+\-−]?\d{1,4})\s*$/iu.exec(part);
            if (!piece) { ok = false; break; }
            limit[/^(?:ceiling|max)$/i.test(piece[1]) ? 'ceiling' : 'floor'] = Number(piece[2].replace('−', '-'));
        }
        const normalized = ok ? normalizeLimits({ [meter]: limit })[meter] : null;
        if (!normalized || Object.keys(limits).length >= MAX_METERS_PER_NPC) { problems.push(trimmed); continue; }
        limits[meter] = normalized;
    }
    return { limits, problems };
}
