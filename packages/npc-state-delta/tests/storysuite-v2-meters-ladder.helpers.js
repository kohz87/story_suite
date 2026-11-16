import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHost } from '../../story-block/testkit/index.js';
import { MODULE_ID, createStorySuiteV2Adapter } from '../src/storysuite-v2.js';
import { seedPeople } from './helpers/seed-people.js';
import { secretId } from '../src/npc-meters.js';
import { projectDossierState } from '../dossier-ui.js';
import { lastRelationshipChangeHtml, recentChangeRowHtml } from '../dossier-ui-relationship.js';

// TRS ideas 1-4 on the NPC meters (stage ladders with several needs and milestones, per-NPC ceilings
// and floors, fuller custom meters with presets and drift, locked-note teasers), against Story
// Block's whole host from its testkit (the live packages/story-block testkit): real capture, real
// turns and the host's 'turn' event that carries Delta's per-reply step. Delta's runtime is a fake.

export const SECRET = 'She was the lost heir of House Venn.';
export const LADDER = [
    { name: 'Friend', needs: 'trust 20' },
    { name: 'Confidant', needs: 'trust 60, affection 40', milestone: 'saved her brother' },
];

export function dossiers() {
    return {
        npc_mira: {
            id: 'npc_mira', name: 'Mira', aliases: ['The Smith'], present: true, archived: false,
            relationship: { trust: 10, affection: 0, desire: 0, tension: 0 },
            secrets: [{ id: secretId('trust', 30, SECRET), meter: 'trust', at: 30, text: SECRET, title: 'Her past' }],
        },
        npc_oren: { id: 'npc_oren', name: 'Oren', aliases: [], present: true, archived: false, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } },
    };
}

/**
 * A whole Story Block host with Delta's adapter registered on it. `features`: { id: bool }, the
 * reader's choices in Story Block's Features; `modules`: more module definitions.
 */
export async function suite({ settings = {}, records = dossiers(), features = null, modules = [], doc = null, wrap = false, packs = [], apiExtra = {} } = {}) {
    // The reader's feature choices live in extension_settings.storySuite.features (Story Block's
    // Features), installed packs in extension_settings.storySuite.packs.
    const installed = packs.map(pack => ({ id: pack.id, version: pack.version, enabled: true, source: 'file', origin: `${pack.id}.json`, pack: structuredClone(pack) }));
    const host = await createHost({ settings: { modules: { [MODULE_ID]: structuredClone(settings) }, ...(features ? { features: { ...features } } : {}), ...(installed.length ? { packs: installed } : {}) }, modules });
    // `wrap`: an sdk copy a test may add to (the host's own is frozen).
    const sdk = wrap ? Object.assign(Object.create(Object.getPrototypeOf(host.sdk)), host.sdk) : host.sdk;
    const box = { ready: Promise.resolve(sdk), sdk };
    const delta = { records, enabled: true };
    const api = {
        isEnabled: () => delta.enabled,
        getNpc: id => (delta.records[id] ? structuredClone(delta.records[id]) : null),
        relationshipBaseline: () => ({ trust: 0, affection: 0, desire: 0, tension: 0 }),
        presentCastHtml: () => '<section class="cast">cast</section>',
        castEmptyReason: () => ({ text: 'Nobody here.' }),
        fillPresentCast: () => {},
        ...apiExtra,
    };
    const warnings = [];
    const adapter = createStorySuiteV2Adapter({
        suiteApi: { npcs: () => Object.values(delta.records).map(({ id, name, aliases, present, archived }) => ({ id, name, aliases, present, archived })) },
        delta: () => api, version: 'test', host: () => box,
        headReply: () => host.store.headIndex(),
        doc: doc ?? { documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } },
        timers: { setTimeout: () => 0, clearTimeout() {}, setInterval: () => ({ unref() {} }), clearInterval() {} },
        logger: { warn: (...args) => warnings.push(args.join(' ')) }, loadEmptyCast: async () => null,
    });
    adapter.start();
    assert.equal(await adapter.settled(), true, 'the adapter registers');
    await seedPeople(host.sdk, host.store, delta.records);   // the dossiers are the store's people (npc.cast lists them)
    const block = lines => (lines.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : '');
    /** One reply with these change lines; waits for Delta's per-reply step. → the reply's index. */
    const say = async (lines = [], text = 'The story goes on.') => {
        await host.send('And then?', `${text}${block(lines)}`);
        await adapter.ticked();
        return host.store.headIndex();
    };
    const swipe = async (lines = []) => { await host.swipe(`Another way.${block(lines)}`); await adapter.ticked(); };
    const regenerate = async (lines = []) => { await host.regenerate(`Again.${block(lines)}`); await adapter.ticked(); };
    const npc = name => host.sdk.query('npc.meters', { name });
    const receipts = () => host.store.receipts().map(item => item.receipt);
    const setSettings = next => { host.ctx.extensionSettings.storySuite.modules[MODULE_ID] = structuredClone(next); };
    const def = host.registry.module(MODULE_ID);
    const view = () => ({ state: host.head(), chat: { length: host.ctx.chat.length } });
    return { host, sdk, adapter, delta, warnings, say, swipe, regenerate, npc, receipts, setSettings, def, view };
}

