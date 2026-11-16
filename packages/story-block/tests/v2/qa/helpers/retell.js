// QA oracle for edited Re-reads: the story told the edited way. A Re-read must leave the chat as if the reply
// had said its edited text when it was first told, so a brand-new host that is sent the chat's texts as they
// read now (each user message and the reply's shown text, in order) must hold the same state at every reply
// and answer the readers the same. The replay oracle (oracle.js rebuildAt) cannot see a Re-read that went
// wrong this way: it replays the stored ops, so a later reply's stored `add` lands on a key the edited reply
// now uses in the oracle exactly as in the store (PROBLEMSKEY). This one reads the texts instead.
// Only a chat whose state comes from its texts alone can be told again: sends, swipes, Regenerates, deletes
// of the last pair and Re-reads (reread-fuzz-run.js keeps to those). IDs and revs are not compared: a fresh
// telling mints other IDs, and its revs differ harmlessly (no swiped-away replies); a map keyed by IDs is
// compared as the list of its values, one keyed by revs as its values in key order.
// Not a test file (the test glob does not match helpers/).
import { carriers } from './oracle.js';

const ID = /^[a-z]{2}_[0-9a-z]{8,12}$/;
// An ID inside a longer string or key (a claim `loot:sw_…`).
const IDS = /\b[a-z]{2}_[0-9a-z]{8,12}\b/g;
const noIds = text => text.replace(IDS, '#id');
const REV_KEY = /^\d+(?:\.\d+)?$/;
const revOrder = key => key.split('.').map(Number);
const byRev = (a, b) => { const [x, y] = [revOrder(a), revOrder(b)]; return x[0] - y[0] || (x[1] ?? 0) - (y[1] ?? 0); };

/** The value with IDs, revs and key order taken out (see above). */
export function canon(value) {
    if (Array.isArray(value)) return value.map(canon);
    if (value === null || typeof value !== 'object') return typeof value === 'string' ? noIds(value) : value;
    // (a loot offer's `n` is the rev its reply was stored at, loot-parts/capture.js: a rev like the others)
    const isLoot = typeof value.sid === 'string' && typeof value.claim === 'string' && 'n' in value;
    const keys = Object.keys(value).filter(key => key !== 'rev' && !(isLoot && key === 'n'));
    if (keys.length && keys.every(key => REV_KEY.test(key))) return { '#byRev': keys.sort(byRev).map(key => canon(value[key])) };
    if (keys.length && keys.every(key => ID.test(key))) return { '#byId': keys.map(key => canon(value[key])).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) };
    // (two keys that differ only by an ID would collapse into one entry and lose a value: such a map is a sorted list of its values)
    const named = keys.sort().map(key => [noIds(key), canon(value[key])]);
    if (new Set(named.map(([key]) => key)).size < named.length) return { '#byName': named.map(([key, entry]) => [key, entry]).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) };
    return Object.fromEntries(named);
}

// Loose: which of two stacks of one item a line takes or marks follows the stacks' IDs (the first by ID), and a new
// telling mints other IDs, so it may take the other one. Loose compares the bag as each item's total by owner (no
// notes), and leaves out the readers that list stacks; it only tells such a difference from a real one.
const STACK_READERS = new Set(['inventory.items', 'inventory.equipment', 'inventory.counts']);
function looseState(state) {
    const stacks = state?.domains?.inventory?.stacks;
    if (!stacks) return state;
    const copy = structuredClone(state);
    const totals = {};
    for (const stack of Object.values(stacks)) totals[`${stack.def}|${stack.owner}`] = (totals[`${stack.def}|${stack.owner}`] ?? 0) + stack.qty;
    copy.domains.inventory.stacks = totals;
    return copy;
}

/** The first path where two canonical values differ, with both sides: { path, live, told } or null. */
export function firstDiff(live, told, path = '') {
    if (JSON.stringify(live) === JSON.stringify(told)) return null;
    if (live === null || told === null || typeof live !== 'object' || typeof told !== 'object' || Array.isArray(live) !== Array.isArray(told)) return { path: path || '/', live, told };
    const keys = [...new Set([...Object.keys(live), ...Object.keys(told)])];
    for (const key of keys) {
        const found = firstDiff(live[key], told[key], `${path}/${key}`);
        if (found) return found;
    }
    return { path: path || '/', live, told };
}

