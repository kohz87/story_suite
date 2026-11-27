// QA: the seeded fuzz of sealed history (core/store/write/seal.js) on the real host (testkit createHost: real store, bus, turn, Story Block's
// core module and the probe module), with a small window (6 replies, step 3) and checkpoints every 4 replies. Each run mixes sends, swipes,
// middle deletes inside the window, edits and deletes of the last reply, and tries a seal after every step. Checked:
// - a seal changes nothing: the head is the same object's equal before and after;
// - replay == live: a cold store over a JSON copy of the chat and its metadata (a reload) reads the live head;
// - sealed == never sealed: a cold store over the "mirror" (the chat with each sealed record put back as it last was before its seal, and no
//   base) reads the live head too, so replay from the base is the replay of the whole history;
// - the run seals at least twice; at the end, a sealed reply deleted keeps the head, and a reload agrees.
// QA_SEAL_SEED=n runs one seed; QA_SEAL_STEPS=n changes the length.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createStore } from '../../../core/store.js';
import { createCommandBus } from '../../../core/commands.js';
import { readRecord } from '../../../core/persist.js';
import { prng, seedCrypto } from './helpers/seeded.js';
import { probeModule } from './helpers/probe-module.js';
import { replyText } from './helpers/state-fuzz-gen.js';
import { createModule } from '../../../modules/director/module.js';
import { withD1 } from '../../helpers/director/d1.js';
import { installBluewatch } from '../../fixtures/director/bluewatch.js';
import { directorLines } from '../../director/qa/helpers/reread-host.js';

const SEEDS = process.env.QA_SEAL_SEED ? [Number(process.env.QA_SEAL_SEED)] : [5, 23, 404];
const STEPS = Number(process.env.QA_SEAL_STEPS) || 60;
const plain = value => (value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)));

// A store over `chat` and `metadata` as a reload sets it up (the bus attaches the owners' replay guards first).
function cold(host, chat, metadata) {
    const registry = host.registry;
    const validate = (state, names) => names.flatMap(name => {
        const fn = registry.validator(name);
        const errors = typeof fn === 'function' ? fn(state?.domains?.[name], state) : [];
        return Array.isArray(errors) ? errors.map(String) : [];
    });
    const fresh = createStore({ chat: () => chat, metadata: () => metadata, save: () => {}, validate, scratch: name => registry.scratch(name), seed: name => registry.deferredInitial(name), holders: name => registry.holders(name) });
    createCommandBus({ store: fresh, registry, settings: id => host.sdk.settings(id) });
    fresh.ensureInitial(registry.initialState());
    return fresh;
}

const guardedSeals = { count: 0, runs: 0 };
const STORE = { sealing: { window: 6, step: 3 }, checkpointEvery: 4 };
// The host: Story Block's core and the probe module, or with Story Director and the Bluewatch pack too (its clock, quests and trips give
// guarded blocks and proof to seal).
async function makeHost(director) {
    if (!director) return createHost({ modules: [probeModule({ cues: true })], storeOptions: STORE });
    let host = null;
    const module = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
    host = await createHost({ modules: [probeModule(), module], storeOptions: STORE, settings: { features: { 'story-block.gear': true, 'story-director.pulse': false } } });
    await installBluewatch(host.packs.packs);
    return host;
}
const textOf = (r, step, director) => {
    const text = replyText(r, step);
    if (!director || !r.chance(0.6)) return text;
    const extra = Array.from({ length: r.int(1, 3) }, () => r.pick(directorLines(r))).join('\n');
    return text.includes('</Changes>') ? text.replace('</Changes>', `${extra}\n</Changes>`) : `${text}\n<Changes>\n${extra}\n</Changes>`;
};

