// N7 fix (REVN7X B-S2): replay == live with sids that belong to the MESSAGE (not its index), so a middle delete moves the index and not the sid; an edited Re-read
// (grown and shrunk). Same synthetic host as nsd16-runtime.test.js. Rewind, a browser reload and a chat change need the real host: the replica run.


import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TRY_MARKER = '\ntry {\n    await import(pathToFileURL(path.join(extRoot, \'index.js\'))';

function runCalls(name, hosted, scenario) {
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
    globalThis.PAYLOAD = { npcs: [{ name: 'Orsen', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }] };
    // A backfill finds the NPC it asks for; every other request finds nothing new.
    mockState.quietResponder = async (args = {}) => {
        if (globalThis.FAIL_FILL === 'throw') throw new Error('the model is down');
        if (globalThis.FAIL_FILL) return 'not json';
        if (/isolated dossier scanner\\./i.test(String(args.systemPrompt || ''))) { const given = globalThis.SCAN_RESULT; globalThis.SCAN_RESULT = null; return JSON.stringify(given || { npcs: [] }); }
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
    const reply = async (text, payload) => {
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'And then?' });
        await emitAll('message_sent', mockState.context.chat.length - 1);
        await emitAll('generation_after_commands', 'normal', {}, false);
        // N7: the block is no longer asked for or applied. A reply that lists people is a reply with no <Changes> block that names them (the NSD16 fallback scan),
        // and the scanner answers with the payload.
        const mes = text;
        globalThis.SCAN_RESULT = payload || { npcs: [] };
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes, swipe_id: 0, swipes: [mes] });
        const id = mockState.context.chat.length - 1;
        const before = kinds();
        await emitAll('message_received', id);
        const held = minus(kinds(), before);
        await emitAll('character_message_rendered', id);
        await sleep(400);
        return { id, held, all: minus(kinds(), before) };
    };
    const result = await (${scenario.toString()})({ reply, settings, mockState, sleep, kinds });
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



/* global ZERO */
/* global PAYLOAD */
/* global MODE */

// The scenario runs inside the host script, so its mode is written into its source.
const scene = mode => new Function('return ' + SCENE.toString().replace(/\bMODE\b/g, JSON.stringify(mode)))();

const SCENE = async ({ reply, settings, mockState, sleep, kinds }) => {
    const { edit, deleteFirst } = MODE;
    let counter = 0;
    // A sid is the message's own: handed out once per message object, so deleting an earlier message never changes it.
    mockState.sdk.query = (name, args) => (name === 'npc.replySid' ? (mockState.context.chat[args?.asOf] && (mockState.context.chat[args.asOf].sidOwn ??= `sid-${counter++}`)) : null);
    settings.narrationCaptureCatchUp = 1;
    const refreshed = { npcs: [{ name: 'Orsen', present: true, role: 'adventurer', personality: 'Wary and watchful.', speech: 'Short, curt sentences.', relationshipImpact: 'none', relationshipDelta: ZERO }] };
    mockState.quietResponder = async (args = {}) => {
        const system = String(args.systemPrompt || '');
        if (/isolated dossier scanner\./i.test(system)) { const given = globalThis.SCAN_RESULT; globalThis.SCAN_RESULT = null; return JSON.stringify(given || { npcs: [] }); }
        if (/reconciliation scanner/i.test(system)) return JSON.stringify(refreshed);
        return '{"npcs":[]}';
    };
    await reply('The wind rose over the water.', null);
    const run = await reply('At the gate stood Orsen, arms folded.', PAYLOAD);
    await sleep(800);
    const api = globalThis.NPCStateDelta;
    const live = api.getState();
    const strip = npc => npc && Object.fromEntries(Object.entries(npc).filter(([key]) => !/At$|^updated|^seen|^last|^first|^memor|^fieldChange/i.test(key)));
    const liveOrsen = strip(live.npcs.find(n => n.name === 'Orsen'));
    const chat = mockState.context.chat;
    if (deleteFirst) chat.splice(0, 2);   // a middle delete: the first exchange goes, the index moves, the sid stays
    const at = chat.findIndex(m => String(m.mes).includes('At the gate'));
    if (edit) { const text = edit === 'grown' ? `${chat[at].mes} The rain began, and a lantern swung from the arch above his head.` : 'Orsen.'; chat[at].mes = text; chat[at].swipes = [text]; }
    const before = kinds();
    const copy = api.replay.empty();
    const out = await api.replay.reply(copy, at, { toast() {}, write() {} }, api.uiStatus().chatKey);
    const after = kinds();
    return { at, out: out ?? null, calls: { refresh: after.refresh - before.refresh, scanner: after.scanner - before.scanner }, liveOrsen, replayed: strip((copy.npcs || []).find(n => n.name === 'Orsen')) ?? null, replayNames: (copy.npcs || []).map(n => n.name) };
};

test('N7: a middle delete before a hosted reply: the replay finds the reply by its own sid, asks the model for nothing and ends equal to live', () => {
    const r = runCalls('delete', true, scene({ deleteFirst: true }));
    assert.equal(r.at, 1, 'the reply moved from index 3 to 1');
    assert.equal(r.out, null);
    assert.deepEqual(r.calls, { refresh: 0, scanner: 0 }, 'every answer comes from the journal entry the sid still finds');
    assert.equal(r.liveOrsen.personality, 'Wary and watchful.');
    assert.deepEqual(r.replayed, r.liveOrsen);
});

for (const edit of ['grown', 'shrunk']) {
    test(`N7: an edited Re-read (${edit}) of a hosted reply applies neither the old catch-up Refresh nor the old fallback answer`, () => {
        const r = runCalls(`edit-${edit}`, true, scene({ edit }));
        assert.equal(r.out, null);
        assert.deepEqual(r.calls, { refresh: 0, scanner: 0 }, 'no stale answer and no new model call on a Re-read of an edit');
        assert.deepEqual(r.replayNames, [], 'nobody admitted by the old text: an edit has no fallback scan (the owner\'s note)');
        assert.equal(r.replayed, null);
    });
}