export const lastReceipt = (s, type) => s.receipts().filter(receipt => receipt.type === type).at(-1);

// A tiny deterministic generator (no Math.random): mulberry32.
export function prng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), chance: p => next() < p, pick: list => list[Math.floor(next() * list.length)] };
}

// FUZZ_SEEDS="1-200" (or "5,17") runs those seeds (default 5, 17, 41); FUZZ_STEPS the steps (default 18).
export const fuzzSeeds = (spec, fallback) => (spec ? spec.split(',').flatMap(part => { const [a, b] = part.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; }) : fallback);

// A small DOM for the settings section (createElement, appendChild, replaceChildren, click).
export function fakeDom() {
    class Node {
        constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.className = ''; this.textContent = ''; this.listeners = {}; this.parentNode = null; this.attributes = {}; }
        appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
        replaceChildren(...nodes) { this.children = []; for (const node of nodes) this.appendChild(node); }
        before(node) { const parent = this.parentNode; if (!parent) return; const at = parent.children.indexOf(this); node.parentNode = parent; parent.children.splice(at, 0, node); }
        remove() { const parent = this.parentNode; if (parent) parent.children = parent.children.filter(child => child !== this); this.parentNode = null; }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
        click() { for (const fn of this.listeners.click ?? []) fn({ target: this }); }
        querySelector() { return null; }
        get isConnected() { return true; }
        get style() { return this._style ??= {}; }
    }
    return { createElement: tag => new Node(tag), documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } };
}

export const DATING_PACK = {
    id: 'sweet-days', version: '1.0.0', requires: { storyBlock: '^2' }, name: 'Sweet Days',
    content: {
        meterPresets: [{
            id: 'sweetheart', title: 'Sweetheart',
            meters: [
                { id: 'regard', name: 'Regard', min: -100, max: 100, start: 0, describe: 'How much they think of you after a date: kindness and attention raise it, standing them up lowers it.',
                    bands: [{ at: -100, word: 'cold' }, { at: -20, word: 'unsure' }, { at: 20, word: 'fond' }, { at: 60, word: 'smitten' }] },
                { id: 'nerves', name: 'Nerves', min: 0, max: 100, start: 50, drift: { toward: 50, perDay: 5 } },
            ],
            stages: [
                { id: 'crush', name: 'Crush', needs: [{ meter: 'regard', at: 20 }] },
                { id: 'sweetheart', name: 'Sweetheart', needs: [{ meter: 'regard', at: 60 }, { meter: 'nerves', at: 30 }], milestone: 'They hold your hand on the way home.' },
            ],
        }],
    },
};

