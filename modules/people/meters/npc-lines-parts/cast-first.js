// A line about a pack person before their dossier was made (SFF4 #1). The dossier of a pack person is made from their pack entry after the reply that met
// them (runtime-cast-sync.js), so a `~ npc` line written in that reply, or in the next one, found no record and was refused, and its Level, abilities,
// keepsakes, goal and meters were lost. In lines mode, a line that names a pack person who is met, or whom this reply's own scene has present (the story
// named them), now makes that dossier inside the reply's own step, from the same entry and by the same rule (applyCastEntry), and their first meter entry as
// the meeting would (../npc-meters-parts/cast-bond.js); the line then applies to it. An unmet person the scene does not have stays unknown, as before.
// Everything is read from the reply's own state and queries, so a swipe, a Re-read and a replay make the same dossier.
import { labelKey } from '../../cast/key-people.js';
import { NPC_DOMAIN } from '../npc-meters-config.js';
import { makeNpcId } from '../../core/core-identity.js';
import { normalizeNpcRecord } from '../../core/core.js';
import { applyCastEntry, normalizeCast } from '../../dossier/cast-dossier.js';
import { CAST_QUERY } from '../npc-meters-slice.js';
import { seedCastBond } from '../npc-meters-parts/cast-bond.js';
import { stubRecord } from './derived.js';

const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;
const WORLD_EVENTS = 'story-director.world-events';
const ask = (ctx, name, args = {}) => { try { return ctx.query(name, args); } catch { return null; } };
const placeKey = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// A pack place's name for its id, slug, name or alias ('' when no enabled pack has it), as the dossier's starting place (the adapter's placeName, on ctx).
function placeNameOf(ctx, ref) {
    const wanted = placeKey(ref);
    if (!wanted) return '';
    const places = ask(ctx, 'packs.content', { kind: 'places' });
    for (const place of Array.isArray(places) ? places : []) {
        if (!place || typeof place.name !== 'string' || !place.name.trim()) continue;
        const slug = typeof place.id === 'string' ? place.id.slice(place.id.lastIndexOf('/') + 1) : place.slug;
        if ([place.name, slug, ...(Array.isArray(place.aliases) ? place.aliases : [])].some(word => placeKey(word) === wanted)) return place.name.trim();
    }
    return '';
}

// The pack person a name or alias is, met or present in this reply's scene, with their entry; null otherwise.
function castPersonNamed(ctx, name) {
    const asked = labelKey(name);
    const answer = ask(ctx, CAST_QUERY, { present: true });
    if (!asked || !Array.isArray(answer)) return null;
    const here = ask(ctx, 'scene.place', {});
    const where = typeof here?.name === 'string' ? here.name : '';
    // One not met yet is met here and now (the reply's scene): the dossier's place is this one, as the meeting at the end of the reply records it.
    const people = normalizeCast(answer.map(raw => (raw && typeof raw === 'object' && !raw.met ? { ...raw, met: { on: null, where } } : raw)));
    return people.find(person => person.alive && person.entry
        && [person.name, person.entry.name, ...person.aliases, ...(person.entry.aliases ?? [])].map(labelKey).includes(asked)) ?? null;
}

// Whether the reader removed this person's dossier before (their name is in the people's dismissed groups).
function dismissed(ctx, person) {
    const labels = new Set([person.name, person.entry.name, ...person.aliases].map(labelKey).filter(Boolean));
    const groups = ctx.read('people')?.userDismissedGroups;
    return (Array.isArray(groups) ? groups : []).some(group => (Array.isArray(group?.labels) ? group.labels : []).some(label => labels.has(labelKey(label))));
}

/**
 * `tools`: { baseline() → the base relationship values, bond(ctx, slice, who, person) → makes the first meter entry }. → (ctx, name) → the new dossier's
 * id, or null when the name is no pack person met or present here (the line is then refused as before).
 */
export function createCastFirst({ baseline, bond }) {
    return function castFirst(ctx, name) {
        const person = castPersonNamed(ctx, name);
        if (!person || dismissed(ctx, person)) return null;
        const people = ctx.read('people');
        const taken = [...Object.keys(people?.npcs ?? {}), ...Object.keys(ctx.read(NPC_DOMAIN)?.npcs ?? {})];
        const shown = person.entry.name || person.name;
        const id = makeNpcId(shown, taken);
        if (!PEOPLE_ID.test(id)) return null;
        const stamp = Number.isInteger(ctx.carrier?.index) ? ctx.carrier.index + 1 : 1;
        const packs = ask(ctx, 'packs.list', {});
        const packName = String((Array.isArray(packs) ? packs : []).find(pack => pack?.id === person.pack)?.name ?? '').trim();
        const filled = applyCastEntry(stubRecord({ name: shown, role: '', look: '' }, id, baseline(), stamp), person, {
            packName, gated: ctx.feature?.(WORLD_EVENTS) === true, placeName: ref => placeNameOf(ctx, ref),
        });
        if (!filled) return null;
        ctx.call('people.stub', { id, record: normalizeNpcRecord(filled) });
        bond(ctx, ctx.draft(NPC_DOMAIN), { key: id, name: shown }, person);
        return id;
    };
}
