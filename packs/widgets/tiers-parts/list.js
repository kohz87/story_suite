// The tiers' data: the caps and the cleaned list of tiers and tiles that is drawn.

import { short } from './shared-short.js';

export const TIER_MAX = 12;
export const TILE_MAX = 24;

/** The tiers as drawn: at most TIER_MAX tiers of at most TILE_MAX tiles; a tile without a label or id is left out. */
export function tierList(list) {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
        if (!raw || typeof raw !== 'object') continue;
        const tiles = [];
        for (const t of Array.isArray(raw.tiles) ? raw.tiles : []) {
            if (!t || typeof t !== 'object') continue;
            const label = short(t.label, 60);
            const id = short(t.id, 64) || label;
            if (!id) continue;
            tiles.push({
                id, label: label || id, icon: typeof t.icon === 'string' ? t.icon : '', count: short(t.count, 6), state: typeof t.state === 'string' ? t.state : 'none',
                tone: typeof t.tone === 'string' ? t.tone : '', hint: short(t.hint, 60), kind: typeof t.kind === 'string' ? t.kind : '',
            });
            if (tiles.length >= TILE_MAX) break;
        }
        out.push({ title: short(raw.title, 60), tiles });
        if (out.length >= TIER_MAX) break;
    }
    return out;
}
