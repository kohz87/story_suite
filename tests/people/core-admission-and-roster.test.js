import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyNpcStateCommand,
    buildScannerPrompt,
    createNpcRecord,
    mergeScanResult,
    inferNpcIdentityKind,
    normalizeNpcRecord,
} from '../../modules/people/core/core.js';

test('classifies obvious role labels separately from proper names', () => {
    assert.equal(inferNpcIdentityKind('Guild Boy'), 'role_label');
    assert.equal(inferNpcIdentityKind('Gate Guard'), 'role_label');
    assert.equal(inferNpcIdentityKind('Local Stable Hand'), 'role_label');
    assert.equal(inferNpcIdentityKind('Local Butcher'), 'role_label');
    assert.equal(inferNpcIdentityKind('Marris'), 'proper_name');
    assert.equal(inferNpcIdentityKind('Captain Veyra'), 'proper_name');
});

test('holds a first-time incidental role-only NPC as a lightweight candidate', () => {
    const result = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Guild Boy', aliases: ['Dock Gopher'], identityKind: 'role_label', dossierSignal: 'incidental', present: true, role: 'Guild Apprentice', location: 'Side Dock',
        role: 'Guild Apprentice', appearance: 'Young boy wearing a stained leather apron.',
    }] }, { turn: 1 });
    assert.equal(result.state.npcs.length, 0);
    assert.equal(result.state.candidates.length, 1);
    assert.equal(result.state.candidates[0].name, 'Guild Boy');
    assert.equal(result.state.candidates[0].seenCount, 1);
    assert.equal('appearance' in result.state.candidates[0], false, 'candidate buffer must stay lightweight');
    assert.equal(result.report.candidates.length, 1);
});

test('promotes an incidental role candidate only when the story clearly identifies the same individual again', () => {
    const first = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Guild Boy', identityKind: 'role_label', dossierSignal: 'incidental', present: true,
    }] }, { turn: 1 });
    const second = mergeScanResult(first.state, { npcs: [{
        name: 'Guild Boy', identityKind: 'role_label', dossierSignal: 'incidental', sameIndividual: true, present: true,
        role: 'Guild Apprentice',
    }] }, { turn: 2 });
    assert.equal(second.state.candidates.length, 0);
    assert.equal(second.state.npcs.length, 1);
    assert.equal(second.state.npcs[0].name, 'Guild Boy');
    assert.equal(second.report.promoted.length, 1);
});

test('does not promote repeated generic role labels without same-individual evidence', () => {
    const first = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Gate Guard', identityKind: 'role_label', dossierSignal: 'incidental', present: true,
    }] }, { turn: 1 });
    const second = mergeScanResult(first.state, { npcs: [{
        name: 'Gate Guard', identityKind: 'role_label', dossierSignal: 'incidental', present: true,
    }] }, { turn: 2 });
    assert.equal(second.state.npcs.length, 0);
    assert.equal(second.state.candidates.length, 1);
    assert.equal(second.state.candidates[0].seenCount, 1);
    assert.equal(second.state.candidates[0].lastSeenTurn, 1, 'ambiguous same-role sightings should not refresh continuity');
});

test('obvious personal names override a mistaken role_label classification in Conservative mode', () => {
    const result = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Toris', identityKind: 'role_label', dossierSignal: 'incidental', present: true,
        role: 'Guild Receptionist',
    }] }, { turn: 1, admissionMode: 'conservative' });
    assert.equal(result.state.candidates.length, 0);
    assert.equal(result.state.npcs.length, 1);
    assert.equal(result.state.npcs[0].name, 'Toris');
});

test('conservative admission keeps routine direct transactions as candidates', () => {
    const result = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Toll Guard', identityKind: 'role_label', dossierSignal: 'incidental', directInteraction: true, present: true,
        role: 'Gate Toll Guard', location: 'East Gate',
    }] }, { turn: 1, admissionMode: 'conservative' });
    assert.equal(result.state.npcs.length, 0);
    assert.equal(result.state.candidates.length, 1);
    assert.equal(result.state.candidates[0].name, 'Toll Guard');
});

test('conservative never lets model relevance alone promote first-seen local service roles', () => {
    for (const [name, signal] of [['Local Stable Hand', 'persistent'], ['Local Butcher', 'meaningful']]) {
        const result = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
            name, identityKind: 'role_label', dossierSignal: signal, directInteraction: false, present: true,
            role: name.replace(/^Local /, ''), location: 'Village',
        }] }, { turn: 1, admissionMode: 'conservative' });
        assert.equal(result.state.npcs.length, 0, `${name} should not become a dossier on first sight`);
        assert.equal(result.state.candidates.length, 1);
        assert.equal(result.state.candidates[0].name, name);
    }
});

