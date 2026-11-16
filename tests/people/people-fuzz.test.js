// Seeded fuzz over the whole people path (P3, was participant-fuzz): 20 seeds x 30 steps of reply, native change, new swipe, swipe back, last delete, middle delete,
// reload and rebuild on the live Story Block host with NPC State Delta's real adapter (people sync over a fake runtime). After every step, with NO publication to
// heal it, the cache equals the store's slice, the slice equals the oracle's rebuild and the Delta queries answer the store's people (helpers/proofs.js).
// The failure message names the seed and step. Set PEOPLE_FUZZ_STATS=1 to print each seed's tally.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, record } from './helpers/people-rig.js';
import { proveHead } from './helpers/proofs.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => 101 + i * 37);
const STEPS = 30;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function random(seed) {
    let a = seed >>> 0;
    const next = () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    return { next, int: n => Math.floor(next() * n), pick: list => list[Math.floor(next() * list.length)] };
}

// One change of Delta's state: a moved number, now and then a new person, a candidate, an edge, a dismissal.
function change(r, step) {
    return state => {
        state.turn = step + 1;
        if (state.npcs.length) state.npcs[r.int(state.npcs.length)].seenCount = r.int(10);
        if (r.int(4) === 0 && state.npcs.length < 6) state.npcs.push(record(`f${String(step).padStart(2, "0")}`, { seenCount: r.int(4) }));
        if (r.int(3) === 0) state.candidates = r.int(2) ? [{ name: `Wren ${step}` }] : [];
        if (r.int(3) === 0) if (state.npcs.length > 1) state.socialGraph = { edges: [{ a: state.npcs[0].id, b: state.npcs[1].id, kind: `k${r.int(3)}` }] };
        if (r.int(5) === 0) state.dismissed = [`d${step}`];
    };
}

async function run(t, seed) {
    const r = random(seed);
    let rig = await peopleRig(t);
    await rig.reply('Opening.', change(r, 0));
    const tally = { reply: 0, change: 0, swipe: 0, back: 0, last: 0, middle: 0, reload: 0, rebuild: 0 };
    for (let step = 1; step <= STEPS; step++) {
        const chat = rig.host.ctx.chat;
        const last = chat[chat.length - 1];
        const can = { swipe: last && !last.is_user, back: last?.swipes?.length > 1, delete: chat.length > 3 };
        const action = r.pick(['reply', 'reply', 'change', 'change', 'swipe', 'back', 'last', 'middle', 'reload', 'rebuild']);
        let name = action;
        if (action === 'reply') await rig.host.send(`Turn ${step}.`, `Reply ${step}.`);
        else if (action === 'change') { /* published below */ }
        else if (action === 'swipe' && can.swipe) await rig.host.swipe(`Swipe ${step}.`);
        else if (action === 'back' && can.back) { const id = (last.swipe_id + 1) % last.swipes.length; await rig.host.st.swipeTo(chat.length - 1, id); }
        else if (action === 'last' && can.delete) await rig.host.st.deleteMessage(chat.length - 1);
        else if (action === 'middle' && can.delete) await rig.host.st.deleteMessage(1 + r.int(chat.length - 2));
        else if (action === 'reload') rig = await rig.reload();
        else if (action === 'rebuild') rig.host.store.rebuild();
        else name = 'change';
        tally[name] += 1;
        if (['reply', 'change'].includes(name)) await rig.publish(change(r, step));
        await proveHead(rig, `seed ${seed} step ${step} (${name})`);
    }
    return { rig, tally, skips: rig.host.store.problems?.() ?? [], told: rig.host.turn.problems?.() ?? [] };
}

for (const seed of SEEDS) {
    test(`people fuzz: seed ${seed}, ${STEPS} steps`, async t => {
        const { rig, tally, skips, told } = await run(t, seed);
        const sends = rig.sends.reduce((all, code) => ({ ...all, [code]: (all[code] ?? 0) + 1 }), {});
        if (process.env.PEOPLE_FUZZ_STATS === '1') console.log(`people fuzz seed ${seed}: ${JSON.stringify(tally)} sends ${JSON.stringify(sends)}`);
        // The reader sees no Problem: no warning, nothing the turn met, and only Inspector skips (replayed blocks that no longer fit) after a middle delete.
        assert.deepEqual(told, [], `seed ${seed}: the turn met no problem ${JSON.stringify(told)}`);
        for (const item of skips) assert.ok(tally.middle > 0, `seed ${seed}: a skip without a middle delete: ${item.code} ${item.message}`);
        assert.deepEqual(rig.warnings, [], `seed ${seed}: no warning reached the reader`);
        assert.equal(Object.keys(sends).every(code => code === 'ok' || code === 'STALE'), true, `seed ${seed}: sends ${JSON.stringify(sends)}`);
    });
}
