import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNpcStateCommand, createNpcRecord, mergeScanResult, normalizeNpcRecord, rosterCount } from '../../modules/people/core/core.js';

const person = (name, extra = {}) => normalizeNpcRecord({ ...createNpcRecord(name, []), lastSeenTurn: 1, ...extra });
const room = (turn, ...npcs) => ({ npcs, candidates: [], turn, dismissed: [] });
const live = { maxNpcs: 2, archiveAfter: 30 };

test('a person unseen for 30 replies takes no slot, so a newcomer is admitted', () => {
    const a = person('Aldric', { id: 'a' });
    const b = person('Brea', { id: 'b' });
    assert.equal(rosterCount([a, b], 20, 30), 2);
    const full = applyNpcStateCommand(room(20, a, b), { action: 'add', name: 'Cass' }, { ...live, turn: 20 });
    assert.equal(full.report.status, 'full', 'both are recent: the cap holds (positive control)');
    const later = applyNpcStateCommand(room(40, a, b), { action: 'add', name: 'Cass' }, { ...live, turn: 40 });
    assert.equal(later.report.status, 'added', 'both are dormant by reply 40');
    assert.equal(later.state.npcs.length, 3, 'nothing was deleted');
});

test('a scan newcomer also gets a slot while others are dormant', () => {
    const state = room(40, person('Aldric', { id: 'a' }), person('Brea', { id: 'b' }), person('Dane', { id: 'd', lastSeenTurn: 39 }));
    const merged = mergeScanResult(state, { npcs: [{ name: 'Cass', present: true, dossierSignal: 'major' }] }, { ...live, turn: 40 });
    assert.ok(merged.state.npcs.some(n => n.name === 'Cass'), 'Cass has a slot');
});

test('the dormant person counts again as soon as the story brings them back', () => {
    const a = person('Aldric', { id: 'a' });
    const b = person('Brea', { id: 'b' });
    const state = room(40, a, b);
    assert.equal(rosterCount(state.npcs, 40, 30), 0);
    const back = mergeScanResult(state, { npcs: [{ name: 'Aldric', present: true }] }, { ...live, turn: 41 });
    assert.equal(back.state.npcs.find(n => n.id === 'a').lastSeenTurn, 41);
    assert.equal(rosterCount(back.state.npcs, 41, 30), 1, 'Aldric counts again, Brea stays dormant');
    assert.equal(applyNpcStateCommand(room(41, ...back.state.npcs), { action: 'add', name: 'Cass' }, { ...live, turn: 41 }).report.status, 'added');
});

test('the dead never count; a present person is never dormant', () => {
    const dead = person('Dead', { id: 'x', lifeState: 'deceased', lifeStateCertainty: 'explicit', lastSeenTurn: 39 });
    const here = person('Here', { id: 'y', present: true, lastSeenTurn: 1 });
    assert.equal(rosterCount([dead, here], 40, 30), 1);
});

test('the count is derived from the record: swipe, Re-read, delete, rewind and reload give the same number', () => {
    const a = person('Aldric', { id: 'a', lastSeenTurn: 12 });
    const b = person('Brea', { id: 'b', lastSeenTurn: 25 });
    const c = person('Cass', { id: 'c', lastSeenTurn: 3 });
    const at = (turn, npcs) => rosterCount(npcs, turn, 30);
    // replay at the same turn, from a stored copy, gives what live gave
    const reloaded = JSON.parse(JSON.stringify([a, b, c])).map(normalizeNpcRecord);
    assert.equal(at(40, reloaded), at(40, [a, b, c]));
    assert.equal(at(40, [a, b, c]), 2);
    // a swipe / rewind to an earlier reply: the turn goes back and so does the count; forward again restores it
    assert.equal(at(30, [a, b, c]), 3, 'Cass is dormant only from reply 33');
    assert.equal(at(34, [a, b, c]), 2);
    assert.equal(at(40, [a, b, c]), 2);
    // a middle delete of someone leaves the others' counts as they were
    assert.equal(at(40, [a, c]), 1);
    assert.equal(at(40, [b]), 1);
});
