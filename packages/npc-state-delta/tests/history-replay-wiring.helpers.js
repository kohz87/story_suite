import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// History replay through the production handler and scanner of the synthetic SillyTavern host (HR3): the controller of
// src/storysuite-participant/history-replay.js over the runtime's replay boundaries, with a deterministic fake model.
// Each scenario runs in its own process on a fresh host built from the runtime-smoke setup.
// Live Story Block has `restored` and `asOf`; `restored` is driven on the participant directly and the
// as-of reads are proven on the adapter's `at` and the scoped adapter, not against a host.

const TRY_MARKER = '\ntry {\n    await import(pathToFileURL(path.join(extRoot, \'index.js\'))';
const REPLAY_URL = new URL('../src/storysuite-participant/history-replay.js', import.meta.url).href;

// A fake Story Block v2 global beside Delta: its Story Suite adapter is loaded and hosted (the same setup as storysuite-v2-hosted.test.js).
const HOSTED_SETUP = `globalThis.document.documentElement = { dataset: {} };
globalThis.document.readyState = 'loading';
fs.cpSync(path.join(sourceRoot, 'src'), path.join(extRoot, 'src'), { recursive: true });
mockState.storyBlockTabs = [];
{ const sdk = { registered: [], registerModule(def) { sdk.registered.push(def); } }; mockState.sdk = sdk; globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk }; }`;

