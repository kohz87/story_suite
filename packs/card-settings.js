// The settings a card may recommend, and who owns them (pure): `sdk.registerCardSettings`.
//
// An owner (Story Block itself as `story-block`, NPC State as `npc-state-delta`) registers its allow-listed keys with how to
// name, read, check and apply them. The card offer asks this registry what differs from the player's current settings and, after the
// player's click, hands each owner its own values to apply. Story Block never writes another extension's settings: an owner applies its
// own, exactly as its own Save does. An owner that is not registered is an extension that is not installed.
//
// register({ owner, label, keys: { <key>: { label, valueText(v) → string, valid(v) → bool } }, read(key) → value,
//            apply(values) → Promise<{ applied: [key] }>,
//            sections?: { <game pack content key>: { read() → value | undefined, apply(value) → Promise<boolean> } } }) → unregister()
//
// `sections` is the other use of the same registration: "Export settings as a game pack" (packs/game-export.js) asks each owner for the
// section of a game pack's `content` it holds (`read`; undefined: nothing worth exporting), and re-importing hands a section back (`apply`).
// A card never reaches a section; an owner with `sections` only may leave `keys` out.
// `loadSections: async () => <the same object as `sections`>` offers sections whose code is fetched only when asked (the page start does not
// carry it): `loadSections()` on the registry awaits every such owner once; `sections()` lists what is loaded so far.

const OWNER = /^[a-z][a-z0-9-]*$/;
const KEY = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Why an owner that is not registered matters, in plain words (named when the card recommends one of its settings). */
export const OWNER_NEEDS = Object.freeze({
    'npc-state-delta': 'Needs NPC State for portraits and dossiers',
});

