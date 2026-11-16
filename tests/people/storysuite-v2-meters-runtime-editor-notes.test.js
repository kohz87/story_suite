import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeSource } from './helpers/runtime-source.js';
import { runHostScenario, scenarioOutput } from './storysuite-v2-meters-runtime.helpers.js';

// The dossier editor: while hosted it shows the slice's numbers and a Hidden notes field, and saves
// edited numbers to the slice (npc.set) and the notes to the dossier; alone it is v1's editor.
const editorScenario = async () => {
    const api = globalThis.NPCStateDelta;
    await sleep(200);
    await manualAddNpc('Yunyun');
    await sleep(100);
    const yunyun = api.getState().npcs.find(npc => npc.name === 'Yunyun');
    await api.openEditor(yunyun.id);
    await sleep(30);
    const popup = mockState.popupCalls.at(-1);
    const html = String(popup.content?.innerHTML ?? popup.content ?? '');
    const values = new Map();
    for (const match of html.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"([^>]*)>/g)) values.set(match[1], { value: (match[2].match(/value="([^"]*)"/) || [])[1] ?? '', checked: /\bchecked\b/.test(match[2]) });
    for (const match of html.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"[^>]*>([^<]*)<\/textarea>/g)) values.set(match[1], { value: match[2], checked: false });
    const shownTrust = values.get('npc_state_delta_edit_trust')?.value;
    const hasNotes = values.has('npc_state_delta_edit_secrets');
    values.set('npc_state_delta_edit_trust', { value: '45', checked: false });
    if (hasNotes) values.set('npc_state_delta_edit_secrets', { value: 'trust 40: She hides a map of the old mine.\nnonsense line', checked: false });
    const realGet = document.getElementById;
    document.getElementById = id => values.get(id) || null;
    await popup.complete(1);
    await sleep(150);
    document.getElementById = realGet;
    const saved = api.getState().npcs.find(npc => npc.name === 'Yunyun');
    console.log('RESULT ' + JSON.stringify({
        shownTrust, hasNotes, savedTrust: saved.relationship.trust, secrets: saved.secrets ?? null,
        sent: (mockState.sdk?.sent ?? []).map(({ type, payload }) => ({ type, payload })),
        injectionHasNote: api.injectionPreview().text.includes('old mine'),
    }));
};

