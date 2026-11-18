import { partsSource } from './helpers/parts-source.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult, normalizeFieldChangeMessages, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { mergeImportedDossierState } from '../../modules/people/bundle/bundle.js';

import { runtimeSource } from './helpers/runtime-source.js';

// 1.2.3: the dossiers show the chat's reply number (the latest assistant reply's message index, as
// Story Block's "reply #N") instead of Delta's own turn counter, which keeps its internal meaning.

const mira = (extra = {}) => normalizeNpcRecord({
    ...createNpcRecord('Mira'), id: 'npc_mira', present: true, mood: 'calm', location: 'guild hall', ...extra,
});

const relationshipScan = mood => ({ npcs: [{
    id: 'npc_mira', name: 'Mira', present: true, mood, relationshipImpact: 'ordinary',
    relationshipDelta: { trust: 0, affection: 1, desire: 0, tension: 0 },
    relationshipEvidence: { trust: '', affection: 'Mira accepts and stays to eat with Kazuma.', desire: '', tension: '' },
    relationshipChangeReason: 'Their casual supper leaves her a little warmer toward him.',
}] });

test('v1.2.3 a scan stamps the changed fields with the reply\'s message index beside the unchanged turn', () => {
    const out = mergeScanResult({ npcs: [mira()], turn: 71 }, { npcs: [{ id: 'npc_mira', name: 'Mira', present: true, mood: 'forcing composure' }] },
        { transcript: 'Mira forces composure.', sourceMessageId: 14 });
    const npc = out.state.npcs[0];
    assert.equal(npc.fieldChanges.mood, out.state.turn, 'fieldChanges keeps Delta\'s turn counter');
    assert.deepEqual(npc.fieldChangeMessages, { mood: 14 });

    const later = mergeScanResult({ ...out.state, turn: 72 }, { npcs: [{ id: 'npc_mira', name: 'Mira', present: true, location: 'High Ghyll Sheep Station', locationState: 'update' }] },
        { transcript: 'Mira walks to High Ghyll Sheep Station.', sourceMessageId: 16 });
    assert.deepEqual(later.state.npcs[0].fieldChangeMessages, { mood: 14, location: 16 }, 'only the changed field takes the new reply');

    const unchanged = mergeScanResult({ ...later.state, turn: 73 }, { npcs: [{ id: 'npc_mira', name: 'Mira', present: true }] },
        { transcript: 'Mira waits.', sourceMessageId: 18 });
    assert.deepEqual(unchanged.state.npcs[0].fieldChangeMessages, { mood: 14, location: 16 }, 'a scan that changes nothing stamps nothing');

    const noSource = mergeScanResult({ ...later.state, turn: 74 }, { npcs: [{ id: 'npc_mira', name: 'Mira', present: true, mood: 'tired' }] },
        { transcript: 'Mira is tired.' });
    assert.equal(noSource.state.npcs[0].fieldChanges.mood, 74);
    assert.deepEqual(noSource.state.npcs[0].fieldChangeMessages, { location: 16 }, 'a change without a reply index drops the stale one');

    assert.deepEqual(normalizeFieldChangeMessages({ mood: 4, bogus: 9, location: -1, goal: 2.5, status: '7' }), { mood: 4, status: 7 });
    assert.equal('fieldChangeMessages' in normalizeNpcRecord({ ...mira(), fieldChangeMessages: { bogus: 3 } }), false, 'empty maps are not stored');
});

