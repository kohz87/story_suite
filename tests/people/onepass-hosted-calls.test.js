import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// (user decision 5, b6-soak-2) Model calls per reply in one-pass mode, through Delta's real event
// handlers on the synthetic SillyTavern host (runtime-smoke.mjs), alone or beside a fake Story Block
// v2 with the npc meters slice. Hosted, an ordinary one-pass reply makes no model call of Delta's
// own: no focused relationship pass, no backfill. Without a host the calls are the ones Delta always
// made (a new dossier's backfill, an evaluator for a relationship the block left open), and queued
// backfills no longer hold the reply.

import { runCalls } from './onepass-host-run.mjs';

// The scenarios run in the child process; ZERO (no relationship change) is defined there.
/* global ZERO */
// Two ordinary one-pass replies: Yunyun arrives (a new dossier, a complete no-change decision), then
// speaks again with a row that leaves her relationship open (the evaluator's case).
const twoReplies = async ({ reply }) => {
    const first = await reply('Yunyun, a young woman with crimson eyes, waves from the gate.',
        { npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }] });
    const second = await reply('Yunyun tells Kazuma she trusts him more and is fond of him.',
        { npcs: [{ name: 'Yunyun', present: true, mood: 'warm' }] });
    return { first: first.all, firstHeld: first.held, second: second.all };
};

test('hosted one-pass: an ordinary reply makes no extra model call (no relationship pass, no backfill)', () => {
    const hosted = runCalls('hosted-two-replies', true, twoReplies);
    assert.deepEqual(hosted.first, { scanner: 1, relationship: 0, backfill: 1, refresh: 0 }, 'a new NPC in a reply with no <Changes> block: the one fallback scan, its one backfill, no evaluator');
    assert.deepEqual(hosted.second, { scanner: 1, relationship: 0, backfill: 0, refresh: 0 }, 'a reply that names a listed person and has no <Changes> block: one fallback scan (NSD16); no evaluator, no backfill (the story\'s ~ npc lines move the meters)');
});

test('without a host the same replies make the calls they always made; the reply never waits for a backfill', () => {
    const plain = runCalls('unhosted-two-replies', false, twoReplies);
    assert.deepEqual(plain.first, { scanner: 0, relationship: 0, backfill: 1, refresh: 0 }, 'the new dossier still gets its one backfill');
    assert.equal(plain.firstHeld.backfill, 0, 'the backfill runs after the reply\'s MESSAGE_RECEIVED has returned');
    assert.deepEqual(plain.second, { scanner: 0, relationship: 1, backfill: 0, refresh: 0 }, 'the open relationship still gets its evaluator');
});

test('b6-soak-2: a crowd block admits at most 4 new people and runs at most 2 backfills per reply, none awaited', () => {
    const crowd = async ({ reply, mockState, sleep }) => {
        const npcs = Array.from({ length: 12 }, (_, i) => ({ name: `Dockhand ${String.fromCharCode(65 + i)}`, present: true, role: 'dockhand', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }));
        const first = await reply('Twelve dockhands, Dockhand A to Dockhand L, unload the barge.', { npcs });
        const admitted = globalThis.NPCStateDelta.getState().npcs.filter(npc => npc.name.startsWith('Dockhand')).length;
        const queuedAfterFirst = globalThis.NPCStateDelta.getState().pendingBackfills.length;
        const second = await reply('The quay is quiet.', { npcs: [] });
        await sleep(100);
        return { admitted, first: first.all, firstHeld: first.held, queuedAfterFirst, second: second.all, queued: globalThis.NPCStateDelta.getState().pendingBackfills.length, calls: mockState.rawCalls.length };
    };
    const plain = runCalls('unhosted-crowd', false, crowd);
    assert.equal(plain.admitted, 4, 'one block admits at most 4 new people');
    assert.equal(plain.firstHeld.backfill, 0, 'MESSAGE_RECEIVED awaited no backfill');
    assert.equal(plain.first.backfill, 2, 'at most 2 backfills follow the reply');
    assert.equal(plain.queuedAfterFirst, 2, 'the other admitted dossiers wait in the queue');
    assert.equal(plain.second.backfill, 2, 'the next reply takes the next 2');
    assert.equal(plain.queued, 0);
    const hosted = runCalls('hosted-crowd', true, crowd);
    assert.equal(hosted.admitted, 4);
    assert.deepEqual([hosted.first.backfill, hosted.second.backfill], [4, 0], '(ONEPASSCAPR2-3) hosted one-pass: each admitted person gets its one fill in its own reply');
    assert.equal(hosted.queued, 0, 'none waits for another reply');
});

