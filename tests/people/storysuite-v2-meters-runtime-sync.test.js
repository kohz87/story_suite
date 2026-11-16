import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runtimeSource } from './helpers/runtime-source.js';
import { runHostScenario, scenarioOutput, turns } from './storysuite-v2-meters-runtime.helpers.js';

test('hosted: a scan\'s relationship change goes to the slice as npc.adjust; the injection reads the slice', () => {
    const output = runHostScenario('meters-hosted', async () => {
        const sdk = {
            registered: [], sent: [], entries: [],
            registerModule(def) { sdk.registered.push(def); },
            command: async (type, payload, options) => { sdk.sent.push({ type, payload, options: options ?? null }); return { ok: true, receipt: { summary: '' } }; },
            query: name => (name === 'npc.meters' ? structuredClone(sdk.entries) : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    }, async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const { id, relationship } = await turns();
        assert.ok(relationship && relationship.trust > 0, `the scan changed Yunyun's trust (${JSON.stringify(relationship)})`);
        assert.ok(await waitFor(() => mockState.sdk.sent.length >= 1), 'a command was sent');
        const sent = mockState.sdk.sent.filter(item => item.type === 'npc.adjust');
        assert.equal(sent.length, 1, JSON.stringify(mockState.sdk.sent));
        assert.equal(sent[0].payload.name, 'Yunyun');
        assert.deepEqual(sent[0].payload.meters, { trust: relationship.trust });
        assert.deepEqual(sent[0].payload.start, { trust: 0, affection: 0, desire: 0, tension: 0 });
        assert.equal(sent[0].payload.reply, id);
        assert.equal(sent[0].payload.reason, 'Yunyun confided a private secret to Kazuma.', 'rule NSDFOLLOW-3: the scan\'s reason for this reply rides along');
        assert.deepEqual(sent[0].options, { background: true }, 'sent as Delta\'s own action (cause ui), and as a background change: Story Block saves it in its late window');
        const injectionBefore = api.injectionPreview().text;
        // The slice says otherwise: views and the injection follow it, Delta's own data does not.
        mockState.sdk.entries = [{ key: 'npc_yunyun', name: 'Yunyun', meters: { trust: 88, affection: 0, desire: 0, tension: 0 }, stages: {}, unlocked: [] }];
        assert.equal(api.getDossierState().npcs.find(npc => npc.name === 'Yunyun').relationship.trust, 88);
        assert.equal(api.getState().npcs.find(npc => npc.name === 'Yunyun').relationship.trust, relationship.trust, 'the sidecar keeps its own numbers');
        api.render();
        await turn('Yunyun nods.');
        await sleep(200);
        assert.notEqual(api.injectionPreview().text, injectionBefore);
        assert.match(api.injectionPreview().text, /strong trust/);
        console.log('RESULT ' + JSON.stringify({ relationship, injection: injectionBefore }));
    });
    assert.ok(scenarioOutput(output).relationship.trust > 0);
});

// (NSD r2) Story Block writes a module's command onto its head reply. A scan that finishes after the
// reader swiped that reply belongs to the swipe that is gone: its changes stay in Delta's sidecar
// (as its own rules decide) but nothing is sent to the host, so the new swipe's meters are untouched.
test('hosted: a scan that finishes after a swipe sends no npc.adjust onto the new swipe', () => {
    const output = runHostScenario('meters-swipe-guard', async () => {
        const sdk = {
            registered: [], sent: [],
            registerModule(def) { sdk.registered.push(def); },
            command: async (type, payload, options) => { sdk.sent.push({ type, payload, options: options ?? null }); return { ok: true, receipt: { summary: '' } }; },
            query: () => null,
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    }, async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const arrive = { name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } };
        mockState.quietResponder = async () => JSON.stringify({ npcs: [arrive] });
        await turn('Yunyun waves from the gate.');
        await sleep(200);
        const confide = {
            ...arrive, relationshipImpact: 'meaningful', relationshipDelta: { trust: 2, affection: 0, desire: 0, tension: 0 },
            relationshipEvidence: { trust: 'Yunyun confided a private secret and trusted Kazuma with it.', affection: '', desire: '', tension: '' },
            relationshipChangeReason: 'Yunyun confided a private secret to Kazuma.',
        };
        // The scanner answers only once the reader has swiped the reply it is reading.
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        let asked = 0;
        mockState.quietResponder = async () => {
            asked += 1;
            await gate;
            const id = api.getState().npcs.find(npc => npc.name === 'Yunyun')?.id;
            return JSON.stringify({ npcs: [{ ...confide, ...(id ? { id } : {}) }] });
        };
        const sentBefore = mockState.sdk.sent.length;
        const replied = turn('Yunyun confided a private secret and trusted Kazuma with it, whispering by the gate.');
        assert.ok(await waitFor(() => asked > 0), 'the scan asked the scanner');
        const message = mockState.context.chat.at(-1);
        const next = 'Yunyun confided a private secret and trusted Kazuma with it, a second time, by the well.';
        message.swipes.push(next);
        message.swipe_id = 1;
        message.mes = next;
        release();
        await replied;
        await sleep(400);
        const yunyun = api.getState().npcs.find(npc => npc.name === 'Yunyun');
        console.log('RESULT ' + JSON.stringify({
            trust: yunyun?.relationship?.trust ?? null,
            adjusts: mockState.sdk.sent.slice(sentBefore).filter(item => item.type === 'npc.adjust').length,
        }));
    });
    const result = scenarioOutput(output);
    assert.ok(result.trust > 0, `the scan itself was kept by Delta's own rules (trust ${result.trust})`);
    assert.equal(result.adjusts, 0, 'nothing was sent onto the swipe now shown');
});