test('the dossier editor: hosted, it edits the slice and the hidden notes; alone, it is unchanged', () => {
    const hosted = scenarioOutput(runHostScenario('meters-editor-hosted', async () => {
        const sdk = {
            registered: [], sent: [],
            entries: [{ key: 'npc_yunyun', name: 'Yunyun', meters: { trust: 30, affection: 0, desire: 0, tension: 0 }, stages: {}, unlocked: [] }],
            registerModule(def) { sdk.registered.push(def); },
            command: async (type, payload) => { sdk.sent.push({ type, payload }); return { ok: true, receipt: { summary: '' } }; },
            query: name => (name === 'npc.meters' ? structuredClone(sdk.entries) : null),
            settings: () => ({}),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    }, `async () => { const editorScenario = ${editorScenario.toString()}; await editorScenario(); }`));
    assert.equal(hosted.shownTrust, '30', 'the slice\'s number is shown');
    assert.equal(hosted.hasNotes, true);
    assert.equal(hosted.savedTrust, 0, 'Delta\'s own number is left as it was');
    assert.equal(hosted.secrets.length, 1, 'the unreadable line is not kept');
    assert.deepEqual({ meter: hosted.secrets[0].meter, at: hosted.secrets[0].at, text: hosted.secrets[0].text }, { meter: 'trust', at: 40, text: 'She hides a map of the old mine.' });
    assert.match(hosted.secrets[0].id, /^sec_[0-9a-z]{8}$/);
    assert.deepEqual(hosted.sent.map(item => item.type), ['npc.set', 'npc.refresh']);
    assert.equal(hosted.sent[0].payload.name, 'Yunyun');
    assert.deepEqual(hosted.sent[0].payload.meters, { trust: 45 });
    assert.equal(hosted.injectionHasNote, false, 'a locked note is never in Delta\'s injection');

    const alone = scenarioOutput(runHostScenario('meters-editor-alone', async () => {}, `async () => { const editorScenario = ${editorScenario.toString()}; await editorScenario(); }`));
    assert.equal(alone.shownTrust, '0');
    assert.equal(alone.hasNotes, false, 'no Hidden notes field without a host');
    assert.equal(alone.savedTrust, 45, 'v1: the editor sets Delta\'s own number');
    assert.equal(alone.secrets, null);
    assert.deepEqual(alone.sent, []);
});

// (TRS 1-4) The editor's v2 controls while hosted: the meter limits go to the dossier (meterSetup),
// the milestones and a custom meter's value to the slice (npc.milestone, npc.set), then a refresh.
const editorLadderScenario = async () => {
    const api = globalThis.NPCStateDelta;
    await sleep(200);
    await manualAddNpc('Yunyun');
    await sleep(100);
    const yunyun = api.getState().npcs.find(npc => npc.name === 'Yunyun');
    await api.openEditor(yunyun.id);
    await sleep(30);
    const popup = mockState.popupCalls.at(-1);
    const html = String(popup.content?.innerHTML ?? popup.content ?? '');
    const values = new Map();
    for (const match of html.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"([^>]*)>/g)) values.set(match[1], { value: (match[2].match(/value="([^"]*)"/) || [])[1] ?? '', checked: /\bchecked\b/.test(match[2]) });
    for (const match of html.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"[^>]*>([^<]*)<\/textarea>/g)) values.set(match[1], { value: match[2], checked: false });
    const shown = Object.fromEntries([...values].filter(([id]) => /meter|milestone|secrets/.test(id)).map(([id, item]) => [id, item.value]));
    values.set('npc_state_delta_edit_meter_limits', { value: 'affection: ceiling 40\nnot a limit', checked: false });
    values.set('npc_state_delta_edit_milestones', { value: 'saved her brother\nkept the oath', checked: false });
    values.set('npc_state_delta_edit_meter_loyalty', { value: '33', checked: false });
    const realGet = document.getElementById;
    document.getElementById = id => values.get(id) || null;
    await popup.complete(1);
    await sleep(150);
    document.getElementById = realGet;
    const saved = api.getState().npcs.find(npc => npc.name === 'Yunyun');
    const dossierState = api.getDossierState();
    console.log('RESULT ' + JSON.stringify({
        shown, meterSetup: saved.meterSetup ?? null, sent: (mockState.sdk?.sent ?? []).map(({ type, payload }) => ({ type, payload })),
        hasMeterViews: Object.hasOwn(dossierState, 'meterViews'),
    }));
};

test('the dossier editor (hosted): limits to the dossier, milestones and custom meters to the slice; alone, none of it', () => {
    const prelude = async () => {
        const sdk = {
            registered: [], sent: [],
            entries: [{ key: 'npc_yunyun', name: 'Yunyun', meters: { trust: 30, affection: 0, desire: 0, tension: 0, loyalty: 20 }, stages: {}, unlocked: [], milestones: { 'saved-her-brother': 'saved her brother', 'old-debt': 'old debt' } }],
            registerModule(def) { sdk.registered.push(def); },
            command: async (type, payload) => { sdk.sent.push({ type, payload }); return { ok: true, receipt: { summary: '' } }; },
            query: name => (name === 'npc.meters' ? structuredClone(sdk.entries) : null),
            settings: () => ({ presets: ['companion'] }),
        };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    };
    const hosted = scenarioOutput(runHostScenario('meters-editor-ladder', prelude, `async () => { const editorLadderScenario = ${editorLadderScenario.toString()}; await editorLadderScenario(); }`));
    assert.equal(hosted.shown.npc_state_delta_edit_milestones, 'saved her brother\nold debt', 'the slice\'s milestones are shown');
    assert.equal(hosted.shown.npc_state_delta_edit_meter_loyalty, '20', 'the preset\'s meter, from the slice');
    assert.equal(hosted.shown.npc_state_delta_edit_meter_limits, '');
    assert.deepEqual(hosted.meterSetup, { track: '', limits: { affection: { ceiling: 40 } } }, 'the readable limit is kept on the dossier');
    assert.deepEqual(hosted.sent.map(item => item.type), ['npc.set', 'npc.milestone', 'npc.refresh']);
    assert.deepEqual(hosted.sent[0].payload, { name: 'Yunyun', meters: { loyalty: 33 } });
    assert.deepEqual(hosted.sent[1].payload, { name: 'Yunyun', add: ['kept the oath'], remove: ['old-debt'] });
    assert.equal(hosted.hasMeterViews, true);

    const alone = scenarioOutput(runHostScenario('meters-editor-ladder-alone', async () => {}, `async () => { const editorLadderScenario = ${editorLadderScenario.toString()}; await editorLadderScenario(); }`));
    assert.deepEqual(alone.shown, {}, 'no v2 controls without a host');
    assert.equal(alone.meterSetup, null);
    assert.deepEqual(alone.sent, []);
});


// ---- hidden notes for everyone (secrets): the scan writes the layers, and watches the story events ----

const NOTES_PRELUDE = async () => {
    const sdk = {
        registered: [], sent: [], entries: [],
        registerModule(def) { sdk.registered.push(def); },
        command: async (type, payload, options) => { sdk.sent.push({ type, payload, options: options ?? null }); return { ok: true, receipt: { summary: '' } }; },
        query: name => (name === 'npc.meters' ? structuredClone(sdk.entries) : null),
        settings: () => ({}),
    };
    mockState.sdk = sdk;
    globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
};

test('hosted: the scan that builds a dossier also writes 2 to 5 layered notes, once; a later scan never rewrites them; off writes none', () => {
    const output = runHostScenario('secrets-generated', NOTES_PRELUDE, async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const row = (name, extra = {}) => ({ name, present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 }, ...extra });
        const layer = (i, extra = {}) => ({ title: `Layer ${i}`, text: `Secret number ${i} about Yunyun.`, meter: 'trust', at: 10 * i, ...extra });
        const prompts = [];
        mockState.quietResponder = async options => {
            { const text = String(options?.prompt ?? ''); if (text.startsWith('Private NPC dossier scanner.')) prompts.push(text); }
            return JSON.stringify({ npcs: [row('Yunyun', { secrets: [1, 2, 3, 4, 5, 6, 7].map(i => layer(i)) })] });
        };
        await turn('Yunyun waves from the gate.');
        await sleep(300);
        const made = api.getState().npcs.find(npc => npc.name === 'Yunyun')?.secrets ?? [];
        // A later scan, an existing person: new notes from the model are ignored.
        const id = api.getState().npcs.find(npc => npc.name === 'Yunyun').id;
        mockState.quietResponder = async options => {
            { const text = String(options?.prompt ?? ''); if (text.startsWith('Private NPC dossier scanner.')) prompts.push(text); }
            return JSON.stringify({ npcs: [{ ...row('Yunyun'), id, secrets: [{ title: 'Rewrite', text: 'A different secret.', meter: 'trust', at: 5 }] }] });
        };
        await turn('Yunyun nods at the gate.');
        await sleep(300);
        const after = api.getState().npcs.find(npc => npc.name === 'Yunyun')?.secrets ?? [];
        // Switched off: a new person gets none.
        mockState.extensionSettings.storySuite.modules['npc-state-delta'].layeredSecrets = false;
        mockState.quietResponder = async options => {
            { const text = String(options?.prompt ?? ''); if (text.startsWith('Private NPC dossier scanner.')) prompts.push(text); }
            return JSON.stringify({ npcs: [row('Aqua', { secrets: [layer(1)] })] });
        };
        await turn('Aqua appears.');
        await sleep(300);
        const megumin = api.getState().npcs.find(npc => npc.name === 'Aqua');
        console.log('RESULT ' + JSON.stringify({
            made: made.map(note => ({ at: note.at, meter: note.meter, id: /^sec_[0-9a-z]{8}$/.test(note.id) })),
            same: JSON.stringify(after) === JSON.stringify(made),
            megumin: megumin ? (megumin.secrets ?? []).length : null,
            asked: prompts.map(text => text.includes('HIDDEN NOTES: for each NEW dossier-worthy NPC only')),
        }));
    });
    const result = scenarioOutput(output);
    assert.deepEqual(result.made.map(note => note.at), [10, 20, 30, 40, 50], 'five at most, light to deep');
    assert.ok(result.made.every(note => note.meter === 'trust' && note.id));
    assert.equal(result.same, true, 'a later scan never rewrites a note');
    assert.equal(result.megumin, 0, 'off: nothing written');
    assert.deepEqual(result.asked, [true, true, false], 'the scan asks for layers only while the setting is on');
});