test('hosted one-pass: the backfill runs on the reply, the catch-up Refresh on its own schedule', () => {
    const result = runCalls('hosted-catch-up', true, async ({ reply, settings }) => {
        settings.narrationCaptureCatchUp = 2;
        const first = await reply('Yunyun waves from the gate.',
            { npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }] });
        const second = await reply('Yunyun smiles at Kazuma.', { npcs: [{ name: 'Yunyun', present: true, relationshipImpact: 'none', relationshipDelta: ZERO }] });
        return { first: first.all, second: second.all, queued: globalThis.NPCStateDelta.getState().pendingBackfills.length };
    });
    assert.equal(result.first.backfill, 1, 'the new person is backfilled on the reply');
    assert.equal(result.second.refresh, 1, 'the catch-up Refresh of the second captured reply');
    assert.equal(result.second.backfill, 0, 'nothing left to backfill');
    assert.equal(result.queued, 0);
});

// (N8) A failed automatic catch-up Refresh shows the fill-in note once and writes nothing; a cancelled one stays silent.
async function failedCatchUp({ reply, settings, mockState, sleep }) {
    const mode = globalThis.CATCHUP_MODE;
    settings.narrationCaptureCatchUp = 2;
    const row = { npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }] };
    await reply('Yunyun waves from the gate.', row);
    const id = globalThis.NPCStateDelta.getState().npcs.find(npc => npc.name === 'Yunyun').id;
    const slow = npc => JSON.stringify([npc.personality, npc.speech, npc.mannerisms, npc.behaviorProfile, npc.background, npc.appearance, npc.overallAppearance]);
    const before = slow(globalThis.NPCStateDelta.getNpc(id));
    const warned = [];
    globalThis.toastr = { warning: text => warned.push(String(text)), error() {}, success() {}, info() {} };
    const inner = mockState.quietResponder;
    mockState.quietResponder = async args => {
        if (!/reconciliation scanner/i.test(String(args?.systemPrompt || ''))) return inner(args);
        if (mode === 'cancel') { globalThis.NPCStateDelta.cancelScan(); await sleep(50); return '{"npcs":[]}'; }
        throw new Error('upstream exploded');
    };
    await reply('Yunyun smiles at Kazuma.', { npcs: [{ name: 'Yunyun', present: true, relationshipImpact: 'none', relationshipDelta: ZERO }] });
    return { warned: warned.filter(text => /could not be filled in/.test(text)), same: slow(globalThis.NPCStateDelta.getNpc(id)) === before };
}
// The scenario runs in the child process: its source is sent with the mode written in.
const withMode = mode => ({ toString: () => `(async (args) => { globalThis.CATCHUP_MODE = ${JSON.stringify(mode)}; return (${failedCatchUp.toString()})(args); })` });

test('hosted one-pass: a failed catch-up Refresh shows the fill-in note once and writes nothing', () => {
    const result = runCalls('hosted-catch-up-error', true, withMode('error'));
    assert.equal(result.warned.length, 1, 'one note');
    assert.match(result.warned[0], /the profile for Yunyun could not be filled in\./);
    assert.equal(result.same, true, 'the record is unchanged');
});

test('hosted one-pass: a cancelled catch-up Refresh shows no note', () => {
    const result = runCalls('hosted-catch-up-cancel', true, withMode('cancel'));
    assert.deepEqual(result.warned, []);
    assert.equal(result.same, true);
});

