// The pack's declared conditions (`content.conditions`, through `packs.content`). Pure.

import { ask } from '../queries-parts/shared-ask.js';

/** `[{ name, scope, fades, means }]` of the enabled packs, the first pack's entry for a name winning; [] when nothing is declared. */
export function declaredConditions(query) {
    const rows = ask(query, 'packs.content', { kind: 'conditions' });
    const seen = new Set();
    const out = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        if (typeof row?.name !== 'string' || seen.has(row.name)) continue;
        seen.add(row.name);
        out.push({ name: row.name, scope: row.scope, fades: row.fades ?? null, means: row.means ?? '' });
    }
    return out;
}
