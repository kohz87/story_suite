import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DURABLE_PROFILE_LIMITS,
    buildScannerPrompt,
    createNpcRecord,
    mergeScanResult,
    normalizeAge,
    normalizeApparentAge,
    normalizeNpcRecord,
} from '../core.js';

test('qualitative visual age evidence resolves to stable apparent age without inventing chronology', () => {
    const young = normalizeApparentAge('young', 'npc_marris');
    assert.match(young, /^~\d+$/);
    const youngNumber = Number(young.slice(1));
    assert.ok(youngNumber >= 18 && youngNumber <= 29);
    assert.equal(normalizeApparentAge('young', 'npc_marris'), young, 'same NPC/evidence should not reroll');
    assert.equal(normalizeAge('young'), '', 'visual descriptor must not become chronological age');
    assert.equal(normalizeAge('19 years old'), '19');
    const range = normalizeApparentAge('20-25', 'npc_marris');
    assert.match(range, /^~\d+$/);
    assert.ok(Number(range.slice(1)) >= 20 && Number(range.slice(1)) <= 25);
});

test('legacy/scanner qualitative age is routed into apparentAge while chronological age stays unknown', () => {
    const result = mergeScanResult({ npcs: [], turn: 1 }, { npcs: [{
        name: 'Marris', species: 'human', age: 'young', present: true,
    }] }, { turn: 1 });
    assert.equal(result.state.npcs[0].age, '');
    assert.match(result.state.npcs[0].apparentAge, /^~\d+$/);
    const estimated = Number(result.state.npcs[0].apparentAge.slice(1));
    assert.ok(estimated >= 18 && estimated <= 29);
});

test('fantasy species can have separate chronological and apparent age', () => {
    let result = mergeScanResult({ npcs: [], turn: 1 }, { npcs: [{
        name: 'Elaria', species: 'Elf', apparentAge: 'young', present: true,
    }] }, { turn: 1 });
    assert.equal(result.state.npcs[0].age, '');
    assert.match(result.state.npcs[0].apparentAge, /^~\d+$/);
    const looks = result.state.npcs[0].apparentAge;
    result = mergeScanResult(result.state, { npcs: [{
        id: result.state.npcs[0].id, name: 'Elaria', age: '143', present: true,
    }] }, { turn: 2 });
    assert.equal(result.state.npcs[0].age, '143');
    assert.equal(result.state.npcs[0].apparentAge, looks);
});

test('top-level profileUpdates refine manual unlocked durable fields even when npcs is empty', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Cautious and reserved.';
    npc.speech = 'Soft and formal.';
    npc.manualProfileFields = [];
    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 3 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            evidence: { personality: ['Uses dry humor with trusted companions.'], speech: ['Consistently addresses elders with proper titles.'] },
            personalityState: 'refine',
            personality: 'Cautious and reserved; dryly humorous with trusted companions.',
            speechState: 'refine',
            speech: 'Soft and formal; consistently uses proper titles for elders.',
        }],
    }, { turn: 4 });
    assert.match(result.state.npcs[0].personality, /dryly humorous/i);
    assert.match(result.state.npcs[0].speech, /proper titles/i);
    assert.deepEqual(result.state.npcs[0].profileEvidence.personality, []);
    assert.deepEqual(result.state.npcs[0].profileEvidence.speech, []);
    assert.deepEqual(result.report.profileUpdated, [npc.id]);
    assert.equal(result.report.profileUpdateStats.applied, 1);
});

test('durable profile evidence accumulates across turns without requiring an immediate rewrite', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Cautious and reserved.';
    npc.speech = 'Soft and formal.';
    const first = mergeScanResult({ npcs: [npc], candidates: [], turn: 1 }, {
        npcs: [],
        profileUpdates: [{ id: npc.id, evidence: { speech: ['Uses proper titles when addressing elders.'] } }],
    }, { turn: 2 });
    assert.deepEqual(first.state.npcs[0].profileEvidence.speech, ['Uses proper titles when addressing elders.']);
    assert.equal(first.state.npcs[0].speech, 'Soft and formal.');

    const prompt = buildScannerPrompt({
        transcript: 'She again addresses the elderly knight as Sir and frames her request formally.',
        existingNpcs: [first.state.npcs[0]],
    });
    assert.match(prompt, /recentProfileEvidence/);
    assert.match(prompt, /Uses proper titles when addressing elders/);
    assert.match(prompt, /ALWAYS emit profileUpdates/i);
});

