import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runtimeSource } from './helpers/runtime-source.js';
import { styleSource } from './helpers/shipped-modules.js';

// Story Suite v2 hosted-mode polish, with the real runtime: the established synthetic host
// (runtime-smoke.mjs) loads Delta beside a fake Story Block v2 global.
//   1. A new chat with no sidecar yet: Delta looks for the file once and, while hosted, automatic
//      boundaries trust that miss instead of asking again (each ask is a 404 in the console). The
//      reader's own actions still look, and the first save creates the file. Without a v2 host the
//      checks are as before.
//   2. The floating npc state launcher hides while hosted unless the reader keeps it, and comes back
//      when the host goes away.
//   3. Under a v2 host the in-chat present cast takes v1's "Only in Story Block" default: shown only
//      when the reader chose to show it.

const TRY_MARKER = '\ntry {\n    await import(pathToFileURL(path.join(extRoot, \'index.js\'))';

function runHostScenario(name, prelude, scenario) {
    let source = fs.readFileSync(new URL('./runtime-smoke.mjs', import.meta.url), 'utf8');
    source = source.replace('const here = path.dirname(fileURLToPath(import.meta.url));', `const here = ${JSON.stringify(fileURLToPath(new URL('.', import.meta.url)))};`);
    const cut = source.indexOf(TRY_MARKER);
    if (cut < 0) throw new Error('Runtime smoke import marker changed');
    const script = `${source.slice(0, cut)}
globalThis.document.documentElement = { dataset: {} };
globalThis.document.readyState = 'loading';
// index.js imports the adapter from src/ at runtime, as the package ships it.
fs.cpSync(path.join(sourceRoot, 'src'), path.join(extRoot, 'src'), { recursive: true });
mockState.storyBlockTabs = [];
// Every request for one of Delta's chat sidecars, and what the server answered.
mockState.sidecarReads = [];
const sidecarFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
    const response = await sidecarFetch(url, options);
    if (typeof url === 'string' && /^\\/user\\/files\\/npc-state-delta-[^/]*\\.json$/.test(url)) mockState.sidecarReads.push({ url, status: response.status });
    return response;
};
const misses = () => mockState.sidecarReads.filter(read => read.status === 404).length;
async function turn(text) {
    mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' });
    const userId = mockState.context.chat.length - 1;
    await Promise.all((mockState.listeners.get('message_sent') || []).map(fn => fn(userId)));
    mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text] });
    const id = mockState.context.chat.length - 1;
    await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
    await Promise.all((mockState.listeners.get('character_message_rendered') || []).map(fn => fn(id)));
    await sleep(150);
    return id;
}
// Chat events that make Delta check its sidecar without writing anything; the reads they made.
async function quietEvents() {
    const before = mockState.sidecarReads.length;
    const uploads = mockState.uploadCalls;
    for (const name of ['chat_loaded', 'chat_changed', 'message_edited', 'message_swiped']) {
        await Promise.all((mockState.listeners.get(name) || []).map(fn => fn(0)));
        await sleep(250);
    }
    assert.equal(mockState.uploadCalls, uploads, 'these events write nothing');
    return mockState.sidecarReads.slice(before);
}
await (${prelude.toString()})();
try {
    await import(pathToFileURL(path.join(extRoot, 'index.js')).href + \`?t=\${Date.now()}\`);
    await sleep(30);
    eventSource.emit('app_ready');
    eventSource.emit('extension_settings_loaded');
    await sleep(30);
    await import(pathToFileURL(path.join(extRoot, 'story-block-tabs.js')).href);
    await sleep(30);
    await (${scenario.toString()})();
    console.log('story suite v2 hosted scenario ${name} passed');
} finally {
    for (const handle of pendingHostTimers) nativeClearTimeout(handle);
    pendingHostTimers.clear();
    delete globalThis.__npcMock;
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
`;
    try {
        return execFileSync(process.execPath, ['--import', new URL('./active-runtime-test-setup.mjs', import.meta.url).href, '--input-type=module'], {
            input: script, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
        });
    } catch (error) {
        const stderr = String(error.stderr || '');
        const detail = stderr.split('\n').filter(line => /Error|assert|expected|actual/i.test(line)).slice(0, 30).join('\n');
        throw new Error(`scenario ${name} failed:\n${detail || stderr.slice(-4000)}`);
    }
}