test('hosted: the scan watches present people\'s event notes, and a story event it sees goes to the host as npc.open', () => {
    const output = runHostScenario('secrets-events', NOTES_PRELUDE, async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        const row = (name, extra = {}) => ({ name, present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 }, ...extra });
        const event = 'The duke is exposed as a traitor';
        mockState.quietResponder = async () => JSON.stringify({ npcs: [row('Yunyun', { secrets: [{ title: 'The duke', text: 'She knew about the duke.', when: event }, { title: 'Light', text: 'She likes tea.', meter: 'trust', at: 20 }] })] });
        await turn('Yunyun waves from the gate.');
        await sleep(300);
        const dossier = api.getState().npcs.find(npc => npc.name === 'Yunyun');
        const noteId = dossier.secrets.find(note => note.when).id;
        const id = dossier.id;
        // The next scan lists the event (present person, locked event note) and the model says it happened.
        const prompts = [];
        mockState.quietResponder = async options => {
            { const text = String(options?.prompt ?? ''); if (text.startsWith('Private NPC dossier scanner.')) prompts.push(text); }
            return JSON.stringify({ npcs: [{ ...row('Yunyun'), id }], secretEvents: ['s1', 's9'], secretEventEvidence: { s1: 'dragged out in chains', s9: 'never said' } });
        };
        const sentBefore = mockState.sdk.sent.length;
        await turn('The duke is dragged out in chains.');
        await sleep(400);
        const opened = mockState.sdk.sent.slice(sentBefore).filter(item => item.type === 'npc.open');
        // Once the host says it is open (its slice), it is not watched or asked again.
        mockState.sdk.entries = [{ key: 'npc_yunyun', name: 'Yunyun', meters: { trust: 0, affection: 0, desire: 0, tension: 0 }, stages: {}, unlocked: [noteId] }];
        await turn('The gate is quiet.');
        await sleep(300);
        console.log('RESULT ' + JSON.stringify({
            noteId,
            watched: /\n17\. STORY EVENTS to look for[^\n]*s1 = Yunyun: The duke is exposed as a traitor\./.test(prompts[0] ?? ''),
            leaksText: prompts.some(text => text.includes('She knew about the duke')),
            opened: opened.map(item => ({ payload: item.payload, options: item.options })),
            watchedAgain: /STORY EVENTS to look for/.test(prompts[1] ?? ''),
        }));
    });
    const result = scenarioOutput(output);
    assert.equal(result.watched, true, 'the scan lists the event with a key');
    assert.equal(result.leaksText, false, 'the note\'s text never goes to the scanner');
    assert.equal(result.opened.length, 1, 'one npc.open, for the key the exchange showed (an unknown key is ignored)');
    assert.deepEqual(result.opened[0].payload, { name: 'Yunyun', open: [result.noteId], by: 'story' });
    assert.deepEqual(result.opened[0].options, { background: true }, 'sent as Delta\'s own action, and as a background change (Story Block\'s late save window)');
    assert.equal(result.watchedAgain, false, 'an opened note is not watched again');
});