test('balanced admission can create a routine directly interactive role-label NPC immediately', () => {
    const result = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Receptionist', identityKind: 'role_label', dossierSignal: 'incidental', directInteraction: true, present: true,
        role: 'Guild Receptionist', location: 'Bluewatch Adventurer Guild',
    }] }, { turn: 1, admissionMode: 'balanced' });
    assert.equal(result.state.candidates.length, 0);
    assert.equal(result.state.npcs.length, 1);
    assert.equal(result.state.npcs[0].name, 'Receptionist');
});

test('manual-only admission never auto-promotes even a proper name', () => {
    const result = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Marris', identityKind: 'proper_name', dossierSignal: 'persistent', directInteraction: true, present: true,
    }] }, { turn: 1, admissionMode: 'manual_only' });
    assert.equal(result.state.npcs.length, 0);
    assert.equal(result.state.candidates.length, 1);
    assert.equal(result.state.candidates[0].name, 'Marris');
});

test('conservative keeps first-seen meaningful role labels as candidates while proper names still admit immediately', () => {
    const role = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Masked Gate Guard', identityKind: 'role_label', dossierSignal: 'meaningful', directInteraction: true, present: true,
        dossierReason: 'Negotiated a recurring passage agreement with the player.',
    }] }, { turn: 1, admissionMode: 'conservative' });
    assert.equal(role.state.npcs.length, 0);
    assert.equal(role.state.candidates.length, 1);
    assert.equal(role.state.candidates[0].name, 'Masked Gate Guard');
    const named = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Marris', identityKind: 'proper_name', dossierSignal: 'incidental', importance: 0, present: true,
    }] }, { turn: 1, admissionMode: 'conservative' });
    assert.equal(named.state.npcs.length, 1);
    assert.equal(named.state.npcs[0].name, 'Marris');
});

test('balanced still admits meaningful role-label NPCs immediately', () => {
    const role = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Local Butcher', identityKind: 'role_label', dossierSignal: 'meaningful', directInteraction: false, present: true,
        role: 'Butcher', location: 'Market Street',
    }] }, { turn: 1, admissionMode: 'balanced' });
    assert.equal(role.state.candidates.length, 0);
    assert.equal(role.state.npcs.length, 1);
    assert.equal(role.state.npcs[0].name, 'Local Butcher');
});

test('stale incidental candidates expire after the candidate TTL', () => {
    const first = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Stablehand', identityKind: 'role_label', dossierSignal: 'incidental', present: true,
    }] }, { turn: 1 });
    const expired = mergeScanResult(first.state, { npcs: [] }, { turn: 17 });
    assert.equal(expired.state.candidates.length, 0);
    assert.deepEqual(expired.report.expired, ['Stablehand']);
});

test('explicit manual add promotes a held candidate immediately and preserves lightweight identity hints', () => {
    const scanned = mergeScanResult({ npcs: [], candidates: [], dismissed: [], turn: 1 }, { npcs: [{
        name: 'Guild Boy', aliases: ['Dock Gopher'], identityKind: 'role_label', dossierSignal: 'incidental', present: true,
        role: 'Guild Apprentice', location: 'Side Dock',
    }] }, { turn: 1 });
    const added = applyNpcStateCommand(scanned.state, { action: 'add', name: 'Guild Boy' }, { turn: 2 });
    assert.equal(added.state.candidates.length, 0);
    assert.equal(added.state.npcs.length, 1);
    assert.equal(added.state.npcs[0].name, 'Guild Boy');
    assert.equal(added.state.npcs[0].role, 'Guild Apprentice');
    assert.equal(added.state.npcs[0].location, 'Side Dock');
    assert.deepEqual(added.state.npcs[0].aliases, ['Dock Gopher']);
});

test('new dossier-worthy NPCs receive full grounded first-pass enrichment without player interaction', () => {
    const prompt = buildScannerPrompt({
        transcript: 'Captain Selene Voss stands at the eastern gate. The silver-haired elf wears a weathered blue coat over chainmail and watches the missing patrol route with visible worry. World State: Selene Voss | Mood: worried | Agenda: find the missing patrols.',
        admissionMode: 'conservative',
        userName: 'Aris',
        charName: 'Ersveil',
    });
    assert.match(prompt, /populate every grounded field now/i);
        assert.match(prompt, /NEVER enrichment/i);
    assert.match(prompt, /Incidental role candidates may stay lightweight/i);
    assert.match(prompt, /Use narration, World State, durable Inner Chatter/i);
    assert.match(prompt, /NEW\/CANDIDATE: include name,identityKind/i);
    assert.match(prompt, /directInteraction,present,worldActive/i);
    assert.match(prompt, /populate every grounded field now/i);
    assert.match(prompt, /behaviorProfile FULL max6 "Label: level - effect" levers/i);
});

