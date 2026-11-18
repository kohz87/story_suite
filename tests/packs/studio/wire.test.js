// The Studio's edit loop without a page: a session's commit → snapshot → history → debounced check → draft save, undo and redo, a change
// that changes nothing, the read-only format 3 pack, a restored draft; Export as the author wrote it until an edit and as 2-space JSON
// after, back to the author's bytes after undo; Export refused on errors and not on warnings; the field path under a record; the keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPack, pathSteps } from '../../../studio/check.js';
import { exportBlock, exportJson, exportZip } from '../../../studio/export.js';
import { bindKeys } from '../../../studio/keys.js';
import { createSession } from '../../../studio/session.js';
import { readPackZip } from '../../../packs/bundle.js';
import { fieldOffset } from '../../../studio/views/json-row.js';

const read = rel => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
const WORLD4 = JSON.parse(read('tests/packs/studio/fixtures/world4-mini.json'));
const GAME4 = read('tests/packs/studio/fixtures/game4-mini.json');
const COMPACT = JSON.stringify(WORLD4); // not 2-space, so an export that re-wrote an unedited pack would show
const LEGACY = read('tests/packs/studio/fixtures/world-mini.json');
const utf8 = bytes => new TextDecoder().decode(bytes);

// A fake clock: `run()` fires what is due. A fake draft store records the calls.
function fakeTimer() {
    const due = new Map();
    let n = 0;
    return { set: fn => (due.set(++n, fn), n), clear: id => due.delete(id), run: () => { const fns = [...due.values()]; due.clear(); for (const fn of fns) fn(); }, get size() { return due.size; } };
}
function fakeDrafts() {
    const calls = [];
    return { calls, save: async (kind, id, doc) => (calls.push(['save', kind, id, doc.text]), { ok: true, at: 1 }), clear: async (kind, id) => (calls.push(['clear', kind, id]), { ok: true }) };
}
const opened = (text, name = 'pack.json') => ({ name, text, doc: JSON.parse(text), parseError: null, portraits: [] });
const make = (text = COMPACT, extra = {}) => {
    const timer = fakeTimer();
    const drafts = fakeDrafts();
    const seen = [];
    const session = createSession(opened(text), { kind: 'world', timer, drafts, onUpdate: what => seen.push(what), ...extra });
    return { session, timer, drafts, seen };
};
const settle = () => new Promise(done => setTimeout(done, 0));
const rename = title => [{ op: 'set', path: ['content', 'lore', 0, 'title'], value: title }];

test('commit makes a frozen snapshot and one history step; the check waits for the debounce, then the draft is saved', async () => {
    const { session, timer, drafts, seen } = make();
    assert.equal(session.draftId, 'studio-world4-mini');
    assert.deepEqual(session.commit(rename('Lamps')), { ok: true });
    assert.equal(session.doc.content.lore[0].title, 'Lamps');
    assert.ok(Object.isFrozen(session.doc.content.lore[0]));
    assert.deepEqual([session.edited, session.canUndo, session.canRedo, session.stale], [true, true, false, true]);
    assert.deepEqual(seen, ['doc']);
    assert.deepEqual(drafts.calls, []);
    session.commit(rename('Lamps again'));
    assert.equal(timer.size, 1, 'a second commit restarts the one debounce');
    timer.run();
    await settle();
    assert.equal(session.stale, false);
    assert.equal(session.checked, session.present);
    assert.deepEqual(seen, ['doc', 'doc', 'check', 'draft']);
    assert.deepEqual(drafts.calls, [['save', 'world', 'studio-world4-mini', session.text]]);
    assert.equal(session.draft.at, 1);
});

test('undo and redo walk the same snapshots; undo to the start clears the draft and the text is the author\'s again', async () => {
    const { session, timer, drafts } = make();
    const first = session.present;
    session.commit(rename('A'));
    const a = session.present;
    session.commit(rename('B'));
    assert.equal(session.undo(), true);
    assert.equal(session.present, a);
    assert.equal(session.redo(), true);
    assert.equal(session.doc.content.lore[0].title, 'B');
    session.undo();
    session.undo();
    assert.equal(session.undo(), false, 'nothing left to undo');
    assert.equal(session.present, first);
    assert.equal(session.text, COMPACT);
    assert.equal(session.edited, false);
    timer.run();
    await settle();
    assert.deepEqual(drafts.calls, [['clear', 'world', 'studio-world4-mini']]);
});