/** A new host (`makeHost()`) sent the chat's user messages and shown replies in order. */
export async function retell(chat, makeHost) {
    const told = await makeHost();
    for (let i = 1; i + 1 < chat.length; i += 2) {
        if (!chat[i].is_user || chat[i + 1].is_user) throw new Error(`retell: message ${i} and ${i + 1} are not a user message and a reply`);
        await told.send(chat[i].mes, chat[i + 1].mes);
    }
    return told;
}

/**
 * The first difference between the live host and the story told the edited way: the state at every reply
 * (oldest first), then each reader in `readers` (query names, asked with no payload) at the head.
 * { at, path, live, told } (`at`: a reply's index or `reader <name>`), or null when they agree. `loose`: see looseState.
 * `before`: only the replies below this index are compared, and no reader (the Re-reads stopped there).
 * `leave`: domain names (and `claims:<prefix>`, `path:a/b/c`) left out of the state compare (a host's data the told-again story does not reproduce yet).
 */
export async function compareTold(live, makeHost, readers = [], { loose = false, leave = [], before = Infinity } = {}) {
    const without = state => {
        if (!leave.length || !state?.domains) return state;
        const copy = { ...state, domains: { ...state.domains } };
        for (const name of leave) delete copy.domains[name];
        // (a `claims:<prefix>` entry drops the claims that start with the prefix)
        const prefixes = leave.filter(name => name.startsWith('claims:')).map(name => name.slice(7));
        if (prefixes.length && state.meta?.claims) copy.meta = { ...state.meta, claims: Object.fromEntries(Object.entries(state.meta.claims).filter(([key]) => !prefixes.some(prefix => key.startsWith(prefix)))) };
        // (a `path:a/b/c` entry drops that one field of the state)
        for (const name of leave.filter(entry => entry.startsWith('path:'))) {
            const keys = name.slice(5).split('/');
            let at = copy;
            for (const key of keys.slice(0, -1)) { if (!at?.[key]) { at = null; break; } at[key] = { ...at[key] }; at = at[key]; }
            if (at) delete at[keys.at(-1)];
        }
        return copy;
    };
    const view = loose ? state => looseState(without(state)) : without;
    const told = await retell(live.ctx.chat, makeHost);
    try {
        const ours = carriers(live.ctx.chat), theirs = carriers(told.ctx.chat);
        if (ours.join() !== theirs.join()) return { at: 'replies', path: '/', live: ours, told: theirs };
        for (const index of ours.filter(at => at < before)) {
            const diff = firstDiff(canon(view(live.store.at(index))), canon(view(told.store.at(index))));
            if (diff) return { at: index, ...diff };
        }
        // (a reader's list of records is compared as a set: lists sorted by ID, such as the items, come in another order)
        const asSet = value => (Array.isArray(value) && value.every(entry => entry !== null && typeof entry === 'object') ? [...value].sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) : value);
        if (before !== Infinity) return null;
        for (const name of readers.filter(reader => !loose || !STACK_READERS.has(reader))) {
            const diff = firstDiff(asSet(canon(await live.sdk.query(name, {}))), asSet(canon(await told.sdk.query(name, {}))));
            if (diff) return { at: `reader ${name}`, ...diff };
        }
        return null;
    } finally {
        told.close();
    }
}

/**
 * { copy, refused }: a new host (`makeHost()`) holding a copy of the chat with every reply Re-read, oldest first, and
 * the Re-reads it refused ([{ index, code }]). A difference from the told story that this copy no longer has came
 * from replies that were not Re-read after an earlier one changed (a later line refused live that the edited story
 * would take, or the other way round): that is how Re-read is meant to work (a later reply keeps what it recorded
 * until it is Re-read itself), not a fault. A Re-read is refused (`CONFLICT`) when a later reply's stored change
 * depends on what the reply did before; then the copy is not the story Re-read through, and says nothing.
 */
export async function rereadAll(chat, makeHost) {
    const copy = await makeHost();
    await copy.st.loadChat(structuredClone(chat), 'reread-all');
    const refused = [];
    for (const index of carriers(copy.ctx.chat).filter(at => at > 0)) {
        const done = await copy.sdk.reread(index);
        if (!done?.ok) refused.push({ index, code: done?.code });
    }
    return { copy, refused };
}