const v2HostPrelude = async () => {
    const sdk = { registered: [], registerModule(def) { sdk.registered.push(def); } };
    mockState.sdk = sdk;
    globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
};
const noHostPrelude = async () => {};

test('hosted: a new chat with no sidecar is looked for once; automatic checks trust the miss, the reader\'s own look still asks', () => {
    runHostScenario('sidecar-miss-hosted', v2HostPrelude, async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1), 'Delta registers with the v2 host');
        assert.equal(globalThis.__handles.hosted, true);
        await sleep(200);
        assert.ok(misses() >= 1, 'the new chat was looked for');
        assert.equal(api.dataFile(), null, 'no sidecar yet');

        assert.deepEqual(await quietEvents(), [], 'while hosted, chat events do not ask for the missing file again');
        assert.deepEqual(await quietEvents(), [], 'not on the second round either');
        assert.equal(api.getState().npcs.length, 0, 'no sidecar yet reads as an empty dossier');

        // An explicit look (the public freshness check) still asks the server.
        let before = mockState.sidecarReads.length;
        assert.equal(await api.ensureFresh(), true);
        assert.deepEqual(mockState.sidecarReads.slice(before).map(read => read.status), [404]);

        // P2: while hosted the store holds the state. A reader's action and a flush write no sidecar file and keep no pointer (`dataFiles`).
        const { makeNpcStateDataFileName } = await import(pathToFileURL(path.join(extRoot, 'storage.js')).href);
        const filePath = `/user/files/${makeNpcStateDataFileName(api.uiStatus().chatKey)}`;
        await manualAddNpc('Local Visitor');
        await api.flush();
        assert.equal(mockState.files.has(filePath), false, 'no sidecar file was written');
        assert.equal(api.dataFile(), null, 'no dataFiles pointer');
        assert.deepEqual(api.getState().npcs.map(npc => npc.name), ['Local Visitor'], 'the state is still Delta\'s own memory');
    });
});

test('hosted: the first save writes no sidecar (no file, no dataFiles key); the store holds the state', () => {
    runHostScenario('sidecar-first-save-hosted', v2HostPrelude, async () => {
        const api = globalThis.NPCStateDelta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        await sleep(200);
        mockState.sidecarReads.length = 0;
        const before = misses();
        await turn('The wind blows over the empty road.');
        await api.flush();
        assert.equal(api.dataFile(), null, 'no sidecar pointer');
        assert.equal([...mockState.files.keys()].some(name => /npc[-_]state/i.test(name)), false, 'no state file was uploaded');
        await turn('Still nobody on the road.');
        assert.equal(misses(), before, 'no further check for a file that is never written');
    });
});

test('hosted, then the host goes away: chat events check for the sidecar as before', () => {
    runHostScenario('sidecar-host-leaves', v2HostPrelude, async () => {
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        await sleep(200);
        assert.deepEqual(await quietEvents(), []);
        globalThis.StoryBlock = undefined;
        const v2 = await import(pathToFileURL(path.join(extRoot, 'src', 'storysuite-v2.js')).href);
        const adapter = v2.startStorySuiteV2();
        assert.equal(adapter.check(), false);
        assert.equal(globalThis.__handles.hosted, false, 'the hosted state is gone');
        const reads = await quietEvents();
        assert.ok(reads.length >= 1 && reads.every(read => read.status === 404), 'unhosted, the missing sidecar is asked for again, as v1 does');
        adapter.stop();
    });
});

test('without a v2 host the sidecar checks are unchanged', () => {
    runHostScenario('sidecar-alone', noHostPrelude, async () => {
        await sleep(300);
        assert.equal(globalThis.__handles.hosted, false);
        const first = await quietEvents();
        assert.ok(first.length >= 4 && first.every(read => read.status === 404), `chat events ask for the missing sidecar (${first.length})`);
        const second = await quietEvents();
        assert.equal(second.length, first.length, 'every time, as before');
    });
});

