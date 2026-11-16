import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAPTURE_PREFIX, createRegistry } from '../../../core/registry.js';
import { createPeoplePart } from '../../story-block/src/v2/domains/people/part.js';
import { createStore } from '../../../core/store.js';
import { createCommandBus } from '../../../core/commands.js';
import { parseChanges } from '../../../core/capture.js';
import { MODULE_ID, createStorySuiteV2Adapter } from '../src/storysuite-v2.js';
import { secretId } from '../src/npc-meters.js';
import { seedPeople } from './helpers/seed-people.js';

export const SECRET = 'She is the lost heir of House Venn.';
export const SECRET_TWO = 'She keeps a second ledger under the anvil.';

export function dossiers() {
    return {
        npc_mira: {
            id: 'npc_mira', name: 'Mira', aliases: ['The Smith'], present: true, archived: false,
            relationship: { trust: 10, affection: 0, desire: 0, tension: 0 },
            secrets: [
                { id: secretId('trust', 30, SECRET), meter: 'trust', at: 30, text: SECRET },
                { id: secretId('tension', -20, SECRET_TWO), meter: 'tension', at: -20, text: SECRET_TWO },
            ],
        },
        npc_oren: { id: 'npc_oren', name: 'Oren', aliases: [], present: false, archived: false, relationship: { trust: -5, affection: 2, desire: 0, tension: 1 } },
    };
}

export function fakeDelta() {
    const delta = {
        enabled: true,
        baseline: { trust: 0, affection: 0, desire: 0, tension: 0 },
        records: dossiers(),
    };
    delta.suiteApi = { npcs: () => Object.values(delta.records).map(({ id, name, aliases, present, archived }) => ({ id, name, aliases, present, archived })) };
    delta.api = {
        isEnabled: () => delta.enabled,
        getNpc: id => (delta.records[id] ? structuredClone(delta.records[id]) : null),
        relationshipBaseline: () => ({ ...delta.baseline }),
        presentCastHtml: () => '<section class="npc-state-delta-present-roster">cast</section>',
        castEmptyReason: () => ({ text: 'Nobody here.' }),
        fillPresentCast: () => {},
        formPortraits: () => ({}),
    };
    return delta;
}

export const fakeDoc = () => ({
    documentElement: { dataset: {} },
    getElementById: () => null,
    addEventListener() {},
    dispatchEvent() { return true; },
});

export const timers = {
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => ({ unref() {} }), clearInterval() {},
};