async function run(t, seed, { director = false } = {}) {
    const restore = seedCrypto(seed);
    t.after(restore);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    t.mock.method(console, 'warn', () => {});
    const r = prng(seed);
    const host = await makeHost(director);
    t.after(() => host.close());
    const { st, ctx, store } = host;
    const unsealed = new Map();      // sid → the record as it last was before its seal
    let seals = 0;

    const remember = () => {
        for (const message of ctx.chat) {
            const record = readRecord(message);
            if (record && record.v === 2) unsealed.set(record.sid, plain(record));
        }
    };
    const mirror = () => {
        const chat = plain(ctx.chat);
        for (const message of chat) {
            const record = message?.extra?.storySuite;
            if (record?.sealed !== 1) continue;
            assert.ok(unsealed.has(record.sid), `the mirror knows sealed reply ${record.sid}`);
            message.extra.storySuite = structuredClone(unsealed.get(record.sid));
            const info = message.swipe_info?.[message.swipe_id ?? 0];
            if (info?.extra?.storySuite) info.extra.storySuite = structuredClone(unsealed.get(record.sid));
        }
        const metadata = plain(ctx.chatMetadata ?? {});
        if (metadata.storySuite) { delete metadata.storySuite.base; delete metadata.storySuite.sealed; }
        return { chat, metadata };
    };
    const check = label => {
        const live = plain(store.head())?.domains;
        assert.deepEqual(plain(cold(host, plain(ctx.chat), plain(ctx.chatMetadata ?? {})).head()?.domains), live, `${label}: a reload reads the live head`);
        const { chat, metadata } = mirror();
        assert.deepEqual(plain(cold(host, chat, metadata).head()?.domains), live, `${label}: the never-sealed mirror reads the live head`);
    };

    for (let step = 0; step < STEPS; step++) {
        const history = store.history();
        const from = history.status === 'none' ? 1 : history.from;
        const roll = r.int(0, 19);
        let label = `seed ${seed} step ${step}`;
        if (roll < 14 || ctx.chat.length < 4) {
            label += ' send';
            await host.send(`Message of step ${step}.`, textOf(r, step, director));
        } else if (roll < 15 && !ctx.chat.at(-1).is_user) {
            label += ' swipe';
            await host.swipe(textOf(r, step, director));
        } else if (roll < 17 && ctx.chat.length - 2 > from) {
            const at = r.int(from, ctx.chat.length - 2);
            label += ` delete ${at} (window from ${from})`;
            await st.deleteMessage(at);
        } else if (roll < 18) {
            const at = ctx.chat.length - 1;
            label += ` edit ${at}`;
            if (!ctx.chat[at].is_user) await st.editMessage(at, `${ctx.chat[at].mes}\n(edited)`);
        } else if (ctx.chat.length - 1 > from) {
            label += ' delete last';
            await st.deleteMessage(ctx.chat.length - 1);
        }
        t.mock.timers.tick(400);
        remember();
        const head = plain(store.head());
        const out = store.seal();
        assert.notEqual(out.refused, true, `${label}: the seal was refused (${out.why})`);
        if (out.ok && out.sealed) seals++;
        if (process.env.QA_SEAL_TRACE) console.log(label, JSON.stringify(out), ctx.chat.length);
        assert.deepEqual(plain(store.head()), head, `${label}: the seal changed the head`);
        check(label);
    }
    assert.ok(seals >= 2, `seed ${seed}: the run sealed at least twice (${seals})`);
    if (director && ctx.chatMetadata.storySuite.base.guarded === true) guardedSeals.count++;
    // A sealed reply deleted keeps the head; the reload agrees.
    const sealedAt = ctx.chat.findIndex(message => message?.extra?.storySuite?.sealed === 1 && !message.is_user);
    const head = plain(store.head());
    await st.deleteMessage(sealedAt);
    assert.deepEqual(plain(store.head()), head, `seed ${seed}: deleting sealed reply ${sealedAt} keeps the head`);
    assert.deepEqual(plain(cold(host, plain(ctx.chat), plain(ctx.chatMetadata ?? {})).head()), head, `seed ${seed}: a reload after it agrees`);
    assert.ok(st.notices.some(notice => /older than the last 6 replies, so its changes stay/.test(notice.reason)), `seed ${seed}: the reader was told`);
}

for (const seed of SEEDS) {
    test(`seal fuzz seed ${seed}: a seal changes nothing, reload and the never-sealed mirror read the live head`, async t => { await run(t, seed); });
    test(`seal fuzz seed ${seed} with Story Director: the same, with guarded blocks and proof sealed`, async t => { await run(t, seed, { director: true }); guardedSeals.runs++; });
}
test('the Story Director runs sealed guarded blocks', t => {
    if (process.env.QA_SEAL_SEED || guardedSeals.runs < SEEDS.length) return t.skip('only some seeds ran');
    assert.ok(guardedSeals.count > 0, 'no run sealed a guarded block');
});
