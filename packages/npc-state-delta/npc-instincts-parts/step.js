// The per-NPC step of the tick: the private track memory, then the instinct values and pull from it.
import { idOf, dayOf, samePlace } from './shared-input.js';
import { readInstincts } from './pull.js';

// ---- the per-NPC step (the tick's one call; pure) ----
// `track` is the private memory the readers need and the state does not otherwise keep: whether the NPC was in the party,
// the day they were benched or joined, the day each open thread naming them was first seen, and up to PLACES_MAX places
// they were present at. facts: { day, party: true|false|null (null = no party answer), awayDay: int|null, threads:
// [{ id, title, opened?: day }] (open threads that name them), here: place name | '', present: boolean }.
// → { track, inst, pull } with `track` and `pull` left out when empty. All whole numbers and short plain text.
export const PLACES_MAX = 6;
export const THREADS_MAX = 6;
const SELF = 'self';
export function stepPull(before, facts) {
    const prior = before && typeof before === 'object' ? before : {};
    const day = dayOf(facts?.day);
    if (day === null) return { track: prior, inst: { belo: 0, clos: 0, awe: 0 }, pull: null };
    const track = {};
    const wasIn = prior.party;
    if (facts.party === true) { track.party = 1; if (wasIn === 0) track.join = day; else if (prior.join !== undefined) track.join = prior.join; }
    else if (facts.party === false) { track.party = 0; if (wasIn === 1) track.bench = day; else if (prior.bench !== undefined) track.bench = prior.bench; }
    else for (const key of ['party', 'join', 'bench']) if (prior[key] !== undefined) track[key] = prior[key];
    const seen = {};
    const threads = [];
    for (const row of (Array.isArray(facts.threads) ? facts.threads : []).slice(0, THREADS_MAX)) {
        const id = idOf(row?.id);
        if (!id) continue;
        // The thread's own opening day when the host gives it (facts.threads[].opened), else the day this person's record first saw it.
        const first = dayOf(row.opened) ?? dayOf(prior.threads?.[id]) ?? day;
        seen[id] = Math.min(first, day);
        threads.push({ id, open: true, title: row.title, openedDay: seen[id], people: [SELF] });
    }
    if (threads.length) track.threads = seen;
    const known = Array.isArray(prior.places) ? prior.places.filter(name => typeof name === 'string').slice(-PLACES_MAX) : [];
    const here = idOf(facts.here);
    const places = [...known];
    if (here && facts.present === true && !known.some(name => samePlace(name, here))) places.push(here);
    if (places.length) track.places = places.slice(-PLACES_MAX);
    const { inst, pressure } = readInstincts({
        id: SELF, day, here: facts.present === true ? here : '',
        // The first place ever seen is the baseline, not an arrival: awe needs a history.
        visited: known.length ? known : null,
        benched: track.bench !== undefined && track.party === 0 ? [{ id: SELF, since: track.bench }] : [],
        keyPeople: dayOf(facts.awayDay) !== null ? [{ id: SELF, away: true, since: facts.awayDay }] : [],
        joins: track.join !== undefined ? [{ id: SELF, day: track.join }] : [],
        threads, scale: facts.scale,
    });
    return { track, inst, pull: pressure };
}