test('an edit that changes nothing is no step and keeps the text as written; a bad edit is refused in words', () => {
    const { session, timer } = make();
    assert.deepEqual(session.commit(rename(WORLD4.content.lore[0].title)), { ok: true, same: true });
    assert.deepEqual([session.canUndo, session.text, timer.size], [false, COMPACT, 0]);
    const bad = session.commit([{ op: 'set', path: ['content', 'nothing', 0], value: 1 }]);
    assert.equal(bad.ok, false);
    assert.match(bad.refusal, /nothing at/);
    assert.equal(session.canUndo, false);
});

test('flush checks a waiting snapshot at once: an edit that adds an error stops Export before the debounce would have run', () => {
    const { session, timer } = make();
    session.commit([{ op: 'set', path: ['content', 'lore', 0, 'bogus'], value: 1 }]);
    assert.equal(session.check.ok, true, 'the check has not run yet');
    const check = session.flush();
    assert.equal(timer.size, 0);
    assert.equal(check.ok, false);
    assert.deepEqual(check.errors.map(problem => [problem.part, problem.rec, problem.field]), [['lore', 'lore.0', ['bogus']]]);
    assert.match(exportBlock(session).text, /^Export is off until the 1 problem is fixed\. Warnings don’t stop it\.$/);
    session.undo();
    session.flush();
    assert.equal(exportBlock(session), null);
});

test('Export: unedited byte for byte, edited as 2-space JSON, undone back to the author\'s bytes; the zip carries an unedited game as opened', async () => {
    const { session } = make();
    assert.equal(utf8(exportJson(session).bytes), COMPACT);
    session.commit(rename('Edited'));
    const edited = utf8(exportJson(session).bytes);
    assert.equal(edited, JSON.stringify(session.doc, null, 2));
    assert.notEqual(edited, COMPACT);
    const game = createSession(opened(GAME4, 'game.json'), { kind: 'game', timer: fakeTimer() });
    const back = await readPackZip(exportZip(session, game).bytes);
    assert.equal(back.ok, true);
    assert.equal(back.text, edited);
    assert.equal(back.game, GAME4);
    session.undo();
    assert.equal(utf8(exportJson(session).bytes), COMPACT);
});

test('exportBlock: errors stop Export, warnings do not; the world zip is stopped by the game pack it carries', () => {
    const warned = { ...WORLD4, content: { ...WORLD4.content, conditions: [...WORLD4.content.conditions, { name: 'fen-flooded', scope: 'place', fades: 'until cleared', means: 'Water.', placeStatus: true }] } };
    const check = checkPack(JSON.stringify(warned), { kind: 'world' });
    assert.deepEqual([check.ok, check.errors.length, check.warnings.length], [true, 0, 1]);
    assert.equal(exportBlock({ check }), null);
    const broken = { check: { errors: [{}, {}] } };
    assert.deepEqual(exportBlock(broken), { count: 2, text: 'Export is off until the 2 problems are fixed. Warnings don’t stop it.' });
    assert.equal(exportBlock({ check }, broken).text, 'Export is off until the game pack’s 2 problems are fixed. Warnings don’t stop it.');
});

test('a format 3 pack is read-only: commit, setPortrait and restore refuse in words and keep no draft', () => {
    const session = createSession(opened(LEGACY), { kind: 'world', legacy: true, timer: fakeTimer(), drafts: fakeDrafts() });
    assert.deepEqual([session.editable, session.draftId], [false, null]);
    for (const result of [session.commit(rename('x')), session.setPortrait('a.webp', new Uint8Array([1])), session.restore({ text: '{}', portraits: [] })]) {
        assert.equal(result.ok, false);
        assert.match(result.refusal, /read-only/);
    }
    assert.equal(session.text, LEGACY);
});

test('restore puts a draft on top of the file (one undo step back to it); setPortrait is one step and keeps the text', () => {
    const { session } = make();
    const draft = { text: JSON.stringify({ ...WORLD4, name: 'Drafted' }, null, 2), portraits: [] };
    assert.deepEqual(session.restore(draft), { ok: true });
    assert.equal(session.doc.name, 'Drafted');
    assert.equal(session.text, draft.text);
    session.undo();
    assert.equal(session.text, COMPACT);
    const bytes = new Uint8Array([1, 2, 3]);
    assert.deepEqual(session.setPortrait('wren.webp', bytes), { ok: true });
    assert.deepEqual([session.text, session.portraits.length, session.portraits[0].bytes], [COMPACT, 1, bytes]);
    assert.equal(session.undo(), true);
    assert.equal(session.portraits.length, 0);
    const game = createSession(opened(GAME4), { kind: 'game', timer: fakeTimer() });
    assert.match(game.setPortrait('a.webp', bytes).refusal, /world pack/);
});