// (live run 3) Pell, Harek and Theobald were admitted while the host said "A native change is finishing": their npc.meet was not kept and was never
// sent again, so two of them had no slice entry for the rest of the chat. The refused meeting is owed and goes out with the person's next scan.
test('hosted: a meeting the host did not keep (a native change finishing) is held and sent again once, in order', () => {
    const output = runHostScenario('meters-meet-owed', async () => {
        const sdk = {
            registered: [], sent: [], meets: 0,
            registerModule(def) { sdk.registered.push(def); },
            command: async (type, payload) => {
                sdk.sent.push({ type, payload });
                if (type === 'npc.meet' && (sdk.meets += 1) === 1) return { ok: false, code: 'RESTORE_PENDING', message: 'NPC State Delta is waiting: A native change is finishing; every part must agree before the story goes on.' };
                return { ok: true };
            },
            query: name => (name === 'npc.meters' ? [] : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    }, async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const harek = { name: 'Harek', present: true, role: 'caravan guard', identityKind: 'proper_name', dossierSignal: 'meaningful', dossierReason: 'named guard', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 }, relationshipEvidence: { trust: '', affection: '', desire: '', tension: '' }, mood: 'Cynical and indifferent' };
        mockState.quietResponder = async () => JSON.stringify({ npcs: [harek] });
        await turn('Harek leans on the wagon, a weathered caravan guard.');
        await sleep(300);
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ ...harek, mood: 'Bored and watchful', moodV: 1, moodA: -2, moodD: '2' }] });
        await turn('Harek shrugs and spits into the dust beside the wagon.');
        await sleep(1500);   // the held retry (1 s) has gone out by now
        console.log('RESULT ' + JSON.stringify({ total: mockState.sdk.sent.filter(item => item.type === 'npc.meet' && item.payload.name === 'Harek').length, moods: mockState.sdk.sent.filter(item => item.type === 'npc.mood').map(item => item.payload), names: api.getState().npcs.map(npc => npc.name) }));
    });
    const result = scenarioOutput(output);
    assert.equal(result.total, 2, 'the meeting the host did not keep was held and sent again once it settled, and once kept never again');
    // each mood word the scan wrote for Harek goes to the slice as npc.mood (its numbers are read there from the fixed word list), once per change
    assert.deepEqual(result.moods.map(item => [item.name, item.word]), [['Harek', 'Cynical and indifferent'], ['Harek', 'Bored and watchful']]);
    // the three numbers the scan gave with a word travel with it (whole, -3..3); a scan that gave none sends none (the word list reads it)
    assert.deepEqual(result.moods.map(item => item.vad), [undefined, { v: 1, a: -2, d: 2 }]);
});

