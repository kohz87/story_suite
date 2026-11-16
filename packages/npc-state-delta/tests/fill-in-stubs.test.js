// N4: the fill-in of a `+ npc` stub (queue reason new-person, built and unwired until N7). Same harness as onepass-backfill-cadence.test.js: Delta's real
// handlers on the synthetic host. One fill-in per new person of a reply (the per-reply cap does not hold it back), the quote line in its prompt, one retry as
// the request layer's one compact retry (never a second attempt stacked on it), a visible note when it fails.

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
    const settings = mockState.extensionSettings.npc_state_delta;
    settings.narrationCapture = true;
    globalThis.ZERO = { trust: 0, affection: 0, desire: 0, tension: 0 };
    // A backfill finds the NPC it asks for; every other request finds nothing new.
    mockState.quietResponder = async (args = {}) => {
        if (globalThis.FAIL_FILL === 'throw') throw new Error('the model is down');
        if (globalThis.FAIL_FILL) return 'not json';
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
        const mes = \`\${text}\\n\\n<!--npc_state_delta\\n\${JSON.stringify(payload)}\\n-->\`;
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
test('two new people of one reply: two fill-ins in that reply, each with the quote line, none held by the per-reply cap', () => {
    const r = runCalls('two-stubs', true, async ({ reply, settings, mockState }) => {
        const mk = n => ({ name: n, present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO });
        const st = () => globalThis.NPCStateDelta.getState();
        settings.narrationCaptureCatchUp = 0;
        await reply('Wiz and Chris arrive.', { npcs: [mk('Wiz'), mk('Chris')] });
        await reply('Quiet.', { npcs: [] });
        const before = mockState.rawCalls.length;
        const stubs = ['Wiz', 'Chris'].map(name => ({ id: st().npcs.find(n => n.name === name).id, name }));
        const refused = globalThis.NPCStateDelta.queueFills(stubs);   // no reply given: nothing is queued
        const at = mockState.context.chat.length - 1 - 1;   // the reply the stubs came from, not the head
        globalThis.NPCStateDelta.queueFills(stubs, at);
        const keyed = st().pendingBackfills.map(item => item.requestedMessageId);
        const queuedNow = st().pendingBackfills.map(item => item.reason);
        const run = await reply('Quiet again.', { npcs: [] });
        const calls = mockState.rawCalls.slice(before).filter(call => /backfill scanner/i.test(String(call?.[0]?.systemPrompt || '')));
        return { refused, at, keyed, held: run.held.backfill, all: run.all.backfill, queuedNow, calls: calls.length, quoted: calls.filter(call => /quote the few words of the story that show it/.test(String(call[0].prompt))).length, queued: st().pendingBackfills.length };
    });
    assert.equal(r.refused, false);
    assert.deepEqual(r.keyed, [r.at, r.at], 'each fill is keyed by the reply that made the stubs');
    assert.deepEqual(r.queuedNow, ['new-person', 'new-person']);
    assert.equal(r.held, 0, 'run after the reply: the reply did not wait for them (nothing added before Send)');
    assert.equal(r.all, 2);
    assert.equal(r.calls, 2, 'one fill-in per new person');
    assert.equal(r.quoted, 2, 'each carries the NSD6 quote line');
    assert.equal(r.queued, 0);
});

for (const [kind, expected, first] of [['not json', 2, { calls: 2, queued: 0 }], ['throw', 2, { calls: 1, queued: 1 }]]) {
    test(`a failed fill-in (${kind === 'throw' ? 'the model errors' : 'an answer that is not JSON'}) is dropped after ${expected} call${expected > 1 ? 's' : ''} and the reader is told once; the stub stays`, () => {
        const r = runCalls(`failed-fill-${kind}`, true, new Function('kind', 'return ' + (async ({ reply, settings, mockState }) => {
            const mk = n => ({ name: n, present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO });
            const st = () => globalThis.NPCStateDelta.getState();
            settings.narrationCaptureCatchUp = 0;
            const notes = [];
            globalThis.toastr = { warning: text => notes.push(String(text)), info() {}, error() {}, success() {} };
            await reply('Wiz arrives.', { npcs: [mk('Wiz')] });
            await reply('Quiet.', { npcs: [] });
            const wiz = st().npcs.find(n => n.name === 'Wiz');
            globalThis.FAIL_FILL = 'KIND';
            const before = mockState.rawCalls.length;
            const count = () => mockState.rawCalls.slice(before).filter(call => /backfill scanner/i.test(String(call?.[0]?.systemPrompt || ''))).length;
            const toasts = notes.length;
            globalThis.NPCStateDelta.queueFills([{ id: wiz.id, name: wiz.name }], mockState.context.chat.length - 1);
            await reply('Quiet 1.', { npcs: [] });
            const afterFirst = { calls: count(), queued: st().pendingBackfills.length };
            await reply('Quiet 2.', { npcs: [] });
            await reply('Quiet 3.', { npcs: [] });
            return { afterFirst, calls: count(), notes: notes.slice(toasts), stays: Boolean(st().npcs.find(n => n.name === 'Wiz')) };
        }).toString().replace('KIND', kind))());
        assert.deepEqual(r.afterFirst, first, 'an answer that is not JSON: its compact retry is the retry, dropped at once; a model error: one queued retry on the next run');
        assert.equal(r.calls, expected, 'two model calls at most, nothing tried again after');
        assert.equal(r.notes.length, 1, 'one note for the failure: ' + r.notes.join(' | '));
        assert.match(r.notes[0], /the profile for Wiz could not be filled in\. The name, role and look from the story stay/);
        assert.equal(r.stays, true);
    });
}
