// The pack's declared conditions (`content.conditions`, through `packs.content`). Pure.

import { ask } from '../queries-parts/shared-ask.js';

/**
 * `[{ name, scope, fades, means, placeStatus?, effects?, open? }]` of the enabled packs, the first pack's entry for a name winning; [] when
 * nothing is declared. `placeStatus`, `effects` (told prices, route effects) and `open` only when the pack writes them (spec §2).
 */
export function declaredConditions(query) {
    const rows = ask(query, 'packs.content', { kind: 'conditions' });
    const seen = new Set();
    const out = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        if (typeof row?.name !== 'string' || seen.has(row.name)) continue;
        seen.add(row.name);
        out.push({
            name: row.name, scope: row.scope, fades: row.fades ?? null, means: row.means ?? '',
            ...(row.placeStatus === true ? { placeStatus: true } : {}), ...(row.effects && typeof row.effects === 'object' ? { effects: row.effects } : {}), ...(row.open === true ? { open: true } : {}),
        });
    }
    return out;
}