test('legacy durable summaries semantically compact duplicate concepts during normalization', () => {
    const npc = normalizeNpcRecord({
        name: 'Astra',
        personality: 'Gentle and soft-spoken; She shares a telepathic link with Ryu and can hear her thoughts; She and Ryu communicate through a telepathic channel that carries thoughts; Gentle and soft-spoken around family.',
    });
    assert.equal((npc.personality.match(/telepath/gi) || []).length, 1, npc.personality);
    assert.equal((npc.personality.match(/Gentle and soft-spoken/gi) || []).length, 1, npc.personality);
    assert.ok(npc.personality.length <= DURABLE_PROFILE_LIMITS.personality);
});

test('mannerism normalization collapses paraphrases of the same habit without deleting distinct habits involving the same person', () => {
    const npc = normalizeNpcRecord({
        name: 'Astra',
        mannerisms: [
            'Presses her forehead to Lucien when seeking reassurance.',
            'When anxious, she presses her forehead against Lucien for reassurance.',
            "Smooths Lucien's sleeve when affectionate.",
            "She smooths Lucien's sleeve as an affectionate habit.",
        ],
    });
    assert.equal(npc.mannerisms.length, 2);
    assert.match(npc.mannerisms.join(' '), /forehead/i);
    assert.match(npc.mannerisms.join(' '), /sleeve/i);
});

test('repeated full-summary profile refinements reconcile instead of growing every scan', () => {
    const npc = createNpcRecord('Astra');
    npc.personality = 'Gentle and soft-spoken; shares a telepathic link with Ryu.';
    let state = { npcs: [npc], candidates: [], turn: 1 };
    const incoming = 'Gentle and soft-spoken; communicates with Ryu through a telepathic channel carrying thoughts; gentle and soft-spoken around family.';
    let firstText = '';
    for (let turn = 2; turn <= 5; turn++) {
        const result = mergeScanResult(state, {
            npcs: [],
            profileUpdates: [{ id: npc.id, personalityState: 'refine', personality: incoming }],
        }, { turn });
        state = result.state;
        if (!firstText) firstText = state.npcs[0].personality;
        else assert.equal(state.npcs[0].personality, firstText, `turn ${turn} should not append another paraphrase`);
    }
    assert.equal((firstText.match(/telepath/gi) || []).length, 1, firstText);
    assert.ok(firstText.length <= DURABLE_PROFILE_LIMITS.personality);
});

test('profile evidence and memories semantically dedupe paraphrased observations', () => {
    const npc = normalizeNpcRecord({
        name: 'Myla',
        profileEvidence: { speech: ['Uses proper titles when speaking to elders.', 'Addresses elders with proper titles.'] },
        memories: ['Aris saved Myla from a lethal ambush.', 'Aris rescued Myla from the lethal ambush.'],
    });
    assert.equal(npc.profileEvidence.speech.length, 1);
    assert.match(npc.profileEvidence.speech[0], /titles/i);
    assert.equal(npc.memories.length, 1);
    assert.match(npc.memories[0], /ambush/i);
});

test('Key Relationships keep one compact entry per counterpart', () => {
    const npc = normalizeNpcRecord({
        name: 'Marris',
        keyRelationships: [
            'Elena — older sister | protective',
            'Elena — sister | protective and blunt',
        ],
    });
    assert.equal(npc.keyRelationships.length, 1);
    assert.match(npc.keyRelationships[0], /^Elena\s+—/);
    assert.match(npc.keyRelationships[0], /blunt/i);
});

test('manual profile fields are authoritative without a legacy explicit-lock marker', () => {
    const npc = normalizeNpcRecord({
        name: 'Marris', personality: 'Reserved.', speech: 'Soft.',
        manualProfileFields: ['personality', 'speech', 'personality'],
    });
    assert.deepEqual(npc.manualProfileFields, ['personality', 'speech']);
    assert.equal(Object.prototype.hasOwnProperty.call(npc, 'manualProfileLocksExplicit'), false);
});

