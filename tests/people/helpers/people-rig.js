// A rig for the people domain across both packages, flag `suite.peopleInStore` on: the live Story Block testkit host (packages/story-block, not the
// vendored copy), NPC State Delta's real adapter with its participant and its people mirror, over a fake Delta runtime that holds the chat's state.
// `reload()` starts everything again over what was saved. Tests only; nothing here ships.
import { createHost } from '../../../packages/story-block/testkit/index.js';
import { memoryVault } from '../../../packages/npc-state-delta/src/storysuite-participant/index.js';
import { createStorySuiteV2Adapter } from '../../../packages/npc-state-delta/src/storysuite-v2.js';
import { peopleView } from '../../../packages/npc-state-delta/src/people/view.js';
import { hashJson } from '../../../packages/npc-state-delta/src/storysuite-participant/hash.js';

// Ids are Delta's own (`npc_` + a name slug, as makeNpcId makes them): the people domain takes them as they are.
export const idOf = key => `npc_${key}`;
export const record = (key, extra = {}) => ({ id: idOf(key), name: String(key).toUpperCase(), aliases: [], archived: false, present: true, lifeState: 'alive', trust: 3, ...extra });
export const clone = value => JSON.parse(JSON.stringify(value));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const freshState = () => ({ npcs: [record('mira', { aliases: ['The Weaver'] }), record('tom')], candidates: [], socialGraph: { edges: [] }, checkpoints: [], lineage: [], turn: 1 });

/**
 * peopleRig(t, { state?, vault?, image?, live?, wrapSdk?, sends?, started? }) → { host, adapter, live, vault, warnings, sends, expected(), settle(), publish(edit), reply(text, edit), reload() }
 *   live: the fake Delta runtime's chat state ({ chatKey, state }); sends: the `people.mirror` answers the host gave (code or 'ok').
 *   settle(): waits until the head's people equal the view of live state (true) or the wait ran out (false).
 */
export async function peopleRig(t, { state = freshState(), vault = memoryVault(), image = null, live = null, wrapSdk = sdk => sdk, sends = [], started = true } = {}) {
    t.mock.method(console, 'warn', () => {});
    const mine = live ?? { chatKey: 'chat:avatar.png:one', state: structuredClone(state) };
    const host = await createHost({ settings: { flags: { 'suite.peopleInStore': true } } });
    t.after(() => host.close());
    const listeners = new Set();
    const warnings = [];
    const base = wrapSdk(host.sdk);
    const sdk = { ...base, command: async (name, ...rest) => { const out = await base.command(name, ...rest); if (name === 'people.mirror') sends.push(out.ok ? 'ok' : out.code); return out; } };
    const box = { ready: Promise.resolve(sdk), sdk };
    const api = {
        gate: null, isEnabled: () => true, relationshipBaseline: () => ({}), chatKey: () => mine.chatKey,
        getNpc: id => mine.state.npcs.find(item => item.id === id) ?? null,
        getState: () => structuredClone(mine.state),
        timelineStarted: () => Boolean(mine.state.timeline?.lineage),
        installState: async next => { mine.state = structuredClone(next); },
        writeTimeline: async block => { mine.state = { ...mine.state, timeline: structuredClone(block) }; },
        onNativeChange: fn => { listeners.add(fn); return () => listeners.delete(fn); },
        scanActive: () => false, scanIdle: async () => true, useMessageGate: gate => { api.gate = gate; }, stateReady: () => true, requestHeaders: () => ({}),
    };
    const adapter = createStorySuiteV2Adapter({
        suiteApi: { npcs: () => mine.state.npcs.map(({ id, name, aliases, present, archived }) => ({ id, name, aliases, present, archived })) },
        delta: () => api, version: 'test', host: () => box, headReply: () => host.store.headIndex(),
        doc: { documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } },
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
    const out = {
        host, adapter, live: mine, vault, warnings, sends, expected,
        async settle(ms = 3000) {
            const until = Date.now() + ms;
            for (;;) {
                const head = host.head().domains.people;
                if (head !== undefined && hashJson(head) === hashJson(expected())) { await sleep(5); return true; }
                if (Date.now() >= until) return false;
                await sleep(5);
            }
        },
        /** Delta saves a change to its state and announces it, as index.js does; resolves once the head's people carry it. */
        async publish(edit, ms) {
            // The participant mints its line when the first save point is asked for (the way NSD's history-replay-host test starts it); `started: false` leaves it off.
            if (started && !mine.state.timeline?.lineage) await host.sdk.timeline.make({ kind: 'manual', name: 'Start' });
            edit(mine.state); for (const fn of [...listeners]) fn({ key: mine.chatKey }); return out.settle(ms);
        },
        /** One reply in the story, then Delta's change for it (a native change at that reply). */
        async reply(text, edit) { await host.send(text, `${text} reply.`); return out.publish(edit ?? (() => {})); },
        reload() { return peopleRig(t, { vault, image: clone(disk.image), live: mine, wrapSdk, sends, started }); },
    };
    return out;
}
