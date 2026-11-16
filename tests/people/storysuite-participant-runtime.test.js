// The timeline participant inside the real runtime: the synthetic host (runtime-smoke.mjs) loads Delta beside a fake
// Story Block v2 global; the module definition Delta registers carries the participant and `npc.identity`, and the runtime's
// `installState` puts a native state back absolutely and durably.
import test from 'node:test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';


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
    console.log('story suite v2 scenario ${name} passed');
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

test('N-B1: from a reply arriving until its scan is written, and across a queued scan, Delta is never idle: no save point can land in the gap', () => {
    runHostScenario('intent', async () => {
        const sdk = { registered: [], registerModule(def) { sdk.registered.push(def); } };
        mockState.sdk = sdk;
        globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    }, async () => {
        const api = globalThis.NPCStateDelta;
        assert.equal(await waitFor(() => mockState.sdk.registered.length === 1), true);
        const settings = mockState.extensionSettings.npc_state_delta;
        Object.assign(settings, { enabled: true, autoScan: true, scanEvery: 1, fullScanEveryTurn: false });
        await manualAddNpc('Mira');
        await api.flush();
        const slow = name => async (args = {}) => {
            if (args.jsonSchema) return '{"npcs":[]}';
            await sleep(120);
            return JSON.stringify({ npcs: [{ name, present: true, role: 'wanderer', species: 'Human', age: '30', appearance: `${name} wears a grey cloak.`, personality: 'quiet', speech: 'brief', relationshipImpact: 'ordinary' }] });
        };
        const reply = text => mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0 });
        const names = () => api.getState().npcs.map(npc => npc.name);
        // Sample the whole time: whenever Delta says it is idle, nothing may still be on its way.
        const samples = [];
        let stop = false;
        const sampler = (async () => { while (!stop) { samples.push({ idle: !api.scanActive(), names: names() }); await sleep(2); } })();
        mockState.quietResponder = slow('Vale');
        reply('Vale, a wanderer in a grey cloak, nods to the party at the gate and says nothing more for a while.');
        const first = mockState.context.chat.length - 1;
        eventSource.emit('message_received', first);
        assert.equal(api.scanActive(), true, 'the reply has arrived: its scan is due');
        // A second reply arrives while the first scan runs: it is queued, and starts only when the first ends.
        await sleep(40);
        mockState.quietResponder = slow('Orrin');
        reply('Orrin, a courier with a satchel of letters, hurries in from the road and asks after the party by name.');
        eventSource.emit('message_received', mockState.context.chat.length - 1);
        assert.equal(await waitFor(() => names().includes('Orrin'), 8000), true, 'the queued scan ran');
        await sleep(30);
        stop = true;
        await sampler;
        const wrong = samples.filter(sample => sample.idle && !(sample.names.includes('Vale') && sample.names.includes('Orrin')) && sample.names.includes('Mira'));
        // Idle is allowed only before anything was due (the first sample) and after both are written.
        assert.ok(wrong.length <= 1, `Delta was idle with a scan still to land: ${JSON.stringify(wrong.slice(0, 3))}`);
        assert.equal(await api.scanIdle(2000), true);
        assert.equal(api.scanActive(), false);
    });
});
