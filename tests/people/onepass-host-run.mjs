// The synthetic-host runner for one-pass call tests: runs a scenario in a child process on runtime-smoke.mjs, hosted (fake Story Block v2) or not.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TRY_MARKER = '\ntry {\n    await import(pathToFileURL(path.join(extRoot, \'index.js\'))';

export function runCalls(name, hosted, scenario) {
    let source = fs.readFileSync(new URL('./runtime-smoke.mjs', import.meta.url), 'utf8');
    source = source.replace('const here = path.dirname(fileURLToPath(import.meta.url));', `const here = ${JSON.stringify(fileURLToPath(new URL('.', import.meta.url)))};`);
    const cut = source.indexOf(TRY_MARKER);
    if (cut < 0) throw new Error('Runtime smoke import marker changed');
    const script = `${source.slice(0, cut)}
globalThis.document.documentElement = { dataset: {} };
globalThis.document.readyState = 'loading';
fs.cpSync(path.join(sourceRoot, 'src'), path.join(extRoot, 'src'), { recursive: true });
mockState.storyBlockTabs = [];
mockState.context.eventTypes.GENERATION_AFTER_COMMANDS = 'generation_after_commands';
mockState.context.eventTypes.GENERATION_STOPPED = 'generation_stopped';
mockState.context.eventTypes.CHAT_COMPLETION_PROMPT_READY = 'chat_completion_prompt_ready';
mockState.context.updateMessageBlock = () => {};
if (${hosted}) {
    const sdk = {
        registered: [], sent: [],
        registerModule(def) { sdk.registered.push(def); },
        command: async (type, payload, options) => { sdk.sent.push({ type, payload, options: options ?? null }); return { ok: true, receipt: { summary: '' } }; },
        query: () => null,
        settings: () => ({}),
    };
    mockState.sdk = sdk;
    globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
}
try {
    await import(pathToFileURL(path.join(extRoot, 'index.js')).href + \`?t=\${Date.now()}\`);
    await sleep(30);
    eventSource.emit('app_ready');
    eventSource.emit('extension_settings_loaded');
    await sleep(30);
    await import(pathToFileURL(path.join(extRoot, 'story-block-tabs.js')).href);
    await sleep(30);
    if (${hosted}) await waitFor(() => mockState.sdk.registered.length === 1);
    const settings = mockState.extensionSettings.storySuite.modules['npc-state-delta'];
    settings.narrationCapture = true;
    globalThis.ZERO = { trust: 0, affection: 0, desire: 0, tension: 0 };
    // A backfill finds the NPC it asks for; every other request finds nothing new.
    mockState.quietResponder = async (args = {}) => {
        if (/isolated dossier scanner\\./i.test(String(args.systemPrompt || '')) && globalThis.SCAN_RESULT) { const given = globalThis.SCAN_RESULT; globalThis.SCAN_RESULT = null; return JSON.stringify(given); }
        const asked = (/backfill scanner/i.test(String(args.systemPrompt || '')) ? String(args.prompt || '').match(/^(?:Requested|Target) NPC: (.+?)(?: [(].*)?$/m)?.[1] : undefined);
        return asked ? JSON.stringify({ npcs: [{ name: asked, present: true, role: 'regular', relationshipImpact: 'none', relationshipDelta: ZERO }] }) : '{"npcs":[]}';
    };
    const emitAll = async (event, ...args) => { await Promise.all((mockState.listeners.get(event) || []).map(fn => fn(...args))); };
    const kinds = () => {
        const out = { scanner: 0, relationship: 0, backfill: 0, refresh: 0 };
        for (const call of mockState.rawCalls) {
            const system = String(call?.[0]?.systemPrompt || '');
            if (/isolated dossier scanner\\./i.test(system)) out.scanner += 1;
            else if (/relationship evaluator/i.test(system)) out.relationship += 1;
            else if (/backfill scanner/i.test(system)) out.backfill += 1;
            else if (/reconciliation scanner/i.test(system)) out.refresh += 1;
        }
        return out;
    };
    const minus = (a, b) => Object.fromEntries(Object.keys(a).map(key => [key, a[key] - b[key]]));
    // One reply with a capture block: the calls the reply's MESSAGE_RECEIVED awaited, and all the
    // calls it led to once Delta settled.
    const reply = async (text, payload, { unterminated = false } = {}) => {
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' });
        await emitAll('message_sent', mockState.context.chat.length - 1);
        await emitAll('generation_after_commands', 'normal', {}, false);
        const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const block = payload === null ? text : text + '\\n\\n<!--npc_state_delta\\n' + raw + (unterminated ? '' : '\\n-->');
        // Hosted (N7): the block is no longer asked for or applied; a reply that lists people is one with no <Changes> block that names them (the NSD16 fallback scan), answered with the payload.
        const names = typeof payload === 'object' && payload ? (payload.npcs || []).map(n => n.name).filter(Boolean) : [];
        const mes = ${hosted} ? (names.length ? text + ' In the story, ' + names.join(' and ') + ' stand there.' : text) : block;
        if (${hosted}) globalThis.SCAN_RESULT = typeof payload === 'object' && payload ? payload : null;
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes, swipe_id: 0, swipes: [mes] });
        const id = mockState.context.chat.length - 1;
        const before = kinds();
        await emitAll('message_received', id);
        const held = minus(kinds(), before);
        await emitAll('character_message_rendered', id);
        await sleep(400);
        return { id, held, all: minus(kinds(), before) };
    };
    const result = await (${scenario.toString()})({ reply, settings, mockState, sleep, kinds, emitAll });
    console.log('RESULT ' + JSON.stringify(result));
} finally {
    for (const handle of pendingHostTimers) nativeClearTimeout(handle);
    pendingHostTimers.clear();
    delete globalThis.__npcMock;
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
`;
    let output;
    try {
        output = execFileSync(process.execPath, ['--import', new URL('./active-runtime-test-setup.mjs', import.meta.url).href, '--input-type=module'], {
            input: script, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
        });
    } catch (error) {
        const stderr = String(error.stderr || '');
        const detail = stderr.split('\n').filter(line => /Error|assert|expected|actual/i.test(line)).slice(0, 30).join('\n');
        throw new Error(`scenario ${name} failed:\n${detail || stderr.slice(-4000)}`);
    }
    const line = String(output).split('\n').find(text => text.startsWith('RESULT '));
    assert.ok(line, `scenario ${name} printed its result`);
    return JSON.parse(line.slice(7));
}