test('v1.2.3 relationship events recorded by a scan carry the reply\'s message index', () => {
    const result = mergeScanResult({ npcs: [mira()], candidates: [], turn: 2 }, relationshipScan('content'),
        { admissionMode: 'balanced', developmentContext: 'Mira accepts and stays to eat with Kazuma.', sourceMessageId: 9 });
    const npc = result.state.npcs[0];
    assert.equal(npc.relationship.affection, 1);
    assert.equal(npc.lastRelationshipChange.message, 9);
    assert.equal(npc.lastRelationshipChange.turn, result.state.turn, 'turn keeps the counter for duplicate/recency checks');
    assert.equal(npc.relationshipEventHistory.at(-1).message, 9);
    const again = normalizeNpcRecord(structuredClone(npc));
    assert.equal(again.lastRelationshipChange.message, 9, 'normalization keeps it');
    assert.equal(again.relationshipEventHistory.at(-1).message, 9);
    const legacy = normalizeNpcRecord({ ...mira(), lastRelationshipChange: { impact: 'ordinary', reason: 'Old.', turn: 5, message: -2 } });
    assert.equal('message' in legacy.lastRelationshipChange, false);

    const index = runtimeSource();
    const relationshipPass = partsSource(new URL('../../modules/people/relationship/relationship-pass.js', import.meta.url));
    assert.match(relationshipPass, /turn: Number\.isFinite\(Number\(state\.turn\)\) \? Number\(state\.turn\) : null,\n\s*\.\.\.relationshipEventMessage\(\{ message: sourceMessageId \}\),/, 'focused relationship pass');
    assert.match(index, /\.\.\.relationshipEventMessage\(\{ message: latestReplyIndex\(\) \}\),/, 'manual relationship edit');
});

test('v1.2.3 a foreign-chat import never carries the source chat\'s reply numbers', () => {
    const event = { impact: 'ordinary', reason: 'Supper.', turn: 900, message: 300, sourceMessageId: 300 };
    const target = mira({ fieldChanges: { mood: 12 }, fieldChangeMessages: { mood: 7 } });
    const foreignMatch = { ...mira(), id: 'foreign-mira', fieldChanges: { mood: 900 }, fieldChangeMessages: { mood: 300 },
        lastRelationshipChange: { ...event }, relationshipEventHistory: [{ ...event }] };
    const foreignNew = { ...normalizeNpcRecord(createNpcRecord('Malia')), fieldChanges: { mood: 900 }, fieldChangeMessages: { mood: 300 },
        lastRelationshipChange: { ...event }, relationshipEventHistory: [{ ...event }] };
    const merged = mergeImportedDossierState({ npcs: [target], turn: 20 }, { npcs: [foreignMatch, foreignNew] }, { foreignOwnership: true });
    const matched = merged.npcs.find(npc => npc.name === 'Mira');
    const added = merged.npcs.find(npc => npc.name === 'Malia');
    assert.deepEqual(matched.fieldChangeMessages, { mood: 7 }, 'the matched target keeps its own reply numbers');
    assert.equal('fieldChangeMessages' in added, false);
    for (const npc of [matched, added]) {
        assert.equal('message' in npc.lastRelationshipChange, false);
        assert.ok(npc.relationshipEventHistory.every(item => !('message' in item)));
    }
    assert.equal(added.lastRelationshipChange.turn, 900, 'the event itself is kept, as before');

    const same = mergeImportedDossierState({ npcs: [], turn: 20 }, { npcs: [foreignNew] }, { foreignOwnership: false });
    assert.equal(same.npcs[0].lastRelationshipChange.message, 300, 'a same-chat restore keeps them');
    assert.deepEqual(same.npcs[0].fieldChangeMessages, { mood: 300 });
});

test('v1.2.3 reply numbers never reach model-facing prompts or injection', async () => {
    const core = await import('../../modules/people/core/core.js');
    const npc = core.normalizeNpcRecord({ ...mira(), fieldChanges: { mood: 71 }, fieldChangeMessages: { mood: 4242 },
        lastRelationshipChange: { impact: 'ordinary', reason: 'Supper.', turn: 71, message: 4242 },
        relationshipEventHistory: [{ impact: 'ordinary', reason: 'Supper.', turn: 71, message: 4242 }] });
    const options = { transcript: 'Mira waits.', existingNpcs: [npc], existingNpc: npc, targetNpc: npc, targets: [npc], candidates: [], userName: 'U', charName: 'C', maxNpcs: 40 };
    const texts = [core.buildScannerPrompt(options), core.buildBackfillPrompt(options), core.buildDossierImportPrompt(options),
        core.buildProfileRefreshPrompt(options), core.buildInjection([npc], 'Mira waits.', 1), JSON.stringify(core.buildNpcPortraitPrompts(npc))];
    if (typeof core.buildRelationshipPrompt === 'function') texts.push(core.buildRelationshipPrompt(options));
    for (const text of texts) assert.doesNotMatch(String(text), /fieldChangeMessages|4242|"message"/);
});
