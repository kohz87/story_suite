// The Studio draft slots, on a small fake IndexedDB: one slot per `<kind>:<id>`, a save replaces it, portraits come back as bytes,
// the world and game slots do not touch, and every failure (no IndexedDB, open error, blocked, full disk, aborted, damaged) is a message.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearDraft, draftKey, loadDraft, saveDraft } from '../../../studio/draft.js';

// The fake keeps stored values as structured clones, like the real one. `faults` makes one step fail.
function fakeIdb(faults = {}) {
    const data = new Map();
    const later = fn => setTimeout(fn, 0);
    const store = tx => ({
        put(value, key) {
            const request = {};
            if (faults.put) later(() => (tx.error = faults.put, tx.onabort?.()));
            else later(() => (data.set(key, structuredClone(value)), request.result = key, tx.oncomplete?.()));
            return request;
        },
        get(key) {
            const request = {};
            later(() => (request.result = structuredClone(data.get(key)), tx.oncomplete?.()));
            return request;
        },
        delete(key) {
            const request = {};
            if (faults.delete) later(() => (tx.error = faults.delete, tx.onerror?.()));
            else later(() => (data.delete(key), tx.oncomplete?.()));
            return request;
        },
    });
    const factory = {
        data,
        opened: 0,
        closed: 0,
        open() {
            if (faults.throwOpen) throw faults.throwOpen;
            factory.opened++;
            const request = {};
            later(() => {
                if (faults.openError) return ((request.error = faults.openError), request.onerror?.());
                if (faults.blocked) return request.onblocked?.();
                const names = new Set(factory.stores ?? []);
                request.result = {
                    objectStoreNames: { contains: name => names.has(name) },
                    createObjectStore: name => (factory.stores = [...names, name]),
                    transaction: () => {
                        const tx = {};
                        tx.objectStore = () => store(tx);
                        return tx;
                    },
                    close: () => factory.closed++,
                };
                request.onupgradeneeded?.();
                request.onsuccess?.();
            });
            return request;
        },
    };
    return factory;
}

const PORTRAIT = { name: 'mira.png', bytes: new Uint8Array([137, 80, 78, 71, 0, 255]) };
const DRAFT = { text: '{"format":4}\n', doc: { format: 4, id: 'ersveil' }, portraits: [PORTRAIT] };

test('the slot name is kind and id', () => {
    assert.equal(draftKey('world', 'ersveil'), 'world:ersveil');
    assert.equal(draftKey('game', 'ersveil'), 'game:ersveil');
});

test('a saved draft comes back with its text, doc, portrait bytes and time', async () => {
    const idb = fakeIdb();
    const saved = await saveDraft('world', 'ersveil', DRAFT, { idb, now: () => 1234 });
    assert.deepEqual(saved, { ok: true, at: 1234 });
    const loaded = await loadDraft('world', 'ersveil', { idb });
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.draft, { ...DRAFT, at: 1234 });
    assert.ok(loaded.draft.portraits[0].bytes instanceof Uint8Array);
    assert.deepEqual([...idb.data.keys()], ['world:ersveil']);
    assert.equal(idb.closed, 2, 'every connection is closed');
});

test('an empty slot loads as null, not as an error', async () => {
    assert.deepEqual(await loadDraft('world', 'nothing', { idb: fakeIdb() }), { ok: true, draft: null });
});

test('a second save replaces the slot, and each kind and id has its own slot', async () => {
    const idb = fakeIdb();
    await saveDraft('world', 'ersveil', DRAFT, { idb, now: () => 1 });
    await saveDraft('world', 'ersveil', { ...DRAFT, text: 'second' }, { idb, now: () => 2 });
    await saveDraft('game', 'ersveil', { text: 'game text' }, { idb, now: () => 3 });
    assert.equal(idb.data.size, 2);
    assert.equal((await loadDraft('world', 'ersveil', { idb })).draft.text, 'second');
    const game = (await loadDraft('game', 'ersveil', { idb })).draft;
    assert.deepEqual(game, { text: 'game text', doc: null, portraits: [], at: 3 });
});

test('clearing one slot leaves the other, and clearing an empty slot is fine', async () => {
    const idb = fakeIdb();
    await saveDraft('world', 'ersveil', DRAFT, { idb });
    await saveDraft('game', 'ersveil', DRAFT, { idb });
    assert.deepEqual(await clearDraft('world', 'ersveil', { idb }), { ok: true });
    assert.deepEqual(await clearDraft('world', 'ersveil', { idb }), { ok: true });
    assert.equal((await loadDraft('world', 'ersveil', { idb })).draft, null);
    assert.equal((await loadDraft('game', 'ersveil', { idb })).draft.text, DRAFT.text);
});

test('the draft is a copy: editing the object after a save does not change the stored slot', async () => {
    const idb = fakeIdb();
    const live = { text: 'a', doc: { x: 1 }, portraits: [] };
    await saveDraft('world', 'w', live, { idb });
    live.doc.x = 2;
    assert.equal((await loadDraft('world', 'w', { idb })).draft.doc.x, 1);
});

test('a save with no pack text is refused in words, and nothing is written', async () => {
    const idb = fakeIdb();
    const result = await saveDraft('world', 'w', { doc: {} }, { idb });
    assert.equal(result.ok, false);
    assert.match(result.message, /pack text is missing/);
    assert.equal(idb.opened, 0);
});

test('no IndexedDB at all is a message on save, load and clear', async () => {
    const none = { idb: null };
    const saved = await saveDraft('world', 'w', DRAFT, none);
    assert.equal(saved.ok, false);
    assert.match(saved.message, /no IndexedDB/);
    assert.equal((await loadDraft('world', 'w', none)).ok, false);
    assert.equal((await clearDraft('world', 'w', none)).ok, false);
});

test('an open that throws, errors or is blocked is a message, never a throw', async () => {
    const thrown = await saveDraft('world', 'w', DRAFT, { idb: fakeIdb({ throwOpen: new Error('SecurityError') }) });
    assert.match(thrown.message, /Could not save the draft: SecurityError/);
    const errored = await loadDraft('world', 'w', { idb: fakeIdb({ openError: new Error('denied') }) });
    assert.match(errored.message, /Could not read the draft: denied/);
    const blocked = await clearDraft('world', 'w', { idb: fakeIdb({ blocked: true }) });
    assert.match(blocked.message, /blocked by another tab/);
});

test('a full disk (aborted write) and a failed delete are messages, and the connection is still closed', async () => {
    const full = fakeIdb({ put: new Error('QuotaExceededError') });
    const saved = await saveDraft('world', 'w', DRAFT, { idb: full });
    assert.equal(saved.ok, false);
    assert.match(saved.message, /QuotaExceededError/);
    assert.equal(full.closed, 1);
    const stuck = fakeIdb({ delete: new Error('locked') });
    assert.match((await clearDraft('world', 'w', { idb: stuck })).message, /locked/);
    assert.equal(stuck.closed, 1);
});

test('a damaged stored record is reported, not returned as a draft', async () => {
    const idb = fakeIdb();
    idb.data.set('world:w', { text: 42 });
    const result = await loadDraft('world', 'w', { idb });
    assert.equal(result.ok, false);
    assert.match(result.message, /damaged/);
});
