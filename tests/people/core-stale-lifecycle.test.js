import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStaleNpcLifecycle, createNpcRecord, mergeScanResult, normalizeNpcRecord, setNpcArchived } from '../../modules/people/core/core.js';

// P6: a dossier has no archive or retention fields. The stale pass only deletes: a quiet dossier that does not matter goes at deleteAfter, one that
// matters (portrait, cast entry, bond off its start, key person) stays however long it has been quiet. A death is lifeState 'deceased', never a flag.
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const quiet = (name, extra = {}) => ({ ...createNpcRecord(name), id: `npc_${name.toLowerCase().replace(/\W+/g, '_')}`, lastSeenTurn: 1, ...extra });
const run = (npcs, options = {}) => applyStaleNpcLifecycle({ turn: 100, npcs }, { turn: 100, archiveAfter: 30, deleteAfter: 50, ...options });

test('a record carries no archive or retention field, old ones in a stored record are dropped', () => {
    for (const gone of ['archived', 'archiveReason', 'archivedAt', 'archiveSourceMessageId', 'retentionProtected']) {
        assert.equal(gone in createNpcRecord('Mira'), false, gone);
        assert.equal(gone in normalizeNpcRecord({ name: 'Mira', [gone]: true }), false, gone);
    }
});

test('the stale pass deletes a quiet dossier that does not matter at deleteAfter, and never archives', () => {
    const young = quiet('Court Herald', { lastSeenTurn: 70 });
    const old = quiet('Gate Guard', { lastSeenTurn: 40 });
    const result = run([young, old]);
    assert.deepEqual(result.removed.map(item => item.id), [old.id]);
    assert.deepEqual(result.state.npcs.map(npc => npc.id), [young.id]);
    assert.equal('archived' in result.state.npcs[0], false);
});

test('a dossier that matters is kept however long it has been quiet', () => {
    const portrait = quiet('Pia', { portrait: { dataUrl: PNG_1PX } });
    const cast = quiet('Orin', { castFrom: { first: {} } });
    const bond = quiet('Bel');
    bond.relationship = { ...bond.relationship, trust: 40 };
    const key = quiet('Kerr');
    const incidental = quiet('Passer By');
    const result = run([portrait, cast, bond, key, incidental], { keepIds: [key.id] });
    assert.deepEqual(result.removed.map(item => item.id), [incidental.id]);
    assert.equal(result.state.npcs.length, 4);
});

test('present, world-active, protected and dead people are never removed; a failed host read (noDelete) removes nobody', () => {
    const here = quiet('Here', { present: true });
    const away = quiet('Away', { worldActive: true });
    const held = quiet('Held');
    const dead = quiet('Dead Baron', { lifeState: 'deceased', lifeStateCertainty: 'explicit' });
    const result = run([here, away, held, dead], { protectedIds: [held.id] });
    assert.equal(result.removed.length, 0);
    assert.equal(run([quiet('Passer By')], { noDelete: true }).removed.length, 0);
});

test('archiving only decides presence and life state: a death archive marks the person deceased, restoring a dead one makes them alive', () => {
    const mira = { ...createNpcRecord('Mira'), present: true };
    const off = setNpcArchived(mira, true, { reason: 'manual' });
    assert.equal(off.present, false);
    assert.equal(off.lifeState, 'unknown');
    const dead = setNpcArchived(mira, true, { reason: 'deceased' });
    assert.equal(dead.lifeState, 'deceased');
    assert.equal('archived' in dead, false);
    assert.equal(setNpcArchived(dead, false, { allowDeathCorrection: true }).lifeState, 'alive');
});

test('a confirmed death takes the person off the scene and no later scan revives them (C05); an inferred death changes nothing', () => {
    const npc = createNpcRecord('Beldia');
    const died = mergeScanResult({ npcs: [npc], turn: 2 }, { npcs: [{ id: npc.id, name: 'Beldia', present: true, lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: 'Killed at the gate.' }] }, { turn: 2, autoArchiveDeaths: true }).state.npcs[0];
    assert.equal(died.lifeState, 'deceased');
    assert.equal(died.present, false);
    const ghost = mergeScanResult({ npcs: [died], turn: 3 }, { npcs: [{ id: npc.id, name: 'Beldia', present: true, worldActive: true, lifeState: 'alive', lifeStateCertainty: 'explicit' }] }, { turn: 3 }).state.npcs[0];
    assert.equal(ghost.lifeState, 'deceased');
    assert.equal(ghost.present, false);
    assert.equal(ghost.worldActive, false);
    const dust = createNpcRecord('Dust');
    const left = mergeScanResult({ npcs: [dust], turn: 2 }, { npcs: [{ id: dust.id, name: 'Dust', present: true, lifeState: 'deceased', lifeStateCertainty: 'inferred' }] }, { turn: 2, autoArchiveDeaths: true }).state.npcs[0];
    assert.equal(left.present, true);
    assert.notEqual(left.lifeStateCertainty, 'explicit');
});
