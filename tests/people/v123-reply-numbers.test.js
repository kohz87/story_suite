import { partsSource } from './helpers/parts-source.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

const TRY_MARKER = '\ntry {\n    await import(pathToFileURL(path.join(extRoot, \'index.js\'))';

function runHostScenario(name, scenario) {
    let source = fs.readFileSync(new URL('./runtime-smoke.mjs', import.meta.url), 'utf8');
    source = source.replace('const here = path.dirname(fileURLToPath(import.meta.url));', `const here = ${JSON.stringify(fileURLToPath(new URL('.', import.meta.url)))};`);
    const cut = source.indexOf(TRY_MARKER);
    if (cut < 0) throw new Error('Runtime smoke import marker changed');
    const script = `${source.slice(0, cut)}
globalThis.document.readyState = 'loading';
try {
    await import(pathToFileURL(path.join(extRoot, 'index.js')).href + \`?t=\${Date.now()}\`);
    await sleep(30);
    eventSource.emit('app_ready');
    eventSource.emit('extension_settings_loaded');
    await sleep(30);
    await (${scenario.toString()})();
    console.log('reply number scenario ${name} passed');
} finally {
    for (const handle of pendingHostTimers) nativeClearTimeout(handle);
    pendingHostTimers.clear();
    delete globalThis.__npcMock;
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
`;
    try {
        execFileSync(process.execPath, ['--import', new URL('./active-runtime-test-setup.mjs', import.meta.url).href, '--input-type=module'], {
            input: script, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
        });
    } catch (error) {
        const stderr = String(error.stderr || '');
        const detail = stderr.split('\n').filter(line => /Error|assert|expected|actual/i.test(line)).slice(0, 30).join('\n');
        throw new Error(`scenario ${name} failed:\n${detail || stderr.slice(-4000)}`);
    }
}

test('v1.2.3 synthetic host: the dossier follows the chat\'s reply numbers through a swipe', () => {
    runHostScenario('reply-numbers', async () => {
        const runtime = globalThis.NPCStateDelta;
        let mood = 'calm';
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', mood, identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        const reply = async (user, text) => {
            mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: user });
            mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text] });
            const id = mockState.context.chat.length - 1;
            await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
            await sleep(200);
            return id;
        };
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'The guild hall is quiet.' });
        const first = await reply('Who is at the gate?', 'Yunyun, the calm adventurer, waits at the gate.');
        assert.equal(runtime.getDossierState().reply, first);
        // 1.2.4 present row: no chatter, so the right half holds a copy of the now lines (the card keeps its own for wide grids).
        const cast = runtime.presentCastHtml();
        assert.match(cast, /<div class="npc-state-delta-present-cell npc-state-delta-present-cell-now" data-npc-id="[^"]+"[^>]*>\s*<button[\s\S]*<\/button><div class="npc-state-delta-present-side npc-state-delta-present-side-now"><span class="npc-state-delta-present-now">/);
        assert.equal((cast.match(/npc-state-delta-present-now-mood/g) || []).length, 2, 'on the card and in the right half');
        assert.doesNotMatch(cast, /present-side-idle|npc-state-delta-chatter/);

        mood = 'nervous';
        const second = await reply('Say hello.', 'Yunyun turns nervous and fidgets with her wand.');
        let state = runtime.getDossierState();
        assert.equal(state.reply, second);
        let yunyun = state.npcs.find(npc => npc.name === 'Yunyun');
        assert.equal(yunyun.fieldChanges.mood, state.turn, 'the counter still stamps fieldChanges');
        assert.equal(yunyun.fieldChangeMessages.mood, second, 'the reply number is the chat message index');
        assert.notEqual(state.turn, second, 'the counter and the reply number are different numbers');

        // A swipe of the same reply restores the boundary before it and rescans it: the reply number
        // stays the message index even though Delta's counter moves on.
        const turnBeforeSwipe = state.turn;
        mood = 'sleepy';
        mockState.context.chat[second] = { is_user: false, is_system: false, name: 'Megumin', swipe_id: 1,
            mes: 'On the other swipe, Yunyun yawns, sleepy at the gate.', swipes: ['Yunyun turns nervous and fidgets with her wand.', 'On the other swipe, Yunyun yawns, sleepy at the gate.'] };
        mockState.swipeState = 'swiping';
        eventSource.emit('message_swiped', second);
        await sleep(150);
        eventSource.emit('message_received', second);
        await sleep(150);
        mockState.swipeState = 'none';
        await sleep(500);
        state = runtime.getDossierState();
        yunyun = state.npcs.find(npc => npc.name === 'Yunyun');
        assert.equal(yunyun.mood, 'sleepy', 'the swiped reply was rescanned');
        assert.equal(yunyun.fieldChangeMessages.mood, second, 'same reply, same number');
        assert.equal(state.reply, second);
        assert.ok(state.turn >= turnBeforeSwipe, `counter ${state.turn} vs ${turnBeforeSwipe}`);

        // Deleting the swiped reply rolls back to the boundary before it, with that branch's records.
        mockState.context.chat.splice(second - 1, 2);
        eventSource.emit('message_deleted', second - 1);
        await sleep(500);
        state = runtime.getDossierState();
        yunyun = state.npcs.find(npc => npc.name === 'Yunyun');
        assert.equal(state.reply, first);
        assert.equal(yunyun.mood, 'calm');
        assert.equal(yunyun.fieldChangeMessages?.mood, undefined, 'the restored boundary has no record from the deleted reply');
    });
});