test('hosted: the in-chat cast shows only when the reader chose it; it comes back when the host leaves', () => {
    runHostScenario('launcher-and-cast-hosted', v2HostPrelude, async () => {
        const api = globalThis.NPCStateDelta;
        const settings = mockState.extensionSettings.npc_state_delta;
        assert.ok(await waitFor(() => mockState.sdk.registered.length === 1));
        await sleep(100);

        assert.equal(globalThis.__handles.hosted, true);
        assert.equal('launcherWithStoryBlockV2' in settings || 'launcherWithStoryBlock' in settings, false, 'the launcher settings are gone');
        assert.equal(uiHandlers.get('change.npcStateDelta|#npc_state_delta_launcher_with_story_block_v2'), undefined, 'and so is their control');

        // The in-chat cast: the Cast tab carries it, so the unchosen default stays out of the chat.
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        const id = await turn('Yunyun waves from the gate.');
        await sleep(200);
        assert.ok(api.getState().npcs.some(npc => npc.name === 'Yunyun' && npc.present), 'Yunyun is present');
        assert.match(api.presentCastHtml(), /Yunyun/, 'the Cast tab has her');
        const inChat = () => inlineAnchors.some(anchor => anchor.dataset.npcStateDeltaMessageId === String(id));
        assert.equal(settings.presentCastDisplayChosen, false);
        api.renderInline();
        assert.equal(inChat(), false, 'the unchosen default is not shown twice');
        assert.equal(api.uiStatus().presentCastDisplay, 'full', 'the stored choice is unchanged');

        settings.presentCastDisplay = 'full';
        settings.presentCastDisplayChosen = true;
        api.renderInline();
        assert.equal(inChat(), true, 'Full cards chosen: shown in the chat too');
        settings.presentCastDisplay = 'storyblock';
        api.renderInline();
        assert.equal(inChat(), false, 'Only in Story Block: the Cast tab only');
        settings.presentCastDisplay = 'compact';
        api.renderInline();
        assert.equal(inChat(), true, 'Compact is always a deliberate choice');

        // The host goes away: the unchosen default brings the cards back to the chat.
        settings.presentCastDisplay = 'full';
        settings.presentCastDisplayChosen = false;
        api.renderInline();
        assert.equal(inChat(), false);
        globalThis.StoryBlock = undefined;
        const v2 = await import(pathToFileURL(path.join(extRoot, 'src', 'storysuite-v2.js')).href);
        const adapter = v2.startStorySuiteV2();
        assert.equal(adapter.check(), false);
        assert.equal(globalThis.__handles.hosted, false, 'no longer hosted');
        assert.ok(await waitFor(inChat), 'the in-chat cast comes back on its own');
        adapter.stop();
    });
});

test('without a v2 host the in-chat cast is as before', () => {
    runHostScenario('launcher-and-cast-alone', noHostPrelude, async () => {
        const api = globalThis.NPCStateDelta;
        await sleep(200);
        assert.equal(globalThis.__handles.hosted, false);
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        const id = await turn('Yunyun waves from the gate.');
        await sleep(200);
        api.renderInline();
        assert.ok(inlineAnchors.some(anchor => anchor.dataset.npcStateDeltaMessageId === String(id)), 'the default full cards stay in the chat');
    });
});

test('the floating launcher is always hidden; its settings, the keep flags and the hosted-only rows are gone', () => {
    const launcher = fs.readFileSync(new URL('../../modules/people/legacy/launcher-ui.js', import.meta.url), 'utf8');
    assert.match(launcher, /html #\$\{LAUNCHER_ID\} \{ display: none !important; \}/);
    assert.doesNotMatch(launcher, /data-npc-state-delta-story-block|data-npc-state-delta-launcher/);
    const index = runtimeSource();
    assert.doesNotMatch(index, /launcherWithStoryBlock|npc_state_delta_launcher_with_story_block|applyLauncherFlag|npcStateDeltaLauncher/);
    assert.doesNotMatch(index, /npc-state-delta-v2-hosted-only|npc-state-delta-v2-hosted-hide/);
    assert.match(index, /settingRow\('npc_state_delta_layered_secrets', 'Hidden notes for new people'/, 'the layered-secrets row stays, unwrapped');
    assert.doesNotMatch(styleSource(), /npc-state-delta-v2-hosted|data-npc-state-delta-story-block/);
});
