// The reader's questions about the people domain, answered from the stored slice alone (pure over the state, so a swipe, a delete, a rewind or a reload
// answers what the head holds): `people.list` (one row per stored, not archived person), `people.dossier` (one person's stored fields plus their meters),
// `people.ties` (the social graph's edges between stored people) and `people.secretOwners` (whose dossier holds a secret of that title).
// Definitions: here = the record's `present` flag (NPC State sets it from the reply); dormant = 30 or more replies (the slice's `turn` minus the record's
// `lastSeenTurn`) unseen, never for someone present, followed, deceased or without a `lastSeenTurn` (decision 36.12; the party is excluded by the caller).
// A portrait is the file path of its file reference, when that is a safe URL (a path on the page's own server, or https); never image bytes.

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' && value.trim() ? value.trim() : null);
const clone = value => JSON.parse(JSON.stringify(value));
export const DORMANT_AFTER = 30;
const AXES = ['trust', 'affection', 'desire', 'tension'];
// What a dossier answer never carries (NPC State's own rule: hidden notes and never-prompt settings do not leave the dossier): the `secrets` list (titles, text and event wording of hidden notes: a locked note must stay hidden, and the stored rules lose their `at`, see people/view.js VOLATILE), and these fields.
const HIDDEN_FIELDS = ['portraitPromptPositive', 'portraitPromptNegative', 'portraitPromptReplace', 'portraitSeed', 'meterSetup', 'castFrom'];