export function runScenario(name, scenario, { hosted = false } = {}) {
    let source = fs.readFileSync(new URL('./runtime-smoke.mjs', import.meta.url), 'utf8');
    source = source.replace('const here = path.dirname(fileURLToPath(import.meta.url));', `const here = ${JSON.stringify(fileURLToPath(new URL('.', import.meta.url)))};`);
    const cut = source.indexOf(TRY_MARKER);
    if (cut < 0) throw new Error('Runtime smoke import marker changed');
    const script = `${source.slice(0, cut)}
mockState.context.eventTypes.GENERATION_AFTER_COMMANDS = 'generation_after_commands';
mockState.context.eventTypes.GENERATION_STOPPED = 'generation_stopped';
mockState.context.eventTypes.CHAT_COMPLETION_PROMPT_READY = 'chat_completion_prompt_ready';
${hosted ? HOSTED_SETUP : ''}
try {
    await import(pathToFileURL(path.join(extRoot, 'index.js')).href + \`?t=\${Date.now()}\`);
    await sleep(30);
    eventSource.emit('app_ready');
    eventSource.emit('extension_settings_loaded');
    await sleep(30);
    ${hosted ? "await import(pathToFileURL(path.join(extRoot, 'story-block-tabs.js')).href); await sleep(30);" : ''}
    const helpers = await (${helpers.toString()})(mockState, eventSource, sleep, ${JSON.stringify(REPLAY_URL)});
    await (${scenario.toString()})(helpers);
    console.log('history replay scenario ${name} passed');
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
        const detail = stderr.split('\n').filter(line => /Error|assert|expected|actual|\bat\b.*<anonymous>/i.test(line)).slice(0, 30).join('\n');
        throw new Error(`scenario ${name} failed:\n${detail || stderr.slice(-4000)}`);
    }
}

// Runs inside the synthetic host.
async function helpers(mockState, eventSource, sleep, replayUrl) {
    const { createCatchUp } = await import(replayUrl);
    const fail = message => { throw new Error(message); };
    const check = (condition, message) => { if (!condition) fail(message); };
    const equal = (actual, expected, message) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${message}: expected ${JSON.stringify(expected).slice(0, 400)}, got ${JSON.stringify(actual).slice(0, 400)}`);
    };
    const runtime = globalThis.NPCStateDelta;
    const settings = mockState.extensionSettings.npc_state_delta;
    settings.scanEvery = 1;
    const scannerCalls = () => mockState.rawCalls.map(call => call?.[0] || {}).filter(args => /isolated dossier scanner\./i.test(String(args.systemPrompt || '')));
    const emitAsync = async (event, ...args) => {
        await Promise.all((mockState.listeners.get(event) || []).map(fn => fn(...args)));
        await sleep(40);
    };
    const reply = (text, at) => ({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: 0, swipes: [text], send_date: new Date(Date.UTC(2026, 0, 1, 0, at)).toISOString() });
    const user = text => ({ is_user: true, is_system: false, name: 'Kazuma', mes: text });
    // A live turn through the real events.
    let clock = 0;
    const turn = async (userText, replyText) => {
        mockState.context.chat.push(user(userText));
        await emitAsync('message_sent', mockState.context.chat.length - 1);
        await emitAsync('generation_after_commands', 'normal', {}, false);
        mockState.context.chat.push(reply(replyText, clock += 1));
        const id = mockState.context.chat.length - 1;
        await emitAsync('message_received', id);
        await sleep(80);
        return id;
    };
    // Replies added to the chat with no event: the ones a restore left unread.
    const addReplies = count => {
        for (let i = 1; i <= count; i += 1) {
            mockState.context.chat.push(user(`We walk on ${i}.`));
            mockState.context.chat.push(reply(i % 3 === 0 ? `Yunyun speaks, mark-${i}.` : `The road goes on, mark-${i}.`, clock += 1));
        }
    };
    // The deterministic model: its answer depends on the CURRENT exchange of the prompt alone.
    mockState.fakeCalls = [];
    mockState.quietResponder = async (args = {}) => {
        if (!/isolated dossier scanner\./i.test(String(args.systemPrompt || ''))) return '{"npcs":[]}';
        const prompt = String(args.prompt || '');
        mockState.fakeCalls.push(prompt);
        if (mockState.failWhen?.(prompt, mockState.fakeCalls.length)) throw new Error('the model failed');
        if (mockState.holdWhen) await mockState.holdWhen(prompt, mockState.fakeCalls.length);
        const seen = [...prompt.matchAll(/mark-(\d+)/g)].map(match => Number(match[1]));
        const top = seen.length ? Math.max(...seen) : 0;
        const npcs = /Yunyun/.test(prompt) ? [{ name: 'Yunyun', present: true, role: 'adventurer', mood: top % 2 ? 'calm' : 'wary', location: `mile ${top}` }] : [];
        return JSON.stringify({ npcs });
    };
    let published = 0;
    let changes = 0;
    const controller = (extra = {}) => createCatchUp({
        chatKey: () => runtime.chatKey(), enabled: () => true, live: () => runtime.replay, changed: () => { changes += 1; }, publish: async () => { published += 1; }, warn() {}, ...extra,
    });
    const stable = state => {
        const copy = JSON.parse(JSON.stringify(state));
        // The dossiers, the counters and the cards; not the clock stamps, the journal of rollbacks or the branch bookkeeping (those differ by when they ran).
        // The live-eligibility marks (memory facts) are bookkeeping too: a rebuild keeps them, but their position among the state's keys differs.
        for (const key of Object.keys(copy)) if (/^(rollback|branch)|^(lastScanAt|timeline|catchUp|checkpoints|scanCount|lineage|portraitAssets|formPortraitAssets|memoryFactMarks)$/.test(key)) delete copy[key];
        for (const item of [...(copy.pendingBackfills || []), ...(copy.inlineCards || [])]) for (const key of ['requestedAt', 'lastAttemptAt', 'createdAt']) delete item[key];
        for (const list of [copy.npcs, ...(copy.inlineCards || []).map(entry => entry.cards)]) for (const npc of list || []) for (const key of ['createdAt', 'updatedAt', 'archivedAt']) delete npc[key];
        return copy;
    };
    return { fail, check, equal, runtime, settings, scannerCalls, turn, addReplies, reply, user, emitAsync, mockState, sleep, controller, stable, published: () => published, changes: () => changes };
}
