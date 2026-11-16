import test from 'node:test';
import assert from 'node:assert/strict';
import { createInlineCardsMountPart } from '../../modules/people/legacy/runtime-inline-cards-mount.js';
import { createWatchers } from '../../modules/people/adapter/cast-ui/watchers.js';
import { createStorySuiteV2Adapter } from '../../modules/people/storysuite-v2.js';

test('page-API change notifications: only the streamed-token cast render is coalesced and held; every other change goes out at once', async () => {
    let generating = false;
    const { watchers, notifyChange } = createWatchers({ warn: () => {}, delta: () => ({ generationActive: () => generating }) });
    let calls = 0;
    watchers.add(() => { calls += 1; });
    notifyChange(true);
    assert.equal(calls, 1, 'the first one runs at once');
    for (let i = 0; i < 50; i += 1) notifyChange(true);
    assert.equal(calls, 1, 'the burst waits');
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.equal(calls, 2, 'the burst became one trailing call');
    generating = true;
    for (let i = 0; i < 50; i += 1) notifyChange(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(calls, 2, 'nothing runs while a reply is being made');
    notifyChange();   // a user-driven change (not the streamed-token render): out at once, also in a generation
    assert.equal(calls, 3, 'it did not wait for the generation');
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(calls, 3, 'it also took the waiting trailing call with it');
    generating = false;
    notifyChange(true);
    assert.equal(calls, 4, 'after the generation the first one runs at once');
    notifyChange(true);   // inside the quiet gap of that run: waits
    notifyChange();       // an immediate one takes the waiting call with it
    assert.equal(calls, 5);
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.equal(calls, 5, 'nothing stays scheduled');
});

test('page-API notifications: the first marked one during an active generation is held (not run at once), and a plain one still goes out at once', async () => {
    const { watchers, notifyChange } = createWatchers({ warn: () => {}, delta: () => ({ generationActive: () => true }) });
    let calls = 0;
    watchers.add(() => { calls += 1; });
    notifyChange(true);
    assert.equal(calls, 0, 'the first marked notification of an active generation is held');
    notifyChange();
    assert.equal(calls, 1, 'an unmarked one goes out at once and takes the waiting call');
    await new Promise(resolve => setTimeout(resolve, 900));
    assert.equal(calls, 1, 'nothing stays scheduled');
});

test('the real adapter wiring: Delta turned off during a generation tells the page API at once; the streamed-token cast render is held until the generation ends', async () => {
    const listeners = new Map();
    const doc = { documentElement: { dataset: {} }, getElementById: () => null, addEventListener: (name, fn) => listeners.set(name, [...(listeners.get(name) ?? []), fn]), dispatchEvent: () => true };
    const fire = (name, detail) => { for (const fn of listeners.get(name) ?? []) fn({ type: name, detail }); };
    let enabled = true;
    let generating = false;
    const npc = { id: 'mira', name: 'Mira', present: true };
    const delta = { isEnabled: () => enabled, generationActive: () => generating, presentCastHtml: () => '', fillPresentCast: () => {}, dossierRevision: () => 'chat|1', getNpc: () => npc, dossiersReady: () => true };
    const sdk = { registerModule: async () => true, on: () => () => {}, query: () => [], settings: () => ({}), feature: () => false };
    const host = { apiVersion: 2, sdk, ready: Promise.resolve(sdk) };
    const timers = { setTimeout: () => 0, clearTimeout() {}, setInterval: () => ({ unref() {} }), clearInterval() {} };
    const adapter = createStorySuiteV2Adapter({ suiteApi: { npcs: () => [npc] }, delta: () => delta, host: () => host, doc, timers, logger: { warn() {} }, loadEmptyCast: async () => null });
    adapter.start();
    await adapter.settled();
    assert.equal(adapter.hosted(), true);
    let calls = 0;
    const seen = [];
    const off = adapter.pageApi.onChange(() => { calls += 1; seen.push(adapter.pageApi.available()); });
    try {
        generating = true;
        fire('npc-state-delta:cast-rendered', { streaming: true });   // the first runs at once
        const first = calls;
        for (let i = 0; i < 20; i += 1) fire('npc-state-delta:cast-rendered', { streaming: true });   // one per streamed token
        assert.equal(calls, first, 'the streamed-token renders wait');
        fire('npc-state-delta:cast-rendered', { streaming: false });   // a manual dossier edit's render (not the streaming message's growth)
        assert.equal(calls, first + 1, 'a render not caused by the stream goes out at once, mid-generation');
        const base = calls;
        enabled = false;
        fire('npc-state-delta:enabled-changed');
        assert.equal(calls, base + 1, 'Delta turned off goes out at once, in the middle of the generation');
        assert.equal(seen.at(-1), false, 'and the page API already says it is off');
        await new Promise(resolve => setTimeout(resolve, 1000));
        assert.equal(calls, base + 1, 'nothing else is run for the held renders');
    } finally { off(); adapter.stop(); generating = false; }
});

test('inline cards: only a render caused by the streaming message\'s growth says so in its cast-rendered event; every other render does not', async () => {
    const saved = globalThis.MutationObserver;
    const savedDocument = globalThis.document;
    let callback = null;
    globalThis.MutationObserver = class { constructor(fn) { callback = fn; } observe() {} disconnect() {} };
    const details = [];
    globalThis.document = { dispatchEvent: event => { details.push(event.detail?.streaming); }, querySelectorAll: () => [] };
    let streaming = null;
    const chat = { querySelectorAll: () => [] };
    const replies = new Map();   // mesid -> reply text length, as the page shows it
    const mutationIn = (id, { added = 1, removed = 0, grow = 8 } = {}) => {
        replies.set(id, (replies.get(id) ?? 0) + grow);
        const mes = { getAttribute: () => String(id), querySelector: () => ({ textContent: 'x'.repeat(replies.get(id)) }) };
        return [{ type: 'childList', target: { closest: selector => (selector === '.mes' ? mes : null) }, addedNodes: Array(added).fill({}), removedNodes: Array(removed).fill({}) }];
    };
    try {
        const part = createInlineCardsMountPart({}, { chatHydrationStatus: () => 'ready', getChatKey: () => 'chat-1', getChatState: () => ({}), streamingMessageId: () => streaming }, {
            chatElementForInlineObserver: () => chat, messageElement: () => null, inlineRosterHtml: () => '', inChatCastMode: () => 'on',
            inlineEntriesForRender: () => [], meguminIntegrationMessageId: () => null, meguminBlockCardForMessage: () => null,
            cleanupStaleMeguminIntegrations: () => {}, inlineAnchorMessageId: () => null, mountNpcStateInsideMeguminBlock: () => false,
        });
        part.ensureInlineObserver();
        const settle = () => new Promise(resolve => setTimeout(resolve, 150));
        streaming = 5;
        callback(mutationIn(5));   // the first look at the streaming message sets the baseline: an ordinary render
        await settle();
        assert.deepEqual(details, [false], 'no earlier length to compare: not marked');
        details.length = 0;
        for (let i = 0; i < 20; i += 1) callback(mutationIn(5));
        await settle();
        assert.deepEqual(details, [true], 'the streaming message grew: one render, marked streaming');
        details.length = 0;
        callback(mutationIn(3));   // another message redrew
        await settle();
        assert.deepEqual(details, [false], 'a render of another message is not marked');
        details.length = 0;
        callback(mutationIn(5));
        part.queueInlineRender(0);   // a manual edit asks in the same window
        await settle();
        assert.deepEqual(details, [false], 'a manual ask in the same window makes it an ordinary render');
        details.length = 0;
        streaming = null;
        callback(mutationIn(5));   // not streaming
        await settle();
        assert.deepEqual(details, [false], 'without a stream nothing is marked');
    } finally {
        globalThis.MutationObserver = saved;
        globalThis.document = savedDocument;
    }
});

test('inline cards: a streamed render that is skipped or throws leaves no mark; a direct render and a manual mutation in the same stream reach the World subscriber at once', async () => {
    const saved = globalThis.MutationObserver;
    const savedDocument = globalThis.document;
    let callback = null;
    globalThis.MutationObserver = class { constructor(fn) { callback = fn; } observe() {} disconnect() {} };
    const details = [];
    let onDetail = () => {};
    globalThis.document = { dispatchEvent: event => { details.push(event.detail?.streaming); onDetail(event.detail); }, querySelectorAll: () => [] };
    const chat = { querySelectorAll: () => [] };
    const replies = new Map();   // mesid -> reply text length, as the page shows it
    const mutationIn = (id, { added = 1, removed = 0, grow = 8 } = {}) => {
        replies.set(id, (replies.get(id) ?? 0) + grow);
        const mes = { getAttribute: () => String(id), querySelector: () => ({ textContent: 'x'.repeat(replies.get(id)) }) };
        return [{ type: 'childList', target: { closest: selector => (selector === '.mes' ? mes : null) }, addedNodes: Array(added).fill({}), removedNodes: Array(removed).fill({}) }];
    };
    let hydration = 'loading';
    let throwing = false;
    const { watchers, notifyChange } = createWatchers({ warn: () => {}, delta: () => ({ generationActive: () => true }) });   // a stream is running
    let worldCalls = 0;
    watchers.add(() => { worldCalls += 1; });
    onDetail = detail => notifyChange(detail?.streaming === true);   // what timeline.js does
    try {
        const part = createInlineCardsMountPart({}, { chatHydrationStatus: () => hydration, getChatKey: () => 'chat-1', getChatState: () => ({}), streamingMessageId: () => 5 }, {
            chatElementForInlineObserver: () => chat, messageElement: () => null, inlineRosterHtml: () => '', inChatCastMode: () => 'on',
            inlineEntriesForRender: () => { if (throwing) throw new Error('boom'); return []; }, meguminIntegrationMessageId: () => null, meguminBlockCardForMessage: () => null,
            cleanupStaleMeguminIntegrations: () => {}, inlineAnchorMessageId: () => null, mountNpcStateInsideMeguminBlock: () => false,
        });
        part.ensureInlineObserver();
        const settle = () => new Promise(resolve => setTimeout(resolve, 150));
        const warn = console.warn;
        console.warn = () => {};
        try {
            callback(mutationIn(5)); await settle(); details.length = 0; worldCalls = 0;   // baseline
            callback(mutationIn(5));   // streamed render, skipped: hydration is not ready
            await settle();
            hydration = 'ready';
            throwing = true;
            callback(mutationIn(5));   // streamed render that throws
            await settle();
            throwing = false;
        } finally { console.warn = warn; }
        assert.deepEqual(details, [], 'neither the skipped nor the throwing render reached the event');
        part.renderInlineCards();   // a direct call (the public renderInline)
        assert.deepEqual(details, [false], 'a direct render is never marked');
        assert.equal(worldCalls, 1, 'the World subscriber got it at once, in the middle of the stream');
        part.queueInlineRender(0);   // a real manual mutation (portrait removal) renders
        await settle();
        assert.deepEqual(details, [false, false]);
        assert.equal(worldCalls, 2, 'and again at once');
    } finally {
        globalThis.MutationObserver = saved;
        globalThis.document = savedDocument;
    }
});

test('inline cards + real adapter + page-API subscriber (the People widget\'s contract): only the reply growing in the streaming message is held; removals, replacements, other messages and a changed streaming message go out at once', async () => {
    const saved = { observer: globalThis.MutationObserver, document: globalThis.document };
    let callback = null;
    globalThis.MutationObserver = class { constructor(fn) { callback = fn; } observe() {} disconnect() {} };
    const listeners = new Map();
    const doc = {
        documentElement: { dataset: {} }, getElementById: () => null, querySelectorAll: () => [],
        addEventListener: (name, fn) => listeners.set(name, [...(listeners.get(name) ?? []), fn]),
        dispatchEvent: event => { for (const fn of listeners.get(event.type) ?? []) fn(event); return true; },
    };
    globalThis.document = doc;
    let streaming = 5;
    const npc = { id: 'mira', name: 'Mira', present: true };
    const delta = { isEnabled: () => true, generationActive: () => streaming !== null, presentCastHtml: () => '', fillPresentCast: () => {}, dossierRevision: () => 'chat|1', getNpc: () => npc, dossiersReady: () => true };
    const sdk = { registerModule: async () => true, on: () => () => {}, query: () => [], settings: () => ({}), feature: () => false };
    const host = { apiVersion: 2, sdk, ready: Promise.resolve(sdk) };
    const timers = { setTimeout: () => 0, clearTimeout() {}, setInterval: () => ({ unref() {} }), clearInterval() {} };
    const adapter = createStorySuiteV2Adapter({ suiteApi: { npcs: () => [npc] }, delta: () => delta, host: () => host, doc, timers, logger: { warn() {} }, loadEmptyCast: async () => null });
    adapter.start();
    await adapter.settled();
    let widgetCalls = 0;
    const off = adapter.pageApi.onChange(() => { widgetCalls += 1; });   // what SD's People widget does: page.onChange(refresh)
    const lengths = new Map();
    const thinking = new Map();   // mesid -> reasoning length (its own block, beside the reply text)
    const node = text => ({ nodeType: 3, textContent: text });
    const mutation = (id, { added = 1, removed = 0, size, reasoning, addedText = '', removedText = '' }) => {
        lengths.set(id, size);
        if (reasoning !== undefined) thinking.set(id, reasoning);
        const mes = { getAttribute: () => String(id), querySelector: sel => (sel === '.mes_text' ? { textContent: 'x'.repeat(lengths.get(id)) } : sel === '.mes_reasoning' && thinking.has(id) ? { textContent: 'r'.repeat(thinking.get(id)) } : null) };
        return [{ type: 'childList', target: { closest: s => (s === '.mes' ? mes : null) }, addedNodes: Array(added).fill(node(addedText)), removedNodes: Array(removed).fill(node(removedText)) }];
    };
    const part = createInlineCardsMountPart({}, { chatHydrationStatus: () => 'ready', getChatKey: () => 'chat-1', getChatState: () => ({}), streamingMessageId: () => streaming }, {
        chatElementForInlineObserver: () => ({ querySelectorAll: () => [] }), messageElement: () => null, inlineRosterHtml: () => '', inChatCastMode: () => 'on',
        inlineEntriesForRender: () => [], meguminIntegrationMessageId: () => null, meguminBlockCardForMessage: () => null,
        cleanupStaleMeguminIntegrations: () => {}, inlineAnchorMessageId: () => null, mountNpcStateInsideMeguminBlock: () => false,
    });
    const settle = () => new Promise(resolve => setTimeout(resolve, 150));
    const marks = [];
    doc.addEventListener('npc-state-delta:cast-rendered', event => marks.push(event.detail.streaming));
    try {
        part.ensureInlineObserver();
        callback(mutation(5, { size: 10 })); await settle();   // baseline
        const base = widgetCalls;
        marks.length = 0;
        for (let i = 1; i <= 15; i += 1) { callback(mutation(5, { size: 10 + i * 5 })); }
        await settle();
        assert.deepEqual(marks, [true], 'growth: marked');
        assert.equal(widgetCalls, base, 'growth: held for the subscriber');
        for (let i = 1; i <= 5; i += 1) callback(mutation(5, { size: 85, reasoning: i * 20 }));   // a model thinking: only the reasoning block grows
        await settle();
        assert.deepEqual(marks, [true, true], 'reasoning growth is growth: marked');
        assert.equal(widgetCalls, base, 'and held');
        thinking.delete(5);
        marks.length = 0;
        callback(mutation(5, { added: 0, removed: 2, size: 60 })); await settle();   // a removal
        assert.deepEqual(marks, [false]); assert.equal(widgetCalls, base + 1, 'removal: at once');
        callback(mutation(5, { added: 1, removed: 1, size: 60 })); await settle();   // replaced by text of the same length
        assert.equal(widgetCalls, base + 2, 'replacement without growth: at once');
        callback(mutation(5, { added: 1, removed: 1, size: 20 })); await settle();   // replaced by shorter text
        assert.equal(widgetCalls, base + 3, 'shorter replacement: at once');
        callback(mutation(3, { size: 40 })); await settle();   // another message
        assert.equal(widgetCalls, base + 4, 'other message: at once');
        callback(mutation(5, { size: 30 })); callback(mutation(5, { added: 0, removed: 1, size: 25 })); await settle();   // growth then a removal in two calls in one debounce window
        assert.equal(widgetCalls, base + 5, 'a mixed window is an ordinary render');
        // the host re-sets the text node while appending: "Hel" out, "Hello" in -> growth, held
        marks.length = 0;
        callback(mutation(5, { added: 1, removed: 1, size: 70, addedText: 'Hello', removedText: 'Hel' })); await settle();
        assert.deepEqual(marks, [true], 'replace-while-appending (removed text is the start of the added text): growth');
        const heldAt = widgetCalls;
        // a longer replacement with other text is not growth
        callback(mutation(5, { added: 1, removed: 1, size: 90, addedText: 'Goodbye now', removedText: 'Hello' })); await settle();
        assert.equal(marks.at(-1), false, 'a longer replacement with other text: unmarked');
        assert.ok(widgetCalls > heldAt, 'and out at once (it also flushes the held growth)');
        const afterReplace = widgetCalls;
        // one observer delivery: growth in one record and an independent removal in another
        const mixed = [...mutation(5, { size: 100, addedText: 'more' }), ...mutation(5, { added: 0, removed: 1, size: 100, removedText: 'gone' })];
        callback(mixed); await settle();
        assert.equal(marks.at(-1), false, 'growth + an independent removal in one delivery: unmarked');
        assert.ok(widgetCalls > afterReplace, 'out at once');
        // one delivery of two growth records is still growth
        callback(mutation(5, { size: 110, addedText: 'a' })); await settle();
        callback([...mutation(5, { size: 120, addedText: 'b' }), ...mutation(5, { size: 130, addedText: 'c' })]); await settle();
        assert.equal(marks.at(-1), true, 'two growth records in one delivery: growth');
        marks.length = 0;
        const beforeChanged = widgetCalls;
        callback(mutation(5, { size: 140 }));   // growth queued ...
        streaming = 6;                          // ... but the streaming message is another one when the render runs
        await settle();
        assert.deepEqual(marks, [false], 'a changed streaming message at render time: unmarked');
        assert.ok(widgetCalls > beforeChanged, 'and out at once');
        streaming = null;
    } finally {
        off(); adapter.stop();
        globalThis.MutationObserver = saved.observer;
        globalThis.document = saved.document;
    }
});