test('non-interacting proper-name NPC creation preserves every supplied grounded dossier field', () => {
    const result = mergeScanResult({ npcs: [], candidates: [], turn: 0 }, { npcs: [{
        name: 'Selene Voss',
        identityKind: 'proper_name',
        dossierSignal: 'incidental',
        dossierReason: 'Named individual observed at the gate.',
        directInteraction: false,
        present: true,
        worldActive: false,
        role: 'Gate captain',
        species: 'elf',
        apparentAge: 'early thirties',
        appearance: 'Silver-haired elf in a weathered blue coat over chainmail.',
        personality: 'Watchful and duty-bound.',
        speech: 'Crisp military phrasing.',
        background: 'Commands the eastern gate patrols.',
        mood: 'Worried',
        location: 'Eastern gate',
        goal: 'Find the missing patrols',
        status: 'Monitoring the patrol road.',
        mannerisms: ['Checks the road between conversations.'],
        memories: ['Two patrols failed to return from the eastern road.'],
        lifeState: 'alive',
        lifeStateCertainty: 'explicit',
    }] }, { turn: 1, admissionMode: 'conservative' });
    assert.equal(result.state.npcs.length, 1, 'proper names should be admitted in Conservative mode without PC interaction');
    const npc = result.state.npcs[0];
    assert.equal(npc.name, 'Selene Voss');
    assert.equal(npc.role, 'Gate captain');
    assert.equal(npc.species, 'elf');
    assert.match(npc.apparentAge, /^~3\d$/);
    assert.match(npc.appearance, /Silver-haired elf/);
    assert.equal(npc.personality, 'Watchful and duty-bound.');
    assert.equal(npc.speech, 'Crisp military phrasing.');
    assert.equal(npc.background, 'Commands the eastern gate patrols.');
    assert.equal(npc.mood, 'Worried');
    assert.equal(npc.location, 'Eastern gate');
    assert.equal(npc.goal, 'Find the missing patrols');
    assert.equal(npc.status, 'Monitoring the patrol road.');
    assert.deepEqual(npc.mannerisms, ['Checks the road between conversations.']);
    assert.deepEqual(npc.memories, ['Two patrols failed to return from the eastern road.']);
    assert.equal(npc.present, true);
    assert.equal(npc.lifeState, 'alive');
});

test('ID-targeted remove deletes the exact dossier when duplicate labels exist', () => {
    const first = normalizeNpcRecord({ id: 'npc_same_a', name: 'Stable Hand', aliases: [], role: 'stable hand' });
    const second = normalizeNpcRecord({ id: 'npc_same_b', name: 'Stable Hand', aliases: [], role: 'stable hand' });
    const result = applyNpcStateCommand(
        { npcs: [first, second], candidates: [], dismissed: [], turn: 5 },
        { action: 'remove', name: 'Stable Hand', npcId: 'npc_same_b' },
        { turn: 5 },
    );
    assert.deepEqual(result.state.npcs.map(npc => npc.id), ['npc_same_a']);
    assert.equal(result.report.npcId, 'npc_same_b');
    assert.equal(result.report.status, 'removed');
    assert.ok(result.state.dismissed.includes('stable hand'));
});

test('manual remove suppresses rediscovery and later add restores the dossier', () => {
    const original = createNpcRecord('Yunyun');
    original.aliases = ['Yun-Yun'];
    let result = applyNpcStateCommand({ npcs: [original], turn: 5, dismissed: [] }, { action: 'remove', name: 'Yunyun' }, { turn: 5 });
    assert.equal(result.state.npcs.length, 0);
    assert.equal(result.report.status, 'removed');
    assert.ok(result.state.dismissed.includes('yunyun'));

    const scan = mergeScanResult(result.state, { npcs: [{ name: 'Yunyun', present: true }] }, {
        maxNpcs: 6,
        excludeNames: result.state.dismissed,
        turn: 6,
    });
    assert.equal(scan.state.npcs.length, 0, 'suppressed NPC should not be recreated by scanner');

    result = applyNpcStateCommand(result.state, { action: 'add', name: 'Yunyun' }, { maxNpcs: 6, turn: 6 });
    assert.equal(result.report.status, 'added');
    assert.equal(result.state.npcs[0].name, 'Yunyun');
    assert.ok(!result.state.dismissed.includes('yunyun'));
});
