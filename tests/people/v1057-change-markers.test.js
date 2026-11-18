import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { appearanceFingerprint, createNpcRecord, mergeScanResult, normalizeNpcRecord, normalizeFieldChanges } from '../../modules/people/core/core.js';
import { mergeImportedDossierState } from '../../modules/people/bundle/bundle.js';

import { runtimeSource } from './helpers/runtime-source.js';

const base = () => normalizeNpcRecord({ ...createNpcRecord('Elia'), mood: 'calm', location: 'guesthouse', present: true });

test('a scan stamps only the fields it changed with the current turn', () => {
    const npc = base();
    const out = mergeScanResult({ npcs: [npc], turn: 71 }, {
        npcs: [{ id: npc.id, name: 'Elia', present: true, mood: 'forcing composure', location: 'High Ghyll Sheep Station', locationState: 'update' }],
    }, { transcript: 'Elia forces composure at High Ghyll Sheep Station.' });
    const turn = out.state.turn;
    const changed = out.state.npcs[0].fieldChanges;
    assert.equal(changed.mood, turn);
    assert.equal(changed.location, turn);
    assert.equal('goal' in changed, false);

    const again = mergeScanResult({ ...out.state }, { npcs: [{ id: npc.id, name: 'Elia', present: true }] }, { transcript: 'Elia sits quietly.' });
    assert.deepEqual(again.state.npcs[0].fieldChanges, changed, 'a scan that changes nothing keeps the previous markers');
});

test('newly admitted NPCs start without markers and markers stay bounded to known fields', () => {
    const out = mergeScanResult({ npcs: [], turn: 5 }, { npcs: [{ name: 'Gant', present: true, mood: 'angry' }] }, { transcript: 'Gant scowls angrily.' });
    for (const npc of out.state.npcs) assert.deepEqual(npc.fieldChanges, {});
    assert.deepEqual(normalizeFieldChanges({ mood: 4, bogus: 9, location: -1, goal: 2.5, status: '7' }), { mood: 4, status: 7 });
});

test('foreign-chat imports never carry source-turn markers', () => {
    const target = { ...base(), fieldChanges: { mood: 12 } };
    const foreignMatch = { ...base(), id: 'foreign-elia', fieldChanges: { mood: 900, location: 901 } };
    const foreignNew = { ...normalizeNpcRecord(createNpcRecord('Malia')), fieldChanges: { mood: 900 } };
    const merged = mergeImportedDossierState({ npcs: [target], turn: 20 }, { npcs: [foreignMatch, foreignNew] }, { foreignOwnership: true });
    const elia = merged.npcs.find(npc => npc.name === 'Elia');
    const malia = merged.npcs.find(npc => npc.name === 'Malia');
    assert.deepEqual(elia.fieldChanges, { mood: 12 }, 'the matched target keeps its own markers');
    assert.deepEqual(malia.fieldChanges, {}, 'a newly admitted foreign dossier starts clean');
});

test('portrait attachment records the appearance it was made for', () => {
    const index = runtimeSource();
    assert.match(index, /portrait\.appearanceFingerprint = fingerprint/);
    assert.match(index, /portrait\.appearanceForm = /);
});

test('change markers and portrait fingerprints never reach model-facing prompts or injection', async () => {
    const core = await import('../../modules/people/core/core.js');
    const npc = core.normalizeNpcRecord({ ...core.createNpcRecord('Elia'), present: true, mood: 'calm', fieldChanges: { mood: 71 },
        portrait: { dataUrl: 'data:image/png;base64,AA==', appearanceFingerprint: 'a1:zz:9', appearanceForm: 'Base' } });
    const options = { transcript: 'Elia waits.', existingNpcs: [npc], existingNpc: npc, targetNpc: npc, candidates: [], userName: 'U', charName: 'C', maxNpcs: 40 };
    for (const text of [core.buildScannerPrompt(options), core.buildBackfillPrompt(options), core.buildDossierImportPrompt(options),
        core.buildProfileRefreshPrompt(options), core.buildInjection([npc], 'Elia waits.', 1), JSON.stringify(core.buildNpcPortraitPrompts(npc))]) {
        assert.doesNotMatch(String(text), /fieldChanges|appearanceFingerprint|a1:zz|appearanceForm(?!s)/);
    }
});