// (live run 4) 30 npc.mood and 20 npc.meet were refused "A native change is finishing" and dropped. A scan's command refused that way is kept in order (the
// ones after it wait behind it, the host is not asked again out of order), sent again once the change settles, never twice, and never for a reply taken back.
function heldScenario(name, takeBack) {
    process.env.NSD_TAKE_BACK = takeBack ? '1' : '';   // the scenario runs in a child process that inherits it
    return scenarioOutput(runHostScenario(name, async () => {
        const sdk = {
            registered: [], sent: [], kept: [], refusals: 0,
            registerModule(def) { sdk.registered.push(def); },
            command: async (type, payload) => {
                sdk.sent.push({ type, payload });
                if (['npc.meet', 'npc.mood'].includes(type) && (sdk.refusals += 1) <= 1) return { ok: false, code: 'RESTORE_PENDING', message: 'NPC State Delta is waiting: A native change is finishing; every part must agree before the story goes on.' };
                sdk.kept.push(type + ':' + payload.name);
                return { ok: true };
            },
            query: queryName => (queryName === 'npc.meters' ? [] : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    }, async () => {
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const brant = { name: 'Brant', present: true, role: 'quartermaster', identityKind: 'proper_name', dossierSignal: 'meaningful', dossierReason: 'named officer', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 }, relationshipEvidence: { trust: '', affection: '', desire: '', tension: '' }, mood: 'Curt and tired' };
        mockState.quietResponder = async () => JSON.stringify({ npcs: [brant] });
        const id = await turn('Brant counts crates by the gate, curt and tired.');
        await sleep(200);
        const heldAfterScan = mockState.sdk.kept.length;
        if (process.env.NSD_TAKE_BACK === '1') {
            const message = mockState.context.chat[id];
            message.swipes.push('Another reply entirely.');
            message.swipe_id = 1;
            message.mes = 'Another reply entirely.';
        }
        await sleep(1600);
        console.log('RESULT ' + JSON.stringify({ heldAfterScan, kept: mockState.sdk.kept, sent: mockState.sdk.sent.map(item => item.type) }));
    }));
}
test('hosted: a meeting and a mood refused while a native change finishes are held in order and sent once it settles', () => {
    const result = heldScenario('meters-held-order', false);
    assert.equal(result.heldAfterScan, 0, 'nothing was kept while the host was refusing');
    assert.deepEqual(result.kept, ['npc.meet:Brant', 'npc.mood:Brant'], 'the meeting first, then the mood, each once');
    assert.equal(result.sent.filter(type => type === 'npc.meet').length, 2, 'asked, refused, asked again: the meeting reached the host twice and was applied once');
    assert.equal(result.sent.filter(type => type === 'npc.mood').length, 1, 'the mood waited behind the meeting and was asked once');
});
test('hosted: a held command is not applied when its reply was taken back (swiped) before the change settled', () => {
    const result = heldScenario('meters-held-takenback', true);
    assert.deepEqual(result.kept, [], 'neither the meeting nor the mood reached the slice for the reply that was taken back');
    assert.equal(result.sent.filter(type => type === 'npc.meet').length, 1, 'only the refused first try');
});

// (live run 4) A scan cancelled because the saved state advanced under it (not by the reader, not by a chat change) is asked for again, once per reply.
test('a scan cancelled by "server revision advanced" is queued again once; a reader\'s cancel or a chat change is not', () => {
    const scan = fs.readFileSync(new URL('../../modules/people/calls/runtime-scan.js', import.meta.url), 'utf8');
    const ops = fs.readFileSync(new URL('../../modules/people/calls/runtime-scan-ops.js', import.meta.url), 'utf8');
    const index = fs.readFileSync(new URL('../../modules/people/legacy/index.js', import.meta.url), 'utf8');
    assert.match(index, /cancelScanOperation\(key, dirtyConflict \? 'cross-session conflict' : 'server revision advanced'\)/, 'the reason the scan is cancelled with');
    assert.match(ops, /operation\.cancelReason|scanOperations\.cancel\(key, reason\)/, 'the registry keeps the reason');
    const line = scan.split('\n').find(text => text.includes("queuePendingAutoScan(scanChatKey, messageId, 'stale-auto-scan')"));
    assert.ok(line, 'the stale scan is queued again');
    assert.match(line, /!operation\?\.cancelled \|\| \(operation\.cancelReason === 'server revision advanced' && !rerunOnce\.has\(/, 'only that cancel reason, and only once per chat and reply');
    assert.doesNotMatch(line, /user cancelled|chat changed|cross-session/, 'no other cancel is re-run');
});

test('without a v2 host the same turns send nothing, and the sidecar and the injection are the same as hosted', () => {
    const run = (name, prelude) => scenarioOutput(runHostScenario(name, prelude, async () => {
        const api = globalThis.NPCStateDelta;
        // Memory facts are standalone-only (hosted, the slice applies the move and derives none), so this parity compares the runs without them.
        mockState.extensionSettings.npc_state_delta.memoryFacts = false;
        await sleep(200);
        const { relationship } = await turns();
        const yunyun = api.getState().npcs.find(npc => npc.name === 'Yunyun');
        assert.equal(api.getDossierState().npcs.find(npc => npc.name === 'Yunyun').relationship.trust, yunyun.relationship.trust, 'the dossier view shows the sidecar numbers');
        console.log('RESULT ' + JSON.stringify({
            relationship,
            sent: mockState.sdk?.sent?.length ?? 0,
            hosted: globalThis.__handles.hosted ? '1' : null,
            injection: api.injectionPreview().text,
            presentQuery: mockState.sdk?.registered?.[0]?.queries?.['npc.present']?.({}) ?? null,
            castHtml: api.presentCastHtml(),
            lastChange: { ...yunyun.lastRelationshipChange, at: undefined },
            milestones: yunyun.relationshipMilestones,
        }));
    }));
    const alone = run('meters-alone', async () => {});
    // A host whose slice has no entries yet: Delta forwards the change, everything it shows is its own.
    // Its scene (`scene.present`, which owns presence while hosted) agrees that Yunyun is here.
    const hosted = run('meters-empty-slice', async () => {
        const sdk = { registered: [], sent: [], registerModule(def) { sdk.registered.push(def); }, command: async (type, payload) => { sdk.sent.push({ type, payload }); return { ok: true }; }, query: name => (name === 'scene.present' ? ['Yunyun'] : []), settings: () => ({}) };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    });
    // A host whose scene does not list her: the injection follows Story Block's scene, not Delta's own presence.
    const elsewhere = run('meters-scene-elsewhere', async () => {
        const sdk = { registered: [], sent: [], registerModule(def) { sdk.registered.push(def); }, command: async (type, payload) => { sdk.sent.push({ type, payload }); return { ok: true }; }, query: () => [], settings: () => ({}) };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    });
    assert.match(alone.injection, /Only confirmed-present NPCs[\s\S]*- Yunyun/);
    assert.doesNotMatch(elsewhere.injection, /Only confirmed-present NPCs/, 'nobody is presented as in the scene');
    assert.match(elsewhere.injection, /- Yunyun \(mentioned, not present/);
    assert.deepEqual(hosted.presentQuery, ['Yunyun'], 'npc.present follows the scene');
    assert.deepEqual(elsewhere.presentQuery, [], 'npc.present follows the scene when it leaves her out');
    assert.match(hosted.castHtml, /Yunyun/);
    assert.doesNotMatch(elsewhere.castHtml, /npc-state-delta-present-card[^"]*"[^>]*data-npc-id/, 'the Cast tab shows nobody as present');
    assert.equal(alone.hosted, null);
    assert.equal(alone.sent, 0, 'nothing is sent without a host');
    assert.equal(hosted.hosted, '1');
    assert.equal(hosted.sent, 2, 'the forwarded change (npc.adjust) and the meeting of the person this scan admitted (npc.meet)');
    assert.ok(alone.relationship.trust > 0);
    assert.deepEqual(alone.relationship, hosted.relationship, 'the sidecar numbers follow v1 rules either way');
    assert.deepEqual(alone.lastChange, hosted.lastChange);
    assert.deepEqual(alone.milestones, hosted.milestones);
    assert.equal(alone.injection, hosted.injection, 'the injection is the same text');
});

test('index.js: the v2 meter hooks are the identity without a host', () => {
    const index = runtimeSource();
    // Every hook asks storySuiteV2Meters() first, which is null unless the page flag is set and the adapter is hosted.
    assert.match(index, /function storySuiteV2Meters\(\) \{\n        const adapter = storyBlockV2Hosted\(\) && rt\.storySuiteV2\?\.hosted\?\.\(\) \? rt\.storySuiteV2 : null;\n        const scope = replayScope\(\);\n        return adapter && scope \? scopedAdapter\(adapter, scope\.at, scope\.sink\) : adapter;/);
    assert.match(index, /function hostedMeterView\(npcs\) \{\n        const adapter = storySuiteV2Meters\(\);\n        if \(!adapter\) return npcs;/);
    assert.match(index, /function forwardRelationshipChangesToHost\(before, after, messageId, head = null, updates = \[\], rows = \[\], onePass = false\) \{\n        if \(replayScope\(\)\) return;[^\n]*\n        const adapter = storySuiteV2Meters\(\);\n        if \(!adapter\) return;/);
    assert.match(index, /function hostedSecretsEditorHtml\(npc\) \{\n        const adapter = storySuiteV2Meters\(\);\n        if \(!adapter\) return '';/);
    assert.match(index, /const v2Edits = hostedMeters \? hostedMeters\.readEditor\(id => document\.getElementById\(id\)\?\.value, current\) : null;/);
    assert.match(index, /const meterViews = storySuiteV2Meters\(\)\?\.dossierMeters\?\.\(state\.npcs\) \?\? \{\};/);
    assert.match(index, /if \(shownRelationship\) \{/);
    assert.equal((index.match(/forwardRelationshipChangesToHost\(/g) || []).length, 3, 'two hooks: the live scan\'s commit and the targeted pass\'s commit');
});