// (ONEPASSCAP) The owner's hosted one-pass chat (12 Nov, payloads main-reply-1755 and nsd-scans-1840): Sieke and Sister Temiwa first appear
// in a reply whose block admits them (no memories, profileUpdates keyed by ids the model guessed); Sieke's new-admission backfill answers with
// a looks fill, ONE keyRelationships string and from/to edges with an underscore id; the next reply's block (the 1755 shape: existing ids,
// a new memory, an appearance change with evidence) must be in the dossier after the reply, without a Refresh.
const onePassCapture = async ({ reply, mockState, sleep }) => {
    const BASE = 'Human woman, ~20, petite build, round cheeks, remarkably large bust';
    mockState.quietResponder = async (args = {}) => {
        const asked = (/backfill scanner/i.test(String(args.systemPrompt || '')) ? String(args.prompt || '').match(/^(?:Requested|Target) NPC: (.+?)(?: [(].*)?$/m)?.[1] : undefined);
        if (asked === 'Sieke') {
            return JSON.stringify({
                npcs: [{ id: 'npc_sieke', name: 'Sieke', present: true, overallAppearance: `${BASE}. Dark hair, wide brown eyes.`,
                    memories: ['Registered Astra at the guild desk while Sister Temiwa watched from the door.'],
                    keyRelationships: 'Sister Temiwa — Church novice who brings her supper | Drops off bread at the guild every evening',
                    relationshipImpact: 'none', relationshipDelta: ZERO }],
                profileUpdates: [],
                keyRelationshipEdges: [{ from: 'npc_sieke', to: 'npc_sister_temiwa', aToB: 'friend', bToA: 'friend' }],
            });
        }
        return asked ? JSON.stringify({ npcs: [{ name: asked, present: true, relationshipImpact: 'none', relationshipDelta: ZERO }] }) : '{"npcs":[]}';
    };
    const pick = id => {
        const npc = globalThis.NPCStateDelta.getState().npcs.find(item => item.id === id) || null;
        return npc && { id: npc.id, name: npc.name, overallAppearance: npc.overallAppearance, appearance: npc.appearance, memories: npc.memories,
            keyRelationships: npc.keyRelationships, mannerisms: npc.mannerisms, evidence: npc.profileEvidence };
    };
    const first = await reply('A petite clerk, Sieke, round-cheeked, with a remarkably large bust, sits at the guild desk in an ink-stained linen bodice with strained laces, a frayed grey wool skirt and scuffed leather slippers. She chews her quill. Sister Temiwa, a weary church novice in a grey habit, waits by the door.', {
        npcs: [
            { name: 'Sieke', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'the guild clerk Astra deals with', sameIndividual: false, directInteraction: true, present: true, worldActive: false,
                role: 'Guild registration clerk', species: 'Human', gender: 'female', apparentAge: '~20', overallAppearance: BASE,
                appearance: 'An ink-stained linen bodice with strained laces, a frayed grey wool skirt, and scuffed leather slippers.', mood: 'flustered', relationshipImpact: 'none', relationshipDelta: ZERO },
            { name: 'Sister Temiwa', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'church novice', sameIndividual: false, directInteraction: true, present: true, worldActive: false,
                role: 'Church novice', species: 'Human', gender: 'female', mood: 'weary', relationshipImpact: 'none', relationshipDelta: ZERO },
        ],
        profileUpdates: [{ id: 'npc_sieke', evidence: { mannerisms: ['She chews her quill.'] } }],
        keyRelationshipEdges: [],
    });
    await sleep(300);
    const afterFirst = { sieke: pick('npc_sieke'), temiwa: pick('npc_sister-temiwa'), backfills: first.all.backfill, queued: globalThis.NPCStateDelta.getState().pendingBackfills.length };
    const second = await reply('Astra paid the fifty copper registration fee in silver coin without arguing. Sieke lunged for the coins and her bodice button snapped, exposing her bare breasts in front of Astra; she clutched the bodice shut with one arm and threw contracts at him in mortification. Sister Temiwa answered his polite question about the village\'s shortage of hands.', {
        npcs: [
            { id: 'npc_sieke', mood: 'mortified and flustered', moodState: 'replace', moodV: -2, moodA: 3, moodD: -2, present: true, relationshipImpact: 'ordinary',
                relationshipDelta: { trust: 1, affection: 0, desire: 0, tension: 2 },
                relationshipEvidence: { trust: 'Astra paid the fifty copper registration fee in silver coin without arguing.', affection: '', desire: '', tension: 'Her bodice button snapped while lunging for the coins, exposing her bare breasts in front of Astra before she threw contracts at him in mortification.' },
                memories: ['Her bodice button snapped as she lunged for Astra\'s silver, exposing her breasts in front of him.'] },
            { id: 'npc_sister-temiwa', mood: 'flustered and weary', present: true, relationshipImpact: 'ordinary', relationshipDelta: { trust: 1, affection: 0, desire: 0, tension: 0 },
                relationshipEvidence: { trust: 'Astra greeted her politely and asked about the village\'s shortage of hands before registering.', affection: '', desire: '', tension: '' } },
        ],
        profileUpdates: [{ id: 'npc_sieke', evidence: { appearance: ['her bodice button snapped', 'she clutched the bodice shut with one arm'] },
            appearanceState: 'change', appearanceReason: 'Her bodice button snapped while she lunged for the coins.',
            appearance: 'An ink-stained linen bodice with a snapped button, clutched shut with one arm; a frayed grey wool skirt and scuffed leather slippers.' }],
        keyRelationshipEdges: [{ from: 'npc_sister_temiwa', to: 'Sieke', aToB: 'friend', bToA: 'friend' }],
        relationshipsCovered: true,
    });
    await sleep(300);
    return { afterFirst, afterSecond: { sieke: pick('npc_sieke'), temiwa: pick('npc_sister-temiwa'), calls: second.all } };
};


test('ONEPASSCAP-2/3: one keyRelationships string is one entry per line; an edge endpoint resolves by exact id, folded id, then name', async () => {
    const { normalizeScanNpc, mergeScanResult } = await import('../../modules/people/core/core.js');
    const { resolveNpcId, resolveNpcReference } = await import('../../modules/people/social/social.js');
    const one = 'Sister Temiwa — Church novice who brings her supper | Drops off bread at the guild every evening';
    assert.deepEqual(normalizeScanNpc({ name: 'Sieke', keyRelationships: one }).keyRelationships, normalizeScanNpc({ name: 'Sieke', keyRelationships: [one] }).keyRelationships, 'the string reads as the one-entry list');
    assert.equal(normalizeScanNpc({ name: 'Sieke', keyRelationships: `${one}\nMarrit — employer | strict` }).keyRelationships.length, 2, 'one entry per line');
    assert.deepEqual(normalizeScanNpc({ name: 'Sieke', keyRelationships: ['Marrit — employer'] }).keyRelationships, ['Marrit — employer'], 'a list reads as before');
    assert.deepEqual(normalizeScanNpc({ name: 'Sieke', keyRelationships: '  ' }).keyRelationships, []);
    const npcs = [{ id: 'npc_sieke', name: 'Sieke' }, { id: 'npc_sister-temiwa', name: 'Sister Temiwa' }];
    assert.equal(resolveNpcId(npcs, 'npc_sister-temiwa')?.name, 'Sister Temiwa', 'exact');
    assert.equal(resolveNpcId(npcs, 'NPC_Sister_Temiwa')?.name, 'Sister Temiwa', 'hyphen, underscore and case folded');
    assert.equal(resolveNpcId(npcs, 'Sister Temiwa'), null, 'a name is not an id');
    assert.equal(resolveNpcId([...npcs, { id: 'npc_sister_temiwa', name: 'Another Temiwa' }], 'npc_sister_temiwa')?.name, 'Another Temiwa', 'an exact id wins over a fold');
    assert.equal(resolveNpcId([{ id: 'npc_a-b', name: 'A' }, { id: 'npc_a_b', name: 'B' }], 'NPC_A_B'), null, 'two folded matches: none');
    assert.equal(resolveNpcReference(npcs, 'Sister Temiwa')?.id, 'npc_sister-temiwa', 'then the name');
    const state = { npcs: [{ id: 'npc_sieke', name: 'Sieke', keyRelationships: [] }, { id: 'npc_sister-temiwa', name: 'Sister Temiwa', keyRelationships: [] }], candidates: [] };
    const merged = mergeScanResult(state, { npcs: [], keyRelationshipEdges: [{ from: 'npc_sieke', to: 'npc_sister_temiwa', aToB: 'friend', bToA: 'friend' }] }, {});
    const ties = id => merged.state.npcs.find(npc => npc.id === id).keyRelationships;
    assert.ok(ties('npc_sieke').some(text => /^Sister Temiwa — friend/.test(text)), 'from = an exact id held in the label slot');
    assert.ok(ties('npc_sister-temiwa').some(text => /^Sieke — friend/.test(text)), 'to = an underscore id for the hyphen id');
    const guessed = mergeScanResult(state, { npcs: [], profileUpdates: [{ id: 'npc_sister_temiwa', evidence: { mannerisms: ['She tucks her hands into her sleeves.'] } }] }, {});
    assert.deepEqual(guessed.state.npcs.find(npc => npc.id === 'npc_sister-temiwa').profileEvidence.mannerisms, ['She tucks her hands into her sleeves.'], 'a profile update keyed by the guessed underscore id reaches the dossier');
    const unknown = mergeScanResult(state, { npcs: [], keyRelationshipEdges: [{ from: 'npc_sieke', to: 'npc_nobody', aToB: 'friend', bToA: 'friend' }] }, {});
    assert.deepEqual(unknown.state.npcs.find(npc => npc.id === 'npc_sieke').keyRelationships, [], 'an id that resolves to no one is never written as a tie\'s name');
    const named = mergeScanResult(state, { npcs: [], keyRelationshipEdges: [{ aId: 'npc_sieke', b: 'Marrit', aToB: 'employer' }] }, {});
    assert.ok(named.state.npcs.find(npc => npc.id === 'npc_sieke').keyRelationships.some(text => /^Marrit — employer/.test(text)), 'a person without a dossier is still written by name, as before');
});

// (ONEPASSCAPR2-4, -5 and the old-reply rule) The merge keeps an accepted detailed bond when the same reply's edge is only the short form,
// rejects a name or alias two dossiers share, and a history re-read (historicalRead) keeps the readings it always had.
test('ONEPASSCAPR2-4/5: a same-reply edge keeps the detailed bond; an ambiguous alias binds to nobody; a historical re-read is unchanged', async () => {
    const { mergeScanResult } = await import('../../modules/people/core/core.js');
    const detail = 'Sister Temiwa — Church novice who brings her supper | Drops off bread at the guild every evening';
    const base = () => ({ npcs: [{ id: 'npc_sieke', name: 'Sieke', keyRelationships: [] }, { id: 'npc_sister-temiwa', name: 'Sister Temiwa', keyRelationships: [] }], candidates: [] });
    const scan = { npcs: [{ id: 'npc_sieke', name: 'Sieke', keyRelationships: detail }], keyRelationshipEdges: [{ from: 'npc_sieke', to: 'npc_sister_temiwa', aToB: 'friend', bToA: 'friend' }] };
    const live = mergeScanResult(base(), scan, {});
    const kept = live.state.npcs.find(npc => npc.id === 'npc_sieke').keyRelationships;
    assert.equal(kept.length, 1);
    assert.ok(kept[0].startsWith('Sister Temiwa — Church novice who brings her supper') && kept[0].endsWith('| Drops off bread at the guild every evening'), `the accepted role and note survive the short edge: ${kept[0]}`);
    assert.ok(live.state.npcs.find(npc => npc.id === 'npc_sister-temiwa').keyRelationships.some(text => /^Sieke — friend/.test(text)), 'the other side still gets the edge');
    // A historical re-read reads the row as before: the one string is not split, the underscore id is not folded.
    const old = mergeScanResult(base(), scan, { historicalRead: true });
    assert.deepEqual(old.state.npcs.find(npc => npc.id === 'npc_sieke').keyRelationships, [], 'an old reply\'s string ties and folded id stay dropped (bytes unchanged)');
    // A name two dossiers share is never guessed.
    const twins = () => ({ npcs: [{ id: 'npc_alice', name: 'Alice', keyRelationships: [] }, { id: 'npc_brenda', name: 'Brenda', aliases: ['Sister'], keyRelationships: [] }, { id: 'npc_carla', name: 'Carla', aliases: ['Sister'], keyRelationships: [] }], candidates: [] });
    const edge = mergeScanResult(twins(), { npcs: [], keyRelationshipEdges: [{ a: 'Alice', b: 'Sister', aToB: 'friend', bToA: 'friend' }] }, {});
    for (const npc of edge.state.npcs) assert.deepEqual(npc.keyRelationships, [], `${npc.name} is not written by an ambiguous alias`);
    const update = mergeScanResult(twins(), { npcs: [], profileUpdates: [{ name: 'Sister', evidence: { mannerisms: ['She hums.'] } }] }, {});
    for (const npc of update.state.npcs) assert.equal(npc.profileEvidence?.mannerisms?.length || 0, 0, `${npc.name} gets no evidence from an ambiguous alias`);
    const exact = mergeScanResult(twins(), { npcs: [], keyRelationshipEdges: [{ aId: 'npc_alice', bId: 'npc_carla', aToB: 'friend', bToA: 'friend' }] }, {});
    assert.ok(exact.state.npcs.find(npc => npc.id === 'npc_carla').keyRelationships.some(text => /^Alice — friend/.test(text)), 'an exact id still wins');
    const oldTwins = mergeScanResult(twins(), { npcs: [], keyRelationshipEdges: [{ a: 'Alice', b: 'Sister', aToB: 'friend', bToA: 'friend' }] }, { historicalRead: true });
    assert.ok(oldTwins.state.npcs.find(npc => npc.id === 'npc_brenda').keyRelationships.length > 0, 'a historical re-read keeps its first-match reading');
});

test('ONEPASSMISS-1: missing hosted capture scans the same reply once, admits new people and reports it quietly', () => {
    const result = runCalls('missing-capture', true, async ({ reply, settings, mockState, emitAll, sleep, kinds }) => {
        settings.scanEvery = 10;
        mockState.sdk.feature = id => id !== 'npc-state-delta.scan-every-reply';
        const people = ['Sieke', 'Sister Temiwa'].map(name => ({ name, present: true, role: 'clerk', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named person', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }));
        mockState.quietResponder = async (args = {}) => /isolated dossier scanner\./i.test(String(args.systemPrompt || '')) ? JSON.stringify({ npcs: people }) : '{"npcs":[]}';
        const first = await reply('Sieke waves. Sister Temiwa greets her at the gate.', null);
        const scanCount = globalThis.NPCStateDelta.getState().scanCount;
        await emitAll('message_received', first.id);
        await sleep(100);
        return {
            missing: globalThis.NPCStateDelta.diagnosticBundle().narrationCapture.missing,
            calls: first.all, afterDuplicate: kinds(), scanCount, scanCountAfterDuplicate: globalThis.NPCStateDelta.getState().scanCount,
            people: globalThis.NPCStateDelta.getState().npcs.map(npc => npc.name),
            lines: globalThis.NPCStateDelta.scannerReport().filter(line => line.includes('the reply had no NPC capture')),
            prompt: mockState.rawCalls.find(call => /isolated dossier scanner\./i.test(String(call?.[0]?.systemPrompt || '')))?.[0]?.prompt,
        };
    });
    assert.equal(result.missing, 0, 'a hosted reply is no longer asked for a block, so none is counted missing');
    assert.equal(result.calls.scanner, 1);
    assert.equal(result.calls.relationship, 0, 'hosted one-pass keeps its focused-pass budget');
    assert.equal(result.calls.backfill, 2, 'every admitted dossier gets its one fill on the reply (ONEPASSCAPR2-3; the 4-per-reply admission cap still bounds it)');
    assert.equal(result.afterDuplicate.scanner, 1, 'a duplicate receipt does not scan again');
    assert.equal(result.scanCountAfterDuplicate, result.scanCount, 'a duplicate receipt is not applied twice');
    assert.ok(result.people.includes('Sieke') && result.people.includes('Sister Temiwa'));
    assert.match(result.prompt, /Sieke waves/);
    assert.deepEqual(result.lines, ['Problems: the reply had no NPC capture; scanned it instead.']);
});


test('ONEPASSMISS-1: a fallback result is discarded if its chat changes during the request', () => {
    const result = runCalls('fallback-chat-change', true, async ({ reply, settings, mockState, sleep }) => {
        settings.scanEvery = 10;
        mockState.sdk.feature = id => id !== 'npc-state-delta.scan-every-reply';
        let release;
        mockState.quietResponder = async args => {
            if (!/isolated dossier scanner\./i.test(String(args.systemPrompt || ''))) return '{"npcs":[]}';
            return new Promise(resolve => { release = resolve; });
        };
        const pending = reply('At the gate, Sieke waves.', null);
        for (let i = 0; i < 100 && !release; i += 1) await sleep(10);
        if (!release) throw new Error('the fallback did not start');
        mockState.context.chatId = 'another-chat';
        mockState.context.getCurrentChatId = () => 'another-chat';
        release(JSON.stringify({ npcs: [{ name: 'Sieke', present: true, identityKind: 'proper_name', dossierSignal: 'high', directInteraction: true }] }));
        await pending;
        mockState.context.chatId = 'smoke-chat';
        mockState.context.getCurrentChatId = () => 'smoke-chat';
        await sleep(100);
        return { names: globalThis.NPCStateDelta.getState().npcs.map(npc => npc.name), lines: globalThis.NPCStateDelta.scannerReport().filter(line => line.includes('the reply had no NPC capture')) };
    });
    assert.ok(!result.names.includes('Sieke'), 'no stale dossier is committed');
    assert.deepEqual(result.lines, [], 'a discarded result is not reported as scanned');
});


test('ONEPASSMISS-2: the settings text no longer ties one-pass to Auto scan', () => {
    const html = fs.readFileSync(new URL('../../modules/people/settings/runtime-settings-html.js', import.meta.url), 'utf8');
    assert.match(html, /Works on its own, with Auto scan on or off/);
    assert.doesNotMatch(html, /'With Auto scan, the roleplay model/);
});
