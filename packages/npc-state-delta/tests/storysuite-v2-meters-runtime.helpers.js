import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// NPC meters (F81, F90) with Delta's real runtime: the established synthetic host (runtime-smoke.mjs)
// loads Delta, alone or beside a fake Story Block v2 global, and runs the same turns. Hosted, a
// scan's relationship change is sent to the host as npc.adjust and the injection reads the slice's
// numbers; without a host nothing is sent and the sidecar and the injection are the same as hosted
// (the slice never writes back into Delta's own data).

export const TRY_MARKER = '\ntry {\n    await import(pathToFileURL(path.join(extRoot, \'index.js\'))';

export function runHostScenario(name, prelude, scenario) {
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
const turns = ${turns.toString()};
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
    console.log('story suite v2 meters scenario ${name} passed');
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

// The same two turns in every scenario: Yunyun arrives, then trusts Kazuma with a secret.
export const turns = async () => {
    const api = globalThis.NPCStateDelta;
    const arrive = { name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } };
    mockState.quietResponder = async () => JSON.stringify({ npcs: [arrive] });
    await turn('Yunyun waves from the gate.');
    await sleep(200);
    const confide = {
        ...arrive, relationshipImpact: 'meaningful', relationshipDelta: { trust: 2, affection: 0, desire: 0, tension: 0 },
        relationshipEvidence: { trust: 'Yunyun confided a private secret and trusted Kazuma with it.', affection: '', desire: '', tension: '' },
        relationshipChangeReason: 'Yunyun confided a private secret to Kazuma.',
    };
    mockState.quietResponder = async args => {
        const id = api.getState().npcs.find(npc => npc.name === 'Yunyun')?.id;
        return JSON.stringify({ npcs: [{ ...confide, ...(id ? { id } : {}) }] });
    };
    const id = await turn('Yunyun confided a private secret and trusted Kazuma with it, whispering by the gate.');
    await sleep(300);
    const yunyun = api.getState().npcs.find(npc => npc.name === 'Yunyun');
    return { id, relationship: yunyun?.relationship ?? null };
};

export function scenarioOutput(output) {
    const line = String(output).split('\n').find(text => text.startsWith('RESULT '));
    assert.ok(line, 'the scenario printed its result');
    return JSON.parse(line.slice(7));
}