const same = (a, b) => {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

/** The owner ids only Story Block itself registers (through `registerOwn`): a module's `registerCardSettings` is refused for them. */
export const RESERVED_OWNERS = Object.freeze(['story-block']);

export function createCardSettings() {
    const owners = new Map();
    const listeners = new Set();
    const tell = () => { for (const fn of [...listeners]) { try { fn(); } catch { /* a listener never stops the others */ } } };

    function register(spec, { own = false } = {}) {
        const bad = message => { throw new TypeError(`registerCardSettings: ${message}`); };
        if (!spec || typeof spec !== 'object') bad('a definition is needed.');
        if (typeof spec.owner !== 'string' || !OWNER.test(spec.owner)) bad('"owner" must be a module id such as "story-block".');
        if (!own && RESERVED_OWNERS.includes(spec.owner)) bad(`"${spec.owner}" is Story Block's own owner; another module registers under its own id.`);
        if (typeof spec.label !== 'string' || !spec.label) bad('"label" must be text.');
        const sectionsOnly = spec.keys === undefined && (spec.sections !== undefined || spec.loadSections !== undefined);
        if (!sectionsOnly && (typeof spec.read !== 'function' || typeof spec.apply !== 'function')) bad('"read" and "apply" must be functions.');
        const sections = {};
        if (spec.loadSections !== undefined && typeof spec.loadSections !== 'function') bad('"loadSections" must be a function.');
        const add = (name, def) => {
            if (!KEY.test(name)) bad(`"${name}" is not a section name.`);
            if (!def || typeof def.read !== 'function' || typeof def.apply !== 'function') bad(`section "${name}" needs read() and apply(value).`);
            for (const other of owners.values()) if (other.owner !== spec.owner && other.sections[name]) bad(`section "${name}" already belongs to ${other.label}.`);
            sections[name] = { read: def.read, apply: def.apply };
        };
        if (spec.sections !== undefined) {
            if (!spec.sections || typeof spec.sections !== 'object' || Array.isArray(spec.sections)) bad('"sections" must be an object of game pack sections.');
            for (const [name, def] of Object.entries(spec.sections)) add(name, def);
        }
        const given = spec.keys ?? {};
        if (typeof given !== 'object' || Array.isArray(given) || (!Object.keys(given).length && !Object.keys(sections).length && !spec.loadSections)) bad('"keys" must name at least one setting.');
        const keys = {};
        for (const [key, def] of Object.entries(given)) {
            if (!KEY.test(key)) bad(`"${key}" is not a setting name.`);
            if (!def || typeof def.label !== 'string' || typeof def.valueText !== 'function' || typeof def.valid !== 'function') bad(`"${key}" needs label, valueText(v) and valid(v).`);
            keys[key] = { label: def.label, valueText: def.valueText, valid: def.valid };
        }
        const entry = { owner: spec.owner, label: spec.label, keys, read: spec.read ?? (() => undefined), apply: spec.apply ?? (async () => ({ applied: [] })), sections, pending: spec.loadSections ?? null };
        entry.add = add;
        owners.set(entry.owner, entry);
        tell();
        return () => {
            if (owners.get(entry.owner) === entry) { owners.delete(entry.owner); tell(); }
        };
    }

    /**
     * What a card's recommended values would change: `{ items, missing, lines }`.
     * `items`: `[{ id: 'owner.key', owner, key, label, text: 'RPG on', value }]`, only the keys whose current value differs;
     * `missing`: owners that are not registered (their keys are dropped); `lines`: Diagnostics lines for keys the owner does not
     * list or values it says are not valid.
     */
    function plan(values) {
        const items = [];
        const missing = [];
        const lines = [];
        for (const [id, value] of Object.entries(values ?? {})) {
            const dot = id.indexOf('.');
            const owner = id.slice(0, dot);
            const key = id.slice(dot + 1);
            const entry = owners.get(owner);
            if (!entry) { if (!missing.includes(owner)) missing.push(owner); continue; }
            const def = entry.keys[key];
            if (!def) { lines.push(`Card setting ${id.slice(0, 80)} skipped: ${entry.label} does not list it.`); continue; }
            let ok = false;
            try { ok = def.valid(value) === true; } catch { ok = false; }
            if (!ok) { lines.push(`Card setting ${id.slice(0, 80)} skipped: ${entry.label} does not accept that value.`); continue; }
            let current;
            try { current = entry.read(key); } catch { current = undefined; }
            if (same(current, value)) continue;
            let text = '';
            try { text = String(def.valueText(value)); } catch { text = ''; }
            items.push({ id, owner, key, label: def.label, text: `${def.label} ${text}`.trim(), value });
        }
        return { items, missing, lines };
    }

    /**
     * Hands each owner its values (one call per owner) and says what was applied: `{ applied: [item], failed: [{ id, message }] }`.
     * A key counts only if the owner lists it in `applied`.
     */
    async function apply(items) {
        const applied = [];
        const failed = [];
        const by = new Map();
        for (const item of items ?? []) {
            if (!by.has(item.owner)) by.set(item.owner, []);
            by.get(item.owner).push(item);
        }
        for (const [owner, list] of by) {
            const entry = owners.get(owner);
            if (!entry) { for (const item of list) failed.push({ id: item.id, message: `${owner} is not available.` }); continue; }
            let answer = null;
            try {
                answer = await entry.apply(Object.fromEntries(list.map(item => [item.key, item.value])));
            } catch (error) {
                for (const item of list) failed.push({ id: item.id, message: `${entry.label} could not apply it (${error?.message ?? error}).` });
                continue;
            }
            const done = new Set(Array.isArray(answer?.applied) ? answer.applied : []);
            for (const item of list) {
                if (done.has(item.key)) applied.push(item);
                else failed.push({ id: item.id, message: `${entry.label} did not apply it.` });
            }
        }
        return { applied, failed };
    }

    return {
        register: spec => register(spec),
        /** Story Block's own registration (runtime.js): the only way to take a reserved owner. */
        registerOwn: spec => register(spec, { own: true }),
        plan,
        apply,
        /** The game pack sections the owners hold: `[{ owner, label, section, read, apply }]`, in registration order. */
        sections: () => [...owners.values()].flatMap(entry => Object.entries(entry.sections).map(([section, def]) => ({ owner: entry.owner, label: entry.label, section, read: def.read, apply: def.apply }))),
        /** Fetches the sections owners offered through `loadSections` (once each; a loader that fails leaves its owner's sections out). */
        async loadSections() {
            for (const entry of [...owners.values()]) {
                const load = entry.pending;
                if (!load) continue;
                entry.pending = null;
                try { for (const [name, def] of Object.entries(await load() ?? {})) entry.add(name, def); } catch { /* its sections are left out */ }
            }
        },
        has: owner => owners.has(owner),
        owners: () => [...owners.keys()],
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    };
}