test('chronological age is keep-by-default and grounded advancement updates it automatically', () => {
    const npc = createNpcRecord('Marris');
    npc.age = '15';

    const casual = mergeScanResult({ npcs: [npc], turn: 10 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true, age: '18',
    }] }, { turn: 11 });
    assert.equal(casual.state.npcs[0].age, '15', 'unmarked age rewrites must not silently change established chronology');

    const advanced = mergeScanResult(casual.state, { npcs: [{
        id: npc.id, name: 'Marris', present: true,
        ageState: 'advance', ageReason: 'Three explicit years have passed since she was established as age 15.', age: '18',
    }] }, { turn: 12 });
    assert.equal(advanced.state.npcs[0].age, '18');

    const backward = mergeScanResult(advanced.state, { npcs: [{
        id: npc.id, name: 'Marris', present: true,
        ageState: 'advance', ageReason: 'Another scene mentions her age.', age: '17',
    }] }, { turn: 13 });
    assert.equal(backward.state.npcs[0].age, '18', 'advance must never decrease an exact chronological age');
});

test('chronological age correction requires evidence and manual age locks remain authoritative', () => {
    const npc = createNpcRecord('Selene');
    npc.age = '24';

    const missingReason = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, present: true, ageState: 'correct', age: '23',
    }] }, { turn: 2 });
    assert.equal(missingReason.state.npcs[0].age, '24');

    const corrected = mergeScanResult(missingReason.state, { npcs: [{
        id: npc.id, present: true, ageState: 'correct', ageReason: 'Her birth record explicitly corrects the earlier age.', age: '23',
    }] }, { turn: 3 });
    assert.equal(corrected.state.npcs[0].age, '23');

    corrected.state.npcs[0].manualProfileFields = ['age'];
    const locked = mergeScanResult(corrected.state, { npcs: [{
        id: npc.id, present: true, ageState: 'advance', ageReason: 'A year passes.', age: '24',
    }] }, { turn: 4 });
    assert.equal(locked.state.npcs[0].age, '23', 'manual Age lock must remain authoritative');
});

test('apparent age is keep-by-default and evolves only from grounded visual aging evidence', () => {
    const npc = createNpcRecord('Marris');
    npc.apparentAge = '~15';

    const casual = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, present: true, apparentAge: '~18',
    }] }, { turn: 2 });
    assert.equal(casual.state.npcs[0].apparentAge, '~15');

    const evolved = mergeScanResult(casual.state, { npcs: [{
        id: npc.id, present: true,
        apparentAgeState: 'evolve',
        apparentAgeReason: 'After the three-year skip she is explicitly described as visibly older and now looks about eighteen.',
        apparentAge: '~18',
    }] }, { turn: 3 });
    assert.equal(evolved.state.npcs[0].apparentAge, '~18');

    evolved.state.npcs[0].manualProfileFields = ['apparentAge'];
    const locked = mergeScanResult(evolved.state, { npcs: [{
        id: npc.id, present: true, apparentAgeState: 'evolve',
        apparentAgeReason: 'A rejuvenation spell makes her visibly younger.', apparentAge: '~16',
    }] }, { turn: 4 });
    assert.equal(locked.state.npcs[0].apparentAge, '~18', 'manual Apparent Age lock must remain authoritative');
});

test('unknown age placeholders never erase established chronological or apparent age', () => {
    const npc = createNpcRecord('Selene');
    npc.age = '143';
    npc.apparentAge = 'early thirties';
    const result = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, name: 'Selene', age: 'Unknown', apparentAge: 'unknown', present: true,
    }] }, { turn: 2 });
    assert.equal(result.state.npcs[0].age, '143');
    assert.match(result.state.npcs[0].apparentAge, /^~3\d$/);
});

test('exact chronological age is not replaced by later qualitative visual age evidence', () => {
    const npc = createNpcRecord('Marris');
    npc.age = '24';
    const result = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, name: 'Marris', age: 'young', present: true,
    }] }, { turn: 2 });
    assert.equal(result.state.npcs[0].age, '24');
    assert.match(result.state.npcs[0].apparentAge, /^~\d+$/);
});
