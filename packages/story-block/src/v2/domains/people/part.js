// The core part for the `people` domain: a core domain present from the first reply that writes it, with two writers on separate keys.
//   `people.write` (sent by NPC State after a change of its own, for the reply it stands on): the dossiers (order, npcs, candidates, …) and the scan marker;
//   it keeps `bonds`. `people.bonds` (called by a module's own command inside the reply's transaction: NPC State's change lines, its scan's meter moves,
//   the reader's meter edits): the per-person meters, stages and notes keyed by the same npc_ ids; it keeps everything else. Neither can overwrite the other.
// `people.hash` hashes the stored slice; with { dossiers: true } it leaves out `bonds` and `scan` (what NPC State's cache holds), null when no dossier is stored.
// The reader's narrow edits (people.edit, people.follow, people.portrait.set) are in ./edits.js; the read queries (people.list, .dossier, .ties, .secretOwners) in ./queries.js.

import { hashJson } from '../../../../../../core/replay.js';
import { isPeopleView, validatePeople } from './validate.js';
import { peopleEdits } from './edits.js';
import { peopleQueries } from './queries.js';

export const PEOPLE_DOMAIN = 'people';

const clone = value => JSON.parse(JSON.stringify(value));
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// The keys of the slice the dossier writer does not own: `bonds` (people.bonds) and `scan` (people.write's own `scan` field, never its view).
const OWN_KEYS = ['bonds', 'scan'];
// The slice a chat's first people write starts from, and what an absent people domain replays as (REPLAY.md "Deferred domains"): every
// container a later reply's leaf writes go into is here, so deleting the reply that made the slice keeps the later meter moves. (`scan`
// is stored as an array [lastSid, swipeKey, since], so every marker write is one whole replace and survives such a delete.)
const initialPeople = () => ({ v: 1, order: [], npcs: {}, bonds: { npcs: {}, problems: [] } });
const withoutOwn = slice => Object.fromEntries(Object.entries(slice).filter(([key]) => !OWN_KEYS.includes(key)));
const EMPTY = hashJson(withoutOwn(initialPeople()));

// The slice without `bonds` and `scan`, hashed; null when there is no slice or it holds no dossier part beyond the empty one (a slice made by people.bonds alone).
function dossierHash(slice) {
    if (slice === undefined || slice === null) return null;
    const hash = hashJson(withoutOwn(slice));
    return hash === EMPTY ? null : hash;
}

export function createPeoplePart() {
    return {
        domains: { [PEOPLE_DOMAIN]: { initial: initialPeople, deferred: true, snapshot: 'when-present', validate: validatePeople } },
        commands: {
            // Replaces the dossier keys of the people draft with the view, for the reply the view belongs to (`source`: { sid, swipeKey }); the store diffs it
            // into leaf ops. `bonds` stays as stored. `scan` ({ lastSid, swipeKey, since }), when given, replaces the stored scan marker; absent, it stays.
            'people.write': {
                internal: false,   // (sent through the public sdk by the sender; it is stored on the reply's carrier)
                handler(ctx, payload) {
                    const view = payload?.view;
                    if (!isPeopleView(view) || OWN_KEYS.some(key => Object.hasOwn(view, key))) return ctx.fail('INVALID', 'The people view is not sound; nothing was stored.');
                    const scan = payload.scan;
                    const marker = isObject(scan) ? [scan.lastSid, scan.swipeKey, scan.since] : null;   // (stored as an array: a diff replaces it whole)
                    if (scan !== undefined && (!marker || Object.keys(scan).length !== 3 || validatePeople({ ...view, scan: marker }).length)) return ctx.fail('INVALID', 'The scan marker is not sound; nothing was stored.');
                    const asked = payload?.source;
                    const here = ctx.source;
                    if (!here || !asked || asked.sid !== here.sid || (asked.swipeKey !== undefined && asked.swipeKey !== here.swipeKey)) {
                        return ctx.fail('STALE', 'The story moved on before the people were stored; nothing was stored.');
                    }
                    const draft = ctx.draft(PEOPLE_DOMAIN);
                    if (draft.v === undefined) Object.assign(draft, initialPeople());   // (the first write of a chat: the deferred domain starts here)
                    const kept = Object.fromEntries(OWN_KEYS.filter(key => draft[key] !== undefined).map(key => [key, draft[key]]));
                    for (const key of Object.keys(draft)) delete draft[key];
                    Object.assign(draft, clone(view), kept);
                    if (marker) draft.scan = marker;
                    return { summary: 'People stored.', narrate: false };
                },
            },
            // Replaces the stored `bonds` ({ npcs: { [npc_id]: record }, problems, keyAway?, cast? }) with the given one, inside the transaction of the module
            // command that calls it (ctx.call); a reader's button or a page cannot send it on its own. Every other key of the slice stays.
            'people.bonds': {
                internal: false,   // (a reader's own meter edit calls it through NPC State's command, which a ui cause may do; the caller check below holds it to modules)
                handler(ctx, payload) {
                    const caller = ctx.caller;
                    if (typeof caller !== 'string' || !caller || caller.startsWith('event:')) return ctx.fail('REFUSED', 'Only a module\'s own command may store the people\'s meters.');
                    const bonds = payload?.bonds;
                    if (!isObject(bonds) || validatePeople({ v: 1, order: [], npcs: {}, bonds }).length) return ctx.fail('INVALID', 'The people\'s meters are not sound; nothing was stored.');
                    const draft = ctx.draft(PEOPLE_DOMAIN);
                    if (hashJson(draft.bonds ?? initialPeople().bonds) === hashJson(bonds)) return { summary: 'People\'s meters unchanged.', narrate: false };
                    if (draft.v === undefined) Object.assign(draft, initialPeople());   // (the first write of a chat: the deferred domain starts here)
                    draft.bonds = clone(bonds);
                    return { summary: 'People\'s meters stored.', narrate: false };
                },
            },
            ...peopleEdits(PEOPLE_DOMAIN),
        },
        queries: {
            ...peopleQueries(PEOPLE_DOMAIN),
            // The hash of the stored people slice, to compare with a view's; { dossiers: true }: without `bonds` and `scan`, null when no dossier is stored.
            'people.hash': (state, args) => (args?.dossiers === true ? dossierHash(state?.domains?.[PEOPLE_DOMAIN]) : (state?.domains?.[PEOPLE_DOMAIN] === undefined ? null : hashJson(state.domains[PEOPLE_DOMAIN]))),
        },
    };
}
