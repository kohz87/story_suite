// A pack person's first meter entry: the pack's first meter values (by id or label), the resting mood of their temperament (feature mood-pull) and their
// first tastes and drives (feature notes). Shared by the step that notes a meeting (npc.tick) and the first line about a pack person met or present before
// their dossier was made (npc-lines-parts/cast-first.js), so both give the same entry. Pure on the reply's draft.
import { clean, slug } from '../npc-meters-config.js';
import { seedNotes } from '../../notes/npc-notes-kinds.js';
import { restMood, restingMood } from '../npc-mood.js';
import { asStored } from '../npc-meters-slice.js';

/**
 * Makes `who.key`'s entry in `slice.npcs` from `person.entry` (normalizeCast's entry). `tools`: { defs, ensure, note, moodPull, minutes, notesOn }.
 * → true when the entry was made; false when it was there already or could not be made (a meter list that is full).
 */
export function seedCastBond(ctx, slice, who, person, { defs, ensure, note, moodPull, minutes, notesOn }) {
    if (Object.hasOwn(slice.npcs, who.key)) return false;
    // The pack's first meter values (by id or label); a meter this chat does not have is a problem line, not an error.
    const byId = new Map(defs.flatMap(def => [[def.id, def], [slug(def.label), def]]));
    const seed = {};
    const unknown = [];
    for (const [name, value] of Object.entries(person.entry.meters.values)) {
        const def = byId.get(slug(name));
        if (def) seed[def.id] = value;
        else unknown.push(`${person.name}: "${clean(name, 40)}" is not a meter here (meters: ${defs.map(item => item.id).join(', ')}).`);
    }
    for (const [field, left] of Object.entries(person.entry.overflow ?? {})) if (left.length) unknown.push(`${person.name}: ${left.length} ${field} over NPC State's limit were not kept: ${clean(left.join(', '), 160)}.`);
    try { ensure(ctx, slice.npcs, who, defs, seed); } catch { return false; }
    // Temperament (feature mood-pull): a person whose pack words give a resting mood starts at it, so it is stored with the record.
    const rest = moodPull && Number.isInteger(minutes) && slice.npcs[who.key] ? restingMood(person.entry.personality, person.entry.role) : null;
    if (rest && (rest.v || rest.a || rest.d)) slice.npcs[who.key].mood = asStored(ctx, who.key, 'mood', restMood(rest, minutes));
    // Notes (feature notes): the pack's tastes and drives are the person's first, kept in the record's leaves.
    if (slice.npcs[who.key] && notesOn) Object.assign(slice.npcs[who.key], seedNotes(person.entry));
    note(slice, ctx.rev, unknown);
    return true;
}