// A file path that is safe as an image URL, as NPC State's safeImageUrl judges one: a path on the page's own server (relative or from the root; never `//host`,
// a bare ?query or #hash, a backslash or a control character) or https. Any other scheme is refused.
function safeUrl(value) {
    const url = text(value);
    if (!url || /[\u0000-\u001f\u007f\\]/.test(url) || /^[?#]/.test(url) || url.startsWith('//')) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return /^https:\/\/[^/\s]+/i.test(url) ? url : null;
    return url;
}

function portraitOf(slice, id, record) {
    const ref = isObject(slice.portraitAssets) && isObject(slice.portraitAssets[id]) ? slice.portraitAssets[id] : (isObject(record.portrait) ? record.portrait : null);
    return ref ? safeUrl(ref.path) : null;
}

// The four meters of a person: the bonds entry's, else the record's own relationship numbers, else null.
function metersOf(bond, record) {
    const source = [bond?.meters, record.relationship].find(item => isObject(item) && AXES.some(axis => Number.isFinite(Number(item[axis]))));
    return source ? Object.fromEntries(AXES.map(axis => [axis, Number.isFinite(Number(source[axis])) ? Number(source[axis]) : 0])) : null;
}

const active = (slice, id) => isObject(slice.npcs?.[id]) && slice.npcs[id].archived !== true;
const ids = slice => (Array.isArray(slice?.order) ? slice.order.filter(id => active(slice, id)) : []);

function dormantOf(slice, record) {
    if (record.present === true || record.followed === true || record.lifeState === 'deceased') return false;
    return Number.isInteger(record.lastSeenTurn) && Number.isInteger(slice.turn) && slice.turn - record.lastSeenTurn >= DORMANT_AFTER;
}

function rowOf(slice, id) {
    const record = slice.npcs[id];
    const bond = slice.bonds?.npcs?.[id];
    return {
        id, name: String(record.name ?? ''), aliases: Array.isArray(record.aliases) ? record.aliases.filter(item => typeof item === 'string') : [],
        role: text(record.role), mood: text(record.mood), location: text(record.location), status: text(record.status),
        present: record.present === true, followed: record.followed === true,
        lifeState: text(record.lifeState), lifeStateCertainty: text(record.lifeStateCertainty), lifeStateReason: text(record.lifeStateReason),
        lastSeenTurn: Number.isInteger(record.lastSeenTurn) ? record.lastSeenTurn : null, dormant: dormantOf(slice, record),
        meters: metersOf(bond, record), portrait: portraitOf(slice, id, record),
    };
}

// The person a name, alias or id names, among the active ones (case-insensitive, exact); null when nobody or when two people share it.
function find(slice, args) {
    const wanted = String(args?.id ?? args?.name ?? '').trim().toLowerCase();
    if (!wanted) return null;
    const hits = ids(slice).filter(id => id.toLowerCase() === wanted || String(slice.npcs[id].name ?? '').trim().toLowerCase() === wanted
        || (Array.isArray(slice.npcs[id].aliases) && slice.npcs[id].aliases.some(alias => String(alias).trim().toLowerCase() === wanted)));
    return hits.length === 1 ? hits[0] : null;
}

/** The read queries of the people domain named `domain`; each answers null when the chat has no people slice. */
export function peopleQueries(domain) {
    const slice = state => (isObject(state?.domains?.[domain]) && isObject(state.domains[domain].npcs) ? state.domains[domain] : null);
    return {
        // [row] in dossier order: { id, name, aliases, role, mood, location, status, present, followed, lifeState, lifeStateCertainty, lifeStateReason,
        // lastSeenTurn, dormant, meters | null, portrait | null }.
        'people.list': state => {
            const people = slice(state);
            return people ? ids(people).map(id => rowOf(people, id)) : null;
        },
        // { id, ...the stored dossier fields (the portrait file is `portrait` below; `secrets` are left out as in npc.dossier; never-prompt settings too), meters?, stages?, unlocked?, recent?, portrait } of the person { id | name } names, or null.
        'people.dossier': (state, args) => {
            const people = slice(state);
            const id = people ? find(people, args) : null;
            if (!id) return null;
            const { portrait: _file, ...record } = clone(people.npcs[id]);
            for (const field of HIDDEN_FIELDS) delete record[field];
            const bond = people.bonds?.npcs?.[id];
            delete record.secrets;
            const meters = metersOf(bond, record);
            return {
                ...record, id, ...(meters ? { relationship: meters } : {}),
                ...(isObject(bond?.meters) ? { meters: bond.meters } : {}), ...(isObject(bond?.stages) ? { stages: clone(bond.stages) } : {}),
                ...(Array.isArray(bond?.unlocked) ? { unlocked: clone(bond.unlocked) } : {}), ...(Array.isArray(bond?.recent) ? { recent: clone(bond.recent) } : {}),
                portrait: portraitOf(people, id, people.npcs[id]),
            };
        },
        // [{ aId, bId, aToB, bToA }] of the social graph's edges whose two ends are stored, active people.
        'people.ties': state => {
            const people = slice(state);
            if (!people) return null;
            const edges = Array.isArray(people.socialGraph?.edges) ? people.socialGraph.edges : [];
            return edges.filter(edge => isObject(edge) && active(people, edge.aId) && active(people, edge.bId))
                .map(edge => ({ aId: edge.aId, bId: edge.bId, aToB: String(edge.aToB ?? ''), bToA: String(edge.bToA ?? '') }));
        },
        // { [lowercase secret title or id]: { id, name } }: whose dossier holds each OPENED secret (a locked note's title is never a key).
        'people.secretOwners': state => {
            const people = slice(state);
            if (!people) return null;
            const out = {};
            for (const id of ids(people)) {
                const unlocked = Array.isArray(people.bonds?.npcs?.[id]?.unlocked) ? people.bonds.npcs[id].unlocked : [];
                for (const secret of Array.isArray(people.npcs[id].secrets) ? people.npcs[id].secrets : []) {
                    if (!isObject(secret) || !unlocked.includes(secret.id)) continue;
                    for (const key of [secret?.title, secret?.id]) {
                        const label = text(key)?.toLowerCase();
                        if (label && !Object.hasOwn(out, label)) out[label] = { id, name: String(people.npcs[id].name ?? '') };
                    }
                }
            }
            return out;
        },
    };
}
