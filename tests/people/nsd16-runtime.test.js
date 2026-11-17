// N7 (NSD16): the fallback scan runs only for a reply with no <Changes> block that names someone. Same synthetic host as fill-in-stubs.test.js: Delta's real
// handlers, hosted by a stub Story Block. Each test states the calls a reply makes; the fix each one guards is named in its title.


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

test('NSD16: a reply with no <Changes> block that names someone is scanned once, and the person is admitted', () => {
    const r = runCalls('names', true, async ({ reply }) => {
        const run = await reply('At the gate stood Orsen, arms folded.', PAYLOAD);
        return { all: run.all, names: globalThis.NPCStateDelta.getState().npcs.map(n => n.name) };
    });
    assert.equal(r.all.scanner, 1);
    assert.deepEqual(r.names, ['Orsen']);
});

test('NSD16: a reply with a <Changes> block is not scanned, even when it names someone', () => {
    const r = runCalls('block', true, async ({ reply }) => {
        const run = await reply('At the gate stood Orsen, arms folded.\n<Changes>\n+ npc Orsen | gate guard | a stocky man in a grey cloak\n</Changes>', PAYLOAD);
        return { all: run.all, names: globalThis.NPCStateDelta.getState().npcs.map(n => n.name) };
    });
    assert.equal(r.all.scanner, 0);
    assert.deepEqual(r.names, [], 'the scanner was never asked, so its answer is not applied');
});

test('NSD16: a reply that names no one is not scanned', () => {
    const r = runCalls('nobody', true, async ({ reply }) => {
        const run = await reply('The wind rose over the water and the lamps guttered.', PAYLOAD);
        return { all: run.all, names: globalThis.NPCStateDelta.getState().npcs.map(n => n.name) };
    });
    assert.equal(r.all.scanner, 0);
    assert.deepEqual(r.names, []);
});

test('NSD16: a stray JSON block is stripped from the reply and never applied', () => {
    const r = runCalls('stray', true, async ({ reply, mockState }) => {
        const block = '\n\n<!--npc_state_delta\n' + JSON.stringify(PAYLOAD) + '\n-->';
        const run = await reply('The wind rose over the water.' + block, null);
        return { all: run.all, names: globalThis.NPCStateDelta.getState().npcs.map(n => n.name), text: mockState.context.chat.at(-1).mes };
    });
    assert.deepEqual(r.names, []);
    assert.equal(r.all.scanner, 0);
    assert.doesNotMatch(r.text, /npc_state_delta/);
});

test('NSD16: a capitalised word that is a place Story Director knows is not a person', () => {
    const r = runCalls('place', true, async ({ reply, mockState }) => {
        const places = [{ id: 'p1', name: 'Bluewatch Guildhall' }];
        mockState.sdk.query = name => (name === 'atlas.places' ? places : null);
        const known = await reply('They crossed to Bluewatch before dusk.', PAYLOAD);
        mockState.sdk.query = () => null;   // no places source: the same words are taken for a name
        const unknown = await reply('They crossed to Bluewatch before dusk.', PAYLOAD);
        return { known: known.all.scanner, unknown: unknown.all.scanner };
    });
    assert.equal(r.known, 0);
    assert.equal(r.unknown, 1);
});

test('N7: a hosted reply is journaled under its own sid, with the people the catch-up took, and its fill-in is asked once', () => {
    const r = runCalls('journal', true, async ({ reply, settings, mockState, sleep }) => {
        mockState.sdk.query = (name, args) => (name === 'npc.replySid' ? `sid-${args?.asOf}` : null);
        settings.narrationCaptureCatchUp = 1;
        const run = await reply('At the gate stood Orsen, arms folded.', PAYLOAD);
        await sleep(600);
        const state = globalThis.NPCStateDelta.getState();
        const stubs = [{ id: 'npc_orsen', name: 'Orsen' }];
        const first = globalThis.NPCStateDelta.queueFills(stubs, run.id);
        const again = globalThis.NPCStateDelta.queueFills(stubs, run.id);
        const journal = globalThis.NPCStateDelta.getState().captureJournal || [];
        return { keys: journal.map(item => item.key), catchUp: journal.map(item => item.catchUp || null), asked: journal.map(item => item.asked || null), first, again, names: state.npcs.map(n => n.name) };
    });
    assert.deepEqual(r.keys.length, 1);
    assert.match(r.keys[0], /^sid:sid-\d+$/);
    assert.equal(r.first, true);
    assert.equal(r.again, false, 'the second ask finds the mark in the reply\'s entry');
    assert.deepEqual(r.asked[0], ['npc_orsen']);
    assert.ok(Array.isArray(r.catchUp[0]) && r.catchUp[0].length >= 1, 'the catch-up that ran for this reply is kept with it');
});

test('N7: replay == live for a hosted reply the catch-up took: the replay repeats the Refresh from the journal and ends in the live state', () => {
    const r = runCalls('replay', true, async ({ reply, settings, mockState, sleep, kinds }) => {
        mockState.sdk.query = (name, args) => (name === 'npc.replySid' ? `sid-${args?.asOf}` : null);
        settings.narrationCaptureCatchUp = 1;
        const refreshed = { npcs: [{ name: 'Orsen', present: true, role: 'adventurer', personality: 'Wary and watchful.', speech: 'Short, curt sentences.', relationshipImpact: 'none', relationshipDelta: ZERO }] };
        mockState.quietResponder = async (args = {}) => {
            const system = String(args.systemPrompt || '');
            if (/isolated dossier scanner\./i.test(system)) { const given = globalThis.SCAN_RESULT; globalThis.SCAN_RESULT = null; return JSON.stringify(given || { npcs: [] }); }
            if (/reconciliation scanner/i.test(system)) return JSON.stringify(refreshed);
            return '{"npcs":[]}';
        };
        const run = await reply('At the gate stood Orsen, arms folded.', PAYLOAD);
        await sleep(800);
        const api = globalThis.NPCStateDelta;
        const live = api.getState();
        const entry = (live.captureJournal || [])[0] || {};
        const before = kinds();
        const copy = api.replay.empty();   // a state that has read nothing yet, with the journal live kept
        const out = await api.replay.reply(copy, run.id, { toast() {}, write() {} }, api.uiStatus().chatKey);
        const model = kinds();
        return { journaled: Object.keys(entry.refreshes || {}), catchUp: entry.catchUp || null, out: out ?? null, calls: { refresh: model.refresh - before.refresh, scanner: model.scanner - before.scanner }, livePersonality: (live.npcs.find(n => n.name === 'Orsen') || {}).personality, replayed: copy.npcs.find(n => n.name === 'Orsen') || null, liveOrsen: live.npcs.find(n => n.name === 'Orsen') || null };
    });
    assert.deepEqual(r.catchUp, ['npc_orsen'], 'live kept who the catch-up took');
    assert.deepEqual(r.journaled, ['npc_orsen'], 'and what its Refresh answered');
    assert.equal(r.out, null, 'the replay of the reply finished');
    assert.deepEqual(r.calls, { refresh: 0, scanner: 0 }, 'the replay asks the model for nothing: every answer comes from the journal');
    const strip = npc => npc && Object.fromEntries(Object.entries(npc).filter(([key]) => !/At$|^updated|^seen|^last|^first|^memor/i.test(key)));
    assert.equal(r.livePersonality, 'Wary and watchful.', 'the live Refresh wrote the dossier text a replay must repeat');
    assert.deepEqual(strip(r.replayed), strip(r.liveOrsen), 'the person is the same on the replay as live');
});
