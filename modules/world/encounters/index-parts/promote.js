// Promotion: a recurring backdrop person the story names in the reply that showed them, and whom NPC State now has a dossier for, is
// bound to that dossier: from then on the table and the note use the person, not "the ferryman". Pure.

import { namedIn } from '../../../cast/cast/world.js';

const SMALL = new Set(['the', 'and', 'with', 'from', 'their', 'them', 'some', 'who', 'one', 'old', 'young', 'pair', 'man', 'woman']);
const wordsOf = text => String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 3 && !SMALL.has(word));
const sameWord = (a, b) => a === b || `${a}s` === b || `${b}s` === a;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The binding for reply `entry` (its result: a recurring backdrop not yet bound), or null: the one dossier in `npcs` (NPC State's people,
 * by id) that the shown `text` names, that is no pack person (`castFrom`), that no other backdrop is bound to, and whose role shares a
 * word with who the backdrop is ("the ferryman" / role "ferryman"). Two or more fit: none (no guessing).
 */
export function promotionOf({ entry, npcs = {}, text = '', bound = {} }) {
    if (!entry || entry.kind !== 'backdrop' || !entry.recurring || entry.name || !entry.ref) return null;
    const wanted = wordsOf(entry.who);
    if (!wanted.length) return null;
    const taken = new Set(Object.entries(bound).filter(([ref]) => ref !== entry.ref).map(([, item]) => item?.key));
    const fits = [];
    for (const id of Object.keys(isRecord(npcs) ? npcs : {}).sort()) {
        const npc = npcs[id];
        if (!isRecord(npc) || npc.castFrom || taken.has(id) || typeof npc.name !== 'string' || !npc.name.trim()) continue;
        if (!wordsOf(npc.role).some(word => wanted.some(want => sameWord(word, want)))) continue;
        if (namedIn(npc, text)) fits.push({ ref: entry.ref, key: id, name: npc.name.trim() });
    }
    return fits.length === 1 ? fits[0] : null;
}
