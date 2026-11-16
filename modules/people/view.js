// The people view: turns an NSD sidecar state into the plain, clock-free `people` slice that the Story
// Block store keeps (records keyed by id, in order), and turns that slice back into the sidecar's people
// keys. NSD's history, rollback and scheduler keys are left out on purpose. Pure: no I/O, no host.
// `peopleState` turns the stored slice back into the people keys (PEOPLE_KEYS): the hydrate of src/adapter/people-sync.js uses it.

export const PEOPLE_KEYS = Object.freeze(['npcs', 'candidates', 'dismissed', 'userDismissedGroups', 'socialGraph', 'portraitAssets', 'turn']);

// Date.now-valued keys; dropped only when the value is a number or null (the golden's own rule).
const VOLATILE = new Set(['updatedAt', 'createdAt', 'archivedAt', 'correctedAt', 'at']);
const isPlain = value => !!value && typeof value === 'object' && !Array.isArray(value);

// A deep plain-JSON copy without the clock fields and without undefined values.
export function stripVolatile(value) {
    if (Array.isArray(value)) return value.map(item => (item === undefined ? null : stripVolatile(item)));
    if (!isPlain(value)) return value;
    const out = {};
    for (const key of Object.keys(value)) {
        const item = value[key];
        if (item === undefined) continue;
        if (VOLATILE.has(key) && (typeof item === 'number' || item === null)) continue;
        out[key] = stripVolatile(item);
    }
    return out;
}

const list = value => (Array.isArray(value) ? value : []);

// Portraits go to the store as file references only (the people domain refuses image bytes, and one data URL would make every write of the chat INVALID).
// `noBytes` drops every `dataUrl` key and every data-URL string (NPC State still makes such records when a portrait file write fails); `fileRefs`
// keeps only the portraitAssets entries that are `{ path, type, hash }`. A portrait held only as bytes stays in NPC State's memory, not in the store.
const IMAGE_BYTES = /^data:[^,]{0,100};base64,/i;
function noBytes(value) {
    if (Array.isArray(value)) return value.filter(item => !(typeof item === 'string' && IMAGE_BYTES.test(item))).map(noBytes);
    if (typeof value === 'string') return value;
    if (!isPlain(value)) return value;
    const out = {};
    for (const key of Object.keys(value)) {
        const item = value[key];
        if (key === 'dataUrl' || (typeof item === 'string' && IMAGE_BYTES.test(item))) continue;
        out[key] = noBytes(item);
    }
    return out;
}
const isFileRef = record => isPlain(record) && typeof record.path === 'string' && record.path !== '' && typeof record.type === 'string' && typeof record.hash === 'string';
const fileRefs = assets => Object.fromEntries(Object.entries(assets).filter(([, record]) => isFileRef(record)));

// A name or id in `socialGraph.unresolved[].ownerId` becomes the person's npc_ id (found by id, name or alias) or '' (the store refuses anything else for the whole write).
const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;
function ownerIds(graph, records) {
    if (!isPlain(graph) || !Array.isArray(graph.unresolved)) return graph;
    const find = text => {
        const wanted = String(text ?? '').trim().toLowerCase();
        const hit = wanted ? records.find(r => isPlain(r) && (String(r.id ?? '').toLowerCase() === wanted || String(r.name ?? '').toLowerCase() === wanted || (Array.isArray(r.aliases) && r.aliases.some(a => String(a).trim().toLowerCase() === wanted)))) : null;
        return hit && PEOPLE_ID.test(String(hit.id)) ? hit.id : '';
    };
    const unresolved = graph.unresolved.map(slot => (isPlain(slot) && slot.ownerId !== undefined && slot.ownerId !== null && slot.ownerId !== '' && !PEOPLE_ID.test(String(slot.ownerId)) ? { ...slot, ownerId: find(slot.ownerId) } : slot));
    return { ...graph, unresolved };
}

/** The cache's people the store's keys lack (by id), added to the keys: a change made before the first hydrate is not thrown away by it. */
export function peopleCarry(keys, state) {
    if (!isPlain(keys) || !isPlain(state) || !Array.isArray(state.npcs)) return keys;
    const have = new Set(list(keys.npcs).map(record => record?.id));
    const extra = state.npcs.filter(record => isPlain(record) && typeof record.id === 'string' && !have.has(record.id));
    return extra.length ? { ...keys, npcs: [...list(keys.npcs), ...structuredClone(extra)] } : keys;
}

// state -> { v, order, npcs, ...} or null (with a warning) when an id is missing or repeated.
export function peopleView(state, { warn = () => {} } = {}) {
    if (!isPlain(state)) { warn('people view: no state'); return null; }
    const order = [];
    const npcs = {};
    for (const record of list(state.npcs)) {
        const id = isPlain(record) && typeof record.id === 'string' ? record.id : '';
        if (!id) { warn('people view: a record has no id'); return null; }
        if (Object.prototype.hasOwnProperty.call(npcs, id)) { warn(`people view: duplicate id ${id}`); return null; }
        order.push(id);
        npcs[id] = noBytes(stripVolatile(record));
    }
    return {
        v: 1,
        order,
        npcs,
        candidates: noBytes(stripVolatile(list(state.candidates))),
        dismissed: noBytes(stripVolatile(list(state.dismissed))),
        userDismissedGroups: noBytes(stripVolatile(list(state.userDismissedGroups))),
        socialGraph: ownerIds(noBytes(stripVolatile(isPlain(state.socialGraph) ? state.socialGraph : {})), list(state.npcs)),
        portraitAssets: fileRefs(noBytes(stripVolatile(isPlain(state.portraitAssets) ? state.portraitAssets : {}))),
        turn: Number.isFinite(state.turn) ? state.turn : 0,
    };
}

// view -> the sidecar's people keys (PEOPLE_KEYS only), or null when the view is malformed.
export function peopleState(view) {
    if (!isPlain(view) || view.v !== 1 || !Array.isArray(view.order) || !isPlain(view.npcs)) return null;
    const keys = Object.keys(view.npcs);
    if (view.order.length !== keys.length || !view.order.every(id => Object.prototype.hasOwnProperty.call(view.npcs, id))) return null;
    if (new Set(view.order).size !== view.order.length) return null;
    return {
        npcs: view.order.map(id => stripVolatile(view.npcs[id])),
        candidates: stripVolatile(list(view.candidates)),
        dismissed: stripVolatile(list(view.dismissed)),
        userDismissedGroups: stripVolatile(list(view.userDismissedGroups)),
        socialGraph: stripVolatile(isPlain(view.socialGraph) ? view.socialGraph : {}),
        portraitAssets: stripVolatile(isPlain(view.portraitAssets) ? view.portraitAssets : {}),
        turn: Number.isFinite(view.turn) ? view.turn : 0,
    };
}