export async function host({ settings = {}, delta = fakeDelta(), headReply = () => null } = {}) {
    const chat = [{ is_user: false, name: 'Narrator', mes: 'The forge is warm.', swipe_id: 0, swipes: ['The forge is warm.'], swipe_info: [{ extra: {} }], extra: {} }];
    chat[0].swipe_info[0].extra = chat[0].extra;
    const registry = createRegistry();
    // The host's people domain (Story Block's core part): NPC State keeps its meters in its `bonds`.
    registry.register({ id: 'story-block', name: 'Story Block', ...createPeoplePart() });
    const store = createStore({ chat: () => chat, save: async () => {}, seed: name => registry.deferredInitial(name) });
    const moduleSettings = { [MODULE_ID]: structuredClone(settings) };
    const settingsOf = id => ({ ...(registry.module(id)?.settings?.defaults ?? {}), ...structuredClone(moduleSettings[id] ?? {}) });
    const bus = createCommandBus({ store, registry, settings: settingsOf });
    const runQuery = (name, args, state = store.head()) => {
        const fn = registry.query(name);
        if (!fn) throw new Error(`no query ${name}`);
        const tools = { query: (other, more) => runQuery(other, more, state), receipts: () => [] };
        return structuredClone(fn(state, args === undefined ? undefined : structuredClone(args), tools));
    };
    const sent = [];
    const sdk = {
        apiVersion: 2,
        registerModule(def) {
            registry.register(def);
            store.ensureInitial(registry.initialState());
        },
        command: async (type, payload, options = {}) => {
            sent.push({ type, payload: structuredClone(payload), options });
            return bus.command(type, payload, { cause: 'ui' });
        },
        query: (name, args) => runQuery(name, args),
        settings: id => settingsOf(id),
    };
    const box = { host: { ready: Promise.resolve(sdk), sdk } };
    const warnings = [];
    const adapter = createStorySuiteV2Adapter({
        suiteApi: delta.suiteApi, delta: () => delta.api, version: 'test', host: () => box.host, headReply,
        doc: fakeDoc(), timers, logger: { warn: (...args) => warnings.push(args) }, loadEmptyCast: async () => null,
    });
    adapter.start();
    assert.equal(await adapter.settled(), true, 'the adapter registers with the host');
    await seedPeople(sdk, store, delta.records);   // the dossiers are the store's people (npc.cast lists them)
    sent.length = 0;   // (the seed's people.write is the fixture's, not a send under test)
    const def = registry.module(MODULE_ID);
    const problems = [];

    function capture(index, block) {
        const parsed = parseChanges(block);
        const out = [];
        for (const line of parsed.lines) {
            const entry = registry.capture(line.kind);
            if (!entry) { problems.push({ line: line.raw, code: 'UNKNOWN_KIND' }); continue; }
            const result = bus.run(`${CAPTURE_PREFIX}${entry.kind}`, { ...line, kind: entry.kind, word: line.kind }, {
                cause: 'story', capture: entry, carrier: { index, swipe: chat[index].swipe_id ?? 0, sid: store.carrierSid(index) },
            });
            if (result.ok) store.append({ ops: result.ops, receipt: result.receipt });
            else problems.push({ line: line.raw, code: result.code, message: result.message });
            out.push(result);
        }
        return out;
    }
    function reply(text, block = '') {
        chat.push({ is_user: true, name: 'Ari', mes: 'And then?', extra: {} });
        const message = { is_user: false, name: 'Narrator', mes: text, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} };
        message.swipe_info[0].extra = message.extra;
        chat.push(message);
        const index = chat.length - 1;
        return { index, results: capture(index, block) };
    }
    function swipe(index, block = '') {
        const message = chat[index];
        const next = message.swipe_info.length;
        message.swipe_info.push({ extra: {} });
        message.swipes.push(`swipe ${next}`);
        message.swipe_id = next;
        message.extra = message.swipe_info[next].extra;
        store.rebuild();
        return capture(index, block);
    }
    function swipeTo(index, at) {
        const message = chat[index];
        message.swipe_id = at;
        message.extra = message.swipe_info[at].extra;
        store.rebuild();
    }
    function remove(index) {
        chat.splice(index, 1);
        store.rebuild();
    }
    const npc = name => runQuery('npc.meters', { name });
    const view = () => ({ state: store.head(), query: runQuery, settings: settingsOf, chat: { length: chat.length, lastUser: '' } });
    const setSettings = next => { moduleSettings[MODULE_ID] = structuredClone(next); };
    return { chat, registry, store, bus, sdk, sent, box, adapter, def, delta, warnings, problems, capture, reply, swipe, swipeTo, remove, npc, view, runQuery, setSettings };
}

export const STAGES = [
    { meter: 'trust', at: 20, name: 'Friend' },
    { meter: 'trust', at: 60, name: 'Confidant' },
    { meter: 'trust', at: -30, name: 'Wary' },
];

export const plain = lines => lines.filter(line => typeof line === 'string');
export const noCue = lines => lines.filter(line => !/^Whenever anything changed, write the <Changes> block/.test(line));

export const EVENT = 'The duke is exposed as a traitor';
export const EVENT_SECRET = 'She has known about the duke all along.';
export const HIDDEN = (text, first = false) => `${first ? 'Lines marked (hidden) are secrets: never state or reveal them; let them shape how that person acts.\n' : ''}Mira (hidden): ${text}`;
export const KNOWN = text => `Mira, known to the player now; may come out: ${text}`;
export const eventNote = () => ({ title: 'The duke', when: EVENT, text: EVENT_SECRET });

export const ERSVEIL = JSON.parse(fs.readFileSync(new URL('./fixtures/ersveil-cast.json', import.meta.url), 'utf8'));
export const handedOver = raw => raw.map(note => {
    const meter = note.meter ?? '';
    let hash = 0x811c9dc5;
    for (const char of `${meter || 'story'}|${meter ? note.at : 0}|${note.title ?? ''}|${note.when ?? ''}|${note.text}`) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return { id: `sec_${hash.toString(36).padStart(8, '0').slice(-8)}`, ...note, from: 'pack' };
});