test('setPortrait with the field and the old picture is one undo step, all or nothing; a name-less step removes the field and the picture', () => {
    const { session } = make();
    const old = new Uint8Array([1]);
    session.setPortrait('wren.webp', old);
    const field = value => [{ op: 'set', path: ['content', 'cast', 0, 'portrait'], value }];
    // Replace with another type: the new picture, the field naming it and the old picture go in one step.
    assert.deepEqual(session.setPortrait('wren.png', new Uint8Array([2]), { patches: field('wren.png'), drop: 'wren.webp' }), { ok: true });
    assert.deepEqual([session.doc.content.cast[0].portrait, session.portraits.map(file => file.name)], ['wren.png', ['wren.png']]);
    assert.equal(session.undo(), true);
    assert.deepEqual([session.doc.content.cast[0].portrait, session.portraits.map(file => file.name)], ['wren.webp', ['wren.webp']]);
    // A refused field patch keeps the picture out too (nothing is orphaned).
    const refused = session.setPortrait('wren.png', new Uint8Array([2]), { patches: [{ op: 'set', path: ['content', 'cast', 9, 'portrait'], value: 'x' }], drop: 'wren.webp' });
    assert.equal(refused.ok, false);
    assert.deepEqual(session.portraits.map(file => file.name), ['wren.webp']);
    // Remove: the field and the picture in one step; a dropped name the pack does not hold is not a refusal.
    assert.deepEqual(session.setPortrait(null, null, { patches: [{ op: 'remove', path: ['content', 'cast', 0, 'portrait'] }], drop: 'wren.webp' }), { ok: true });
    assert.deepEqual([session.doc.content.cast[0].portrait, session.portraits.length], [undefined, 0]);
    session.undo();
    assert.deepEqual([session.doc.content.cast[0].portrait, session.portraits.length], ['wren.webp', 1]);
    assert.deepEqual(session.setPortrait(null, null, { patches: [{ op: 'remove', path: ['content', 'cast', 0, 'portrait'] }], drop: 'nobody.webp' }), { ok: true });
});

test('the field below a record: check.js path steps and the JSON row caret at that field (or the nearest part the record has)', () => {
    assert.deepEqual(pathSteps('content.cast[3].secrets[1].gate'), ['content', 'cast', 3, 'secrets', 1, 'gate']);
    const record = { name: 'Wren', secrets: [{ id: 'a', gate: 'x' }, { id: 'b', gate: 'y' }] };
    const text = JSON.stringify(record, null, 2);
    const at = fieldOffset(record, ['secrets', 1, 'gate'], text);
    assert.equal(text.slice(at, at + 12), '"gate": "y"\n'.slice(0, 12));
    assert.equal(text.slice(text.lastIndexOf('\n', at) + 1, at), '      ');
    const missing = fieldOffset(record, ['secrets', 1, 'nothing'], text);
    assert.equal(text.slice(missing, missing + 1), '{', 'a missing field: the line of the nearest part the record has');
    assert.equal(fieldOffset(record, [], text), 0);
});

test('the keys: Ctrl+Z undo, Ctrl+Shift+Z and Ctrl+Y redo, except in a text box, where they are the box\'s own', () => {
    let handler = null;
    const doc = { addEventListener: (_type, fn) => { handler = fn; }, removeEventListener: () => { handler = null; } };
    const called = [];
    const stop = bindKeys(doc, { undo: () => called.push('undo'), redo: () => called.push('redo') });
    const press = (key, extra = {}) => handler({ key, code: '', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, target: { tagName: 'DIV' }, preventDefault() {}, ...extra });
    press('z');
    press('Z', { shiftKey: true });
    press('y');
    press('z', { target: { tagName: 'TEXTAREA' } });
    assert.deepEqual(called, ['undo', 'redo', 'redo']);
    stop();
    assert.equal(handler, null);
});
