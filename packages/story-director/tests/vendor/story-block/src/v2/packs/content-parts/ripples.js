// The ripples table of the first enabled pack, and the choice a Director makes from it.

import { copy } from './shared-copy.js';

/**
 * The ripples table of the first enabled pack (in list order) that has one, as `{ pack, powers, tiers?, caps?, worldDirections?, standingModule? }`,
 * or null. Read by Story Director's ripples part (a hidden sway per power from the player's deeds); tables are not mixed across packs.
 */
export function ripplesOf(packs, args = {}) {
    const wanted = args?.pack ?? null;
    const pack = packs.find(entry => entry.ripples && (!wanted || entry.id === wanted));
    return pack ? copy({ pack: pack.id, ...pack.ripples }) : null;
}

// Ask only for rows known to come from this pack. Older Directors use the first table globally;
// when that is another pack the safe answer is the authored fallback, until scoped sway is available.
export function rippleChoice(packs, args = {}, tools = {}) {
    const { pack, ids, exclude = '', pick = 'top', fallback = null } = args ?? {};
    if (typeof pack !== 'string' || !pack) return null;
    const wanted = typeof ids === 'string' ? ids.split(',').map(id => id.trim()) : [];
    if (!wanted.length || new Set(wanted).size !== wanted.length || !['top', 'bottom'].includes(pick)) return null;
    const table = ripplesOf(packs, { pack });
    if (!table || table.powers.length !== wanted.length || table.powers.some((power, i) => power.id !== wanted[i])) return fallback;
    const allowed = wanted.filter(id => id !== exclude);
    if (!allowed.includes(fallback)) return null;
    let rows;
    if (tools.hasQuery?.('ripples.packSway')) {
        const answer = tools.query('ripples.packSway', { pack });
        if (answer?.pack !== pack) return fallback;
        rows = answer.rows;
    } else {
        if (ripplesOf(packs)?.pack !== pack || !tools.hasQuery?.('ripples.sway')) return fallback;
        rows = tools.query('ripples.sway', {});
    }
    if (!Array.isArray(rows) || rows.length !== wanted.length || rows.some((row, i) => row?.id !== wanted[i] || !Number.isFinite(row.sway))) return fallback;
    const pool = rows.filter(row => allowed.includes(row.id));
    return pool.reduce((best, row) => (pick === 'top' ? row.sway > best.sway : row.sway < best.sway) ? row : best).id;
}