export const STORED = { impact: 'ordinary', delta: { trust: 1, affection: 0, desire: 0, tension: 0 }, reason: 'Old sidecar reason.', message: 1 };
export function cardOf(s, record = s.delta.records.npc_mira) {
    const npc = { ...structuredClone(record), lastRelationshipChange: structuredClone(STORED) };
    const state = { npcs: [npc], meterViews: s.adapter.dossierMeters([npc]), reply: s.host.store.headIndex() };
    const shown = projectDossierState(state, { chatKey: 'c1' }).npcs[0].lastRelationshipChange;
    return { shown, html: lastRelationshipChangeHtml(shown), npc };
}

export const CLOCK = {
    id: 'zz-clock', name: 'Clock',
    domains: { director: { initial: () => ({ time: { minutes: 0 } }) } },
    commands: { 'zz.clock': (ctx, { minutes }) => { ctx.draft('director').time.minutes = minutes; return { summary: 'time passes' }; } },
    queries: { 'director.time': state => ({ minutes: state?.domains?.director?.time?.minutes ?? null }) },
};
export const TIERS = { ordinary: 1, meaningful: 2, major: 5, extreme: 10 };
/** A hosted chat with Delta's tier caps and a per-day allowance (and a clock): the day's events are paced. */
export const pacedSuite = async (allowance, extra = {}) => {
    const s = await suite({ modules: [CLOCK], apiExtra: { relationshipCaps: () => ({ ...TIERS }), relationshipAllowance: () => ({ ...allowance }) }, ...extra });
    await s.host.sdk.command('zz.clock', { minutes: 12 * 1440 });
    return s;
};
export const LOOSE = { ordinary: 99, meaningful: 99, major: 99, extreme: 99 };
export const SHUT = { ordinary: 0, meaningful: 0, major: 0, extreme: 0 };
export const eventOf = (s, who = 'Mira') => JSON.parse(s.host.head().domains.people.bonds.npcs[`npc_${who.toLowerCase()}`].lastEvent);

