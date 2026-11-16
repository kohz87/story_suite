// The people view: turns an NSD sidecar state into the plain, clock-free `people` slice that the Story
// Block store keeps (records keyed by id, in order), and turns that slice back into the sidecar's people
// keys. NSD's history, rollback and scheduler keys are left out on purpose. Pure: no I/O, no host.
// `peopleState` and `PEOPLE_KEYS` serve the coming read-back path (J08), which turns the stored slice back into sidecar keys; nothing in src/ calls them yet.

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
        npcs[id] = stripVolatile(record);
    }
    return {
        v: 1,
        order,
        npcs,
        candidates: stripVolatile(list(state.candidates)),
        dismissed: stripVolatile(list(state.dismissed)),
        userDismissedGroups: stripVolatile(list(state.userDismissedGroups)),
        socialGraph: stripVolatile(isPlain(state.socialGraph) ? state.socialGraph : {}),
        portraitAssets: stripVolatile(isPlain(state.portraitAssets) ? state.portraitAssets : {}),
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
