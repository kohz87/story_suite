// Studio drafts in IndexedDB: one slot per `<kind>:<id>` holding `{ text, doc, portraits, at }`. Nothing here throws; a browser with no
// IndexedDB, a blocked or failed open, a full disk and a damaged record all come back as `{ ok: false, message }`, and the Studio goes on.
//
// saveDraft(kind, id, { text, doc, portraits }, options?) → `{ ok: true, at }` or `{ ok: false, message }`; replaces that slot.
// loadDraft(kind, id, options?) → `{ ok: true, draft }` (`draft` is null when the slot is empty) or `{ ok: false, message }`.
// clearDraft(kind, id, options?) → `{ ok: true }` or `{ ok: false, message }`.
// draftKey(kind, id) → the slot name. `options.idb` is the IDBFactory to use (the tests pass a fake); `options.now` is the clock.

const DB_NAME = 'story-suite-studio';
const STORE = 'drafts';

export const draftKey = (kind, id) => `${kind}:${id}`;

const fail = (what, error) => ({ ok: false, message: `${what}: ${error?.message || error || 'unknown error'}` });

function openDb(factory) {
    return new Promise((resolve, reject) => {
        if (!factory) return reject(new Error('this browser has no IndexedDB'));
        let request;
        try {
            request = factory.open(DB_NAME, 1);
        } catch (error) {
            return reject(error);
        }
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('open failed'));
        request.onblocked = () => reject(new Error('the draft store is blocked by another tab'));
    });
}

// One transaction on the store; `work(store)` returns the request whose result is wanted. Resolves when the transaction completes.
async function run(options, mode, work) {
    const db = await openDb(options?.idb ?? globalThis.indexedDB);
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const request = work(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = () => reject(tx.error || request.error || new Error('transaction failed'));
            tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
        });
    } finally {
        try {
            db.close();
        } catch {
            /* closing a dead connection is not a failure */
        }
    }
}

const isRecord = value => value && typeof value === 'object' && typeof value.text === 'string' && Array.isArray(value.portraits) && Number.isFinite(value.at);

export async function saveDraft(kind, id, { text, doc = null, portraits = [] } = {}, options) {
    if (typeof text !== 'string') return fail('Could not save the draft', 'the pack text is missing');
    const at = options?.now ? options.now() : Date.now();
    try {
        await run(options, 'readwrite', store => store.put({ text, doc, portraits, at }, draftKey(kind, id)));
        return { ok: true, at };
    } catch (error) {
        return fail('Could not save the draft', error);
    }
}

export async function loadDraft(kind, id, options) {
    try {
        const found = await run(options, 'readonly', store => store.get(draftKey(kind, id)));
        if (found === undefined || found === null) return { ok: true, draft: null };
        if (!isRecord(found)) return fail('Could not read the draft', 'the saved draft is damaged');
        return { ok: true, draft: { text: found.text, doc: found.doc ?? null, portraits: found.portraits, at: found.at } };
    } catch (error) {
        return fail('Could not read the draft', error);
    }
}

export async function clearDraft(kind, id, options) {
    try {
        await run(options, 'readwrite', store => store.delete(draftKey(kind, id)));
        return { ok: true };
    } catch (error) {
        return fail('Could not clear the draft', error);
    }
}