export const OWNER_LINES = ['~ npc Sieke | tension: +2 | trust: +1 | impact: ordinary', '~ npc Sister Temiwa | trust: +1 | impact: ordinary'];
export const SIEKE_TRUST = 'Astra paid the fifty copper registration fee in silver coin without arguing.';
export const SIEKE_TENSION = 'Her bodice button snapped while lunging for the coins, exposing her bare breasts in front of Astra before she threw contracts at him in mortification.';
export const TEMIWA_TRUST = 'Astra greeted her politely and asked about the village\'s shortage of hands before registering.';
// The one-pass block's rows as the owner's reply sent them (relationship fields; no relationshipChangeReason, which the one-pass rules do not ask for).
export const OWNER_ROWS = [
    { id: 'npc_sieke', relationshipImpact: 'ordinary', relationshipDelta: { trust: 1, affection: 0, desire: 0, tension: 2 }, relationshipEvidence: { trust: SIEKE_TRUST, affection: '', desire: '', tension: SIEKE_TENSION } },
    { id: 'npc_sister-temiwa', relationshipImpact: 'ordinary', relationshipDelta: { trust: 1, affection: 0, desire: 0, tension: 0 }, relationshipEvidence: { trust: TEMIWA_TRUST, affection: '', desire: '', tension: '' } },
];
export const ownerRecords = () => {
    const blank = { trust: 0, affection: 0, desire: 0, tension: 0 };
    return {
        npc_sieke: { id: 'npc_sieke', name: 'Sieke', aliases: [], present: true, archived: false, relationship: { ...blank } },
        'npc_sister-temiwa': { id: 'npc_sister-temiwa', name: 'Sister Temiwa', aliases: [], present: true, archived: false, relationship: { ...blank } },
    };
};
// runtime-hosted.js and runtime-scan-helpers.js with their siblings copied beside them (as the hosted forward test above); only the
// SillyTavern-bound parts are stubs. → { relationshipChanges, forward(before, after, reply, rows, onePass) → the adjusts sent }.
export async function hostedForwardParts() {
    const sent = [];
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'delta-onepass-why-'));
    const root = fileURLToPath(new URL('..', import.meta.url));
    try {
        fs.cpSync(root, temp, { recursive: true, filter: from => !/[\\/](tests|docs|scripts|\.git|node_modules|dist)([\\/]|$)/.test(path.relative(root, from)) });
        fs.writeFileSync(path.join(temp, 'runtime-scan-helpers.js'), [
            "import { normalizeName, normalizeRelationshipBaseline, npcMatchesLabel } from './core.js'; import { rejectedOverallLook } from './appearance-update.js'; import { physicalTraitSwaps } from './appearance-physical.js'; import { moodNumbers } from './npc-mood.js';",
            'export const chatContext = () => ({ chat: [] }); export const markStands = () => true; export const replayScope = () => null; export const scopedAdapter = a => a; ' + fs.readFileSync(path.join(root, 'runtime-scan-helpers-parts', 'value-rules.js'), 'utf8').split('\n').find(line => line.startsWith('export const worth')),
            fs.readFileSync(path.join(root, 'runtime-scan-helpers-parts', 'scan-results.js'), 'utf8').split('// What a committed scan tells the slice')[1],
        ].map((part, index) => (index === 2 ? '//' + part : part)).join('\n'));
        fs.writeFileSync(path.join(temp, 'runtime-settings.js'), 'export const getSettings = () => ({}); export const setRpgProbe = () => {};');
        const { relationshipChanges, refusedLooks } = await import(pathToFileURL(path.join(temp, 'runtime-scan-helpers.js')).href);
        const { createHostedPart } = await import(pathToFileURL(path.join(temp, 'runtime-hosted.js')).href);
        const rt = { storySuiteV2: { hosted: () => true, adjust: change => { sent.push(change); return Promise.resolve({ ok: true }); } } };
        const part = createHostedPart(rt, { chatHydrationStatus: () => 'ready', getChatKey: () => 'c1', getChatState: () => ({ npcs: [] }), latestMessageId: () => 1, latestReplyIndex: () => 1 });
        const forward = async (before, after, reply, rows, onePass) => {
            sent.length = 0;
            const prior = globalThis.document;
            globalThis.document = { documentElement: { dataset: { npcStateDeltaStoryBlockV2: '1' } }, getElementById: () => null };   // hosted
            try {
                part.forwardRelationshipChangesToHost(before, after, reply, null, [], rows, onePass);
                for (let n = 0; n < 5; n += 1) await new Promise(resolve => setImmediate(resolve));
            } finally { globalThis.document = prior; }
            return sent.map(({ guard, ...change }) => change);
        };
        return { relationshipChanges, refusedLooks, forward };
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
}
let forwardParts = null;
// What the scan forwards for that reply: the sidecar kept its numbers (a one-pass delta without relationshipChangeReason is dropped), so only the evidence goes.
export const ownerForward = async (s, reply, rows = OWNER_ROWS) => {
    forwardParts ??= await hostedForwardParts();
    const after = Object.values(s.delta.records);
    return forwardParts.relationshipChanges(new Map(after.map(npc => [npc.id, npc])), after, { trust: 0, affection: 0, desire: 0, tension: 0 }, reply, rows);
};
export const rowOf = (s, id) => {
    const npc = { ...structuredClone(s.delta.records[id]), lastRelationshipChange: structuredClone(STORED) };
    const shown = projectDossierState({ npcs: [npc], meterViews: s.adapter.dossierMeters([npc]), reply: s.host.store.headIndex() }, { chatKey: 'c1' }).npcs[0].lastRelationshipChange;
    return { shown, html: recentChangeRowHtml({ change: shown }) };
};