test('index.js: after the editor applies its notes to the slice the dossier is drawn again, and the scan carries the hosted notes\' options only while hosted', () => {
    const index = runtimeSource();
    assert.match(index, /await hostedMeters\.applyEditor\(savedName, v2Edits\);\n[^\n]*\n            renderDossier\(\);\n            updateInjection\(\);/);
    assert.match(index, /const hostedNotes = hostedMeters\(\);\n        const noteOptions = hostedNotes && !capture \? hostedNotePromptOptions\(state, settings, messageId\) : \{\};/);
    assert.match(index, /const eventWatch = capture \? \(Array\.isArray\(capture\.watch\) \? capture\.watch : \[\]\) : \(noteOptions\.eventWatch \|\| \[\]\);/);
    assert.match(index, /if \(hostedNotes && settings\.layeredSecrets !== false\) attachGeneratedSecrets\(nextState, newlyAdmittedIds, parsedForMerge, resolvedParsed, parsed\);/);
    assert.match(index, /function attachGeneratedSecrets\(state, ids, \.\.\.sources\) \{\n        const adapter = storySuiteV2Meters\(\);\n        if \(!adapter/);
    assert.match(index, /function forwardSecretEventsToHost\(watched, answered, head = null\) \{\n        if \(replayScope\(\)\) return;\n        const adapter = storySuiteV2Meters\(\);\n        if \(!adapter/);
    assert.match(index, /layeredSecrets: true,/, 'on by default');
});
