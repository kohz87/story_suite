// A rig for the people domain across both packages (no flag; the domain is the store's own): the live Story Block testkit host (packages/story-block),
// NPC State Delta's real adapter with its participant and its people sync, over a fake Delta runtime that holds the chat's state.
// `reload()` starts everything again over what was saved. Tests only; nothing here ships.
import { createHost } from '../../../testkit/index.js';
import { memoryVault } from '../../../modules/people/legacy/storysuite-participant/index.js';
import { createStorySuiteV2Adapter } from '../../../modules/people/storysuite-v2.js';
import { peopleView, peopleState } from '../../../modules/people/view.js';
import { hashJson } from '../../../modules/people/legacy/storysuite-participant/hash.js';

// Ids are Delta's own (`npc_` + a name slug, as makeNpcId makes them): the people domain takes them as they are.
export const idOf = key => `npc_${key}`;
export const record = (key, extra = {}) => ({ id: idOf(key), name: String(key).toUpperCase(), aliases: [], archived: false, present: true, lifeState: 'alive', trust: 3, ...extra });
export const clone = value => JSON.parse(JSON.stringify(value));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// A new chat starts with nobody: the store is empty and the cache hydrates empty (the first publication below adds Mira and Tom, as a first reply's scan would).
const freshState = () => ({ npcs: [], candidates: [], socialGraph: { edges: [] }, checkpoints: [], lineage: [], turn: 1 });

/**
 * peopleRig(t, { state?, vault?, image?, live?, wrapSdk?, sends?, started? }) → { host, adapter, live, vault, warnings, sends, expected(), settle(), publish(edit), reply(text, edit), reload() }
 *   live: the fake Delta runtime's chat state ({ chatKey, state }); sends: the `people.write` answers the host gave (code or 'ok').
 *   settle(): waits until the head's people equal the view of live state (true) or the wait ran out (false).
 */
export async function peopleRig(t, { state = freshState(), vault = memoryVault(), image = null, live = null, wrapSdk = sdk => sdk, sends = [], started = true } = {}) {
    t.mock.method(console, 'warn', () => {});
    const mine = live ?? { chatKey: 'chat:avatar.png:one', state: structuredClone(state) };
    const host = await createHost();
    t.after(() => host.close());
    const listeners = new Set();
    const rescans = [];      // every time the cache told the runtime to read the latest reply again
    const marks = [];        // every scan marker the cache took from the store: [index, since]
    const hydrations = [];   // every hydrate the cache took from the store
    const warnings = [];
    const base = wrapSdk(host.sdk);
    const sdk = { ...base, command: async (name, ...rest) => { const out = await base.command(name, ...rest); if (name === 'people.write') sends.push(out.ok ? 'ok' : out.code); return out; } };
    const box = { ready: Promise.resolve(sdk), sdk };
    const api = {
        gate: null, isEnabled: () => true, relationshipBaseline: () => ({}), relationshipCaps: () => ({ ordinary: 2, meaningful: 3, major: 5, extreme: 8 }), chatKey: () => mine.chatKey,
        getNpc: id => mine.state.npcs.find(item => item.id === id) ?? null,
        getState: () => structuredClone(mine.state),
        timelineStarted: () => Boolean(mine.state.timeline?.lineage),
        installState: async next => { mine.state = structuredClone(next); },
        // The one timeline: the cache's people are replaced by the store's slice (every other key stays), as the runtime's hydratePeople does.
        hydratePeople: keys => { mine.state = { ...mine.state, ...clone(keys), pendingBackfills: [], readAhead: [], assistantSinceScan: 0 }; hydrations.push(clone(keys)); return true; },
        writeTimeline: async block => { mine.state = { ...mine.state, timeline: structuredClone(block) }; },
        onNativeChange: fn => { listeners.add(fn); return () => listeners.delete(fn); },
        rescanLatest: () => { rescans.push(1); return true; },
        // The store's scan marker set on the cache, and one person's record set in place (as the runtime's setScanMarker / setPeopleRecord do).
        setScanMarker: (index, since) => { marks.push([index, since]); mine.state.lastScannedMessageId = index; if (Number.isInteger(since)) mine.state.assistantSinceScan = since; mine.state.pendingBackfills = []; mine.state.readAhead = []; return true; },
        setPeopleRecord: record => { const at = mine.state.npcs.findIndex(item => item.id === record.id); if (at < 0) return false; mine.state.npcs[at] = clone(record); return true; },
        scanActive: () => false, scanIdle: async () => true, useMessageGate: gate => { api.gate = gate; }, stateReady: () => true, requestHeaders: () => ({}),
    };
    const doc = { documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } };
    const adapter = createStorySuiteV2Adapter({
        suiteApi: { npcs: () => mine.state.npcs.map(({ id, name, aliases, present, archived }) => ({ id, name, aliases, present, archived })) },
        delta: () => api, version: 'test', host: () => box, headReply: () => host.store.headIndex(),
        doc,
        timers: { setTimeout: (fn, ms) => { const id = setTimeout(fn, ms); id.unref?.(); return id; }, clearTimeout, setInterval: () => ({ unref() {} }), clearInterval() {} },
        logger: { warn: (...args) => warnings.push(args.join(' ')) }, loadEmptyCast: async () => null,
        participantVault: vault, participantOptions: { debounceMs: 1, retryMs: 5 },
    });
    adapter.start();
    if (await adapter.settled() !== true) throw new Error(`the adapter did not register: ${warnings.join(' / ')}`);
    t.after(() => adapter.stop());
    // A reload: the saved chat is opened once Delta has registered, as on the page (the modules are there before the chat opens).
    if (image) { host.ctx.chatMetadata = clone(image.metadata); await host.st.loadChat(image.chat); }
    const disk = { image: { chat: clone(host.ctx.chat), metadata: clone(host.ctx.chatMetadata) } };
    const original = host.ctx.saveChat;
    host.ctx.saveChat = async (...args) => { const out = await original.apply(host.ctx, args); disk.image = { chat: clone(host.ctx.chat), metadata: clone(host.ctx.chatMetadata) }; return out; };
    const expected = () => peopleView(mine.state);
    // The head's slice as NPC State reads it: an absent slice (nobody written yet) reads as the empty view.
    const stored = () => { const slice = host.head().domains.people ?? { v: 1, order: [], npcs: {} }; const keys = peopleState(slice); return keys ? peopleView(keys) : null; };
    const out = {
        host, adapter, doc, live: mine, vault, warnings, sends, hydrations, rescans, marks, expected, stored,
        async settle(ms = 3000) {
            const until = Date.now() + ms;
            for (;;) {
                const head = stored();
                if (head !== null && hashJson(head) === hashJson(expected())) { await sleep(5); return true; }
                if (Date.now() >= until) return false;
                await sleep(5);
            }
        },
        /** Delta saves a change to its state and announces it, as index.js does; resolves once the head's people carry it. */
        async publish(edit, ms) {
            if (!mine.state.npcs.length) mine.state.npcs.push(record('mira', { aliases: ['The Weaver'] }), record('tom'));
            edit(mine.state); for (const fn of [...listeners]) fn({ key: mine.chatKey }); return out.settle(ms);
        },
        /** One reply in the story, then Delta's change for it (a native change at that reply). */
        async reply(text, edit) { await host.send(text, `${text} reply.`); return out.publish(edit ?? (() => {})); },
        // A real reload loses NPC State's memory (no sidecar): the cache starts empty and is hydrated from the store.
        reload() { return peopleRig(t, { vault, image: clone(disk.image), live: { chatKey: mine.chatKey, state: freshState() }, wrapSdk, sends, started }); },
    };
    return out;
}
