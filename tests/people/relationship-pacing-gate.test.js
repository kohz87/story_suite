import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../../modules/people/storysuite-v2.js';
import { validateNpcSlice } from '../../modules/people/meters/npc-meters.js';
import { readEvent } from '../../modules/people/meters/npc-meters-pacing.js';
import { FEATURE_GATE } from '../../modules/people/meters/npc-meters-config.js';
import { gateApproach, readApproachRing } from '../../modules/people/meters/npc-meters-gate.js';
import { dossiers, suite, major, newestFlatDay } from './helpers/pacing-suite.js';
import { fuzzLine, fuzzSeeds, gateOf, gateOn, lowTrust, praise, prng, record, shape, tailOf, world, worldModule } from './relationship-pacing.helpers.js';

// ---- fuzz: middle deletes over several days; replay equals rebuild ----

for (const seed of fuzzSeeds(process.env.FUZZ_SEEDS, [3, 11, 29])) {
    test(`pacing fuzz seed ${seed}: tiers, notes kinds, via gate, look stamp and mood/pull tick over several story days, middle deletes and swipes; the slice validates and replay equals rebuild`, async t => {
        t.mock.method(console, 'warn', () => {});
        // FUZZ_OFF=mood-pull,anti-lever,notes switches those features off for a run (to look past a failure of one).
        const s = await suite({ modules: [worldModule], lines: seed % 2 === 1, features: process.env.FUZZ_OFF ? Object.fromEntries(process.env.FUZZ_OFF.split(',').map(id => [`npc-state-delta.${id}`, false])) : null });
        const r = prng(seed);
        await s.say(['~ npc Oren | trust: +1', '~ npc Sister Temiwa | trust: +1']);   // the set-up reply makes both entries and is never deleted
        const setup = s.host.store.headIndex();
        let day = 1;
        for (let step = 0; step < (Number(process.env.FUZZ_STEPS) || 16); step += 1) {
            if (r.chance(0.4)) { day += r.int(1, 2); await s.setDay(day); }
            // The world (party, open threads, a place): inst, pull and track are written by the tick, so they get middle deletes too.
            if (r.chance(0.5)) await world(s, { party: r.chance(0.7) ? [{ id: 'a', name: r.pick(['Oren', 'Sister Temiwa']) }] : [], threads: r.chance(0.6) ? [{ id: `th_${'abcdefgh'.slice(0, 7)}${r.int(0, 3)}`, key: r.pick(['The stolen letter', 'Old debt']), status: 'active', fields: { people: r.pick(['Oren', 'Sister Temiwa', 'Oren, Sister Temiwa']) } }] : [] });
            const lines = Array.from({ length: r.int(1, 3) }, () => fuzzLine(r, r.pick(['Oren', 'Sister Temiwa'])));
            const index = await s.say(lines);
            // The look stamp / flag (feature notes): first look set, or a refused contradiction; replayed with the reply.
            if (r.chance(0.2)) await s.adapter.flag(r.chance(0.5) ? { name: 'Oren', lock: true, reply: s.host.store.headIndex(), cue: 'Oren\'s look is fixed: grey hair.' } : { name: 'Oren', drift: { before: 'grey hair', incoming: 'red hair' }, reply: s.host.store.headIndex() });
            if (r.chance(0.15)) await s.host.sdk.command('npc.tick', {});   // from outside: refused (the step is Delta's own); must change nothing
            if (r.chance(0.2)) await s.swipe(lines);
            if (step > 3 && r.chance(0.35)) {
                assert.equal((await s.host.sdk.reread(s.host.store.headIndex())).ok, true);
    let again = JSON.stringify(s.host.head());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head()), again, 'after a Re-read: replay equals live');
    await s.host.st.loadChat(s.host.ctx.chat);
    await s.adapter.ticked();
    assert.equal(JSON.stringify(s.host.head()), again, 'a cold reload equals live');
    const replies = s.host.ctx.chat.map((message, at) => (!message.is_user && at > setup && at < s.host.store.headIndex() ? at : -1)).filter(at => at >= 0);
                if (replies.length) {
                    const gone = r.pick(replies);
                    await s.host.st.deleteMessage(gone);
                    await s.host.st.deleteMessage(gone - 1);
                }
            }
            const label = `seed ${seed} step ${step} (reply ${index})`;
            assert.deepEqual(s.host.store.problems(), [], `${label}: nothing was skipped`);
            const head = JSON.stringify(s.host.head());
            assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), [], `${label}: the slice validates`);
            s.host.store.rebuild();
            assert.equal(JSON.stringify(s.host.head()), head, `${label}: replay equals rebuild`);
            for (const record of Object.values(s.host.head().domains.people.bonds.npcs)) {
                if (!record.impactDay) continue;
                const { ordinary, meaningful, major, extreme } = newestFlatDay(record.impactDay);
                assert.ok(major <= 1 && meaningful <= 1 && extreme <= 1 && ordinary <= 3, `${label}: counts stay within the allowance: ${JSON.stringify(record.impactDay)}`);
            }
        }
    });
}

// ---- the anti-lever gate (npc-meters-gate.js; feature npc-state-delta.anti-lever, off by default) ----


test('gate: the same approach to the same person gives less, the third time backfires (tension up, trust down), with the receipt words and the cue', async () => {
    const s = await suite({ allowance: null, features: gateOn });
    await s.setDay(1);
    await s.say([praise()]);
    assert.equal(s.npc('Oren').meters.affection, 3, 'the first approach gives what it asked');
    assert.equal(gateOf(s), 'via praise');
    await s.say([praise()]);
    assert.equal(s.npc('Oren').meters.affection, 4, 'the second gives half (3 → 1)');
    assert.equal(gateOf(s), 'via praise · 2nd in 1 day · less');
    await s.say([praise()]);
    assert.deepEqual(s.npc('Oren').meters, { trust: -1, affection: 4, desire: 0, tension: 1 }, 'the third: no affection, tension +1, trust −1');
    assert.equal(gateOf(s), 'via praise · 3rd in 1 day · backfired');
    assert.ok(tailOf(s).optional.includes('Oren has noticed the repeated praise; it backfires.'), JSON.stringify(tailOf(s)));
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
});

test('gate: another approach, another person and a day outside the window are not repeats', async () => {
    const s = await suite({ allowance: null, features: gateOn });
    await s.setDay(1);
    await s.say([praise(), praise('Sister Temiwa'), praise('Oren', 3, 'gift')]);
    assert.equal(s.npc('Oren').meters.affection, 6, 'a gift after praise is its own approach');
    assert.equal(s.npc('Sister Temiwa').meters.affection, 3);
    await s.setDay(4);
    await s.say([praise()]);
    assert.equal(s.npc('Oren').meters.affection, 9, 'day 1 is 3 days back: outside the window of 3 days (4, 3, 2)');
    assert.equal(gateOf(s), 'via praise');
});

test('gate: praise or a gift from low trust reads as pressure (tension instead of affection); help does not', async () => {
    const s = await suite({ allowance: null, features: gateOn, records: lowTrust() });
    await s.setDay(1);
    await s.say([praise()]);
    assert.deepEqual(s.npc('Oren').meters, { trust: -50, affection: 0, desire: 0, tension: 3 });
    assert.equal(gateOf(s), 'via praise · suspicion');
    await s.say([praise('Oren', 3, 'help')]);
    assert.equal(s.npc('Oren').meters.affection, 3, 'help from low trust is help');
    assert.ok(tailOf(s).optional.every(line => !/pressure/.test(line)), 'the cue is only for the reply that fired it');
});

test('gate: settings: strength strong backfires the second time; a one-day window makes the next day a first', async () => {
    const strong = await suite({ allowance: null, features: gateOn, settings: { gateStrength: 'strong' } });
    await strong.setDay(1);
    await strong.say([praise()]);
    await strong.say([praise()]);
    assert.equal(gateOf(strong), 'via praise · 2nd in 1 day · backfired');
    const short = await suite({ allowance: null, features: gateOn, settings: { gateDays: 1 } });
    await short.setDay(1);
    await short.say([praise()]);
    await short.setDay(2);
    await short.say([praise()]);
    assert.equal(short.npc('Oren').meters.affection, 6);
    assert.equal(gateOf(short), 'via praise');
});

test('gate: only the story\'s own lines are gated: a scan\'s change passes through and writes no ring; no clock, no gate', async () => {
    const scan = gateApproach({ source: 'scan', via: 'praise', day: 1, reply: 'sw_a', name: 'Oren', trust: 0, delta: { affection: 3 }, ring: [{ d: 1, r: 'sw_b', v: 'praise' }, { d: 1, r: 'sw_c', v: 'praise' }], settings: {} });
    assert.equal(scan.mode, 'none');
    assert.deepEqual(scan.delta, { affection: 3 });
    assert.equal(scan.ring.length, 2, 'the ring is as it was');
    const s = await suite({ allowance: null, features: gateOn, clock: false });
    await s.say([praise(), praise(), praise()]);
    assert.equal(s.npc('Oren').meters.affection, 9, 'no day: no gate, every line lands in full');
    assert.equal(record(s).via, undefined, 'no story day: no ring');
    assert.equal(s.npc('Oren').meters.tension, 0);
});

test('gate: feature off and old lines: byte-identical state, no ring, and the static line is unchanged', async () => {
    const lines = [['~ npc Oren | affection: +2 | impact: meaningful'], ['~ npc Oren | trust: +1']];
    const off = await suite({ allowance: null, features: { [FEATURE_GATE]: false } });
    const on = await suite({ allowance: null, features: gateOn });
    for (const s of [off, on]) { await s.setDay(1); for (const set of lines) await s.say(set); }
    const bare = x => JSON.stringify(x.host.head().domains.people?.bonds).replace(/sw_[a-z0-9]+/g, 'sw');
    assert.equal(bare(on), bare(off), 'lines without via: the feature on changes nothing');
    assert.equal(record(on).via, undefined);
    const withVia = await suite({ allowance: null, features: { [FEATURE_GATE]: false } });
    await withVia.setDay(1);
    await withVia.say([praise(), praise(), praise()]);
    assert.equal(record(withVia).via, undefined, 'off: no ring');
    assert.equal(withVia.npc('Oren').meters.affection, 9, 'off: the label gives nothing, every line lands in full (as before)');
    const text = s => s.host.registry.module(MODULE_ID).context.static();
    assert.doesNotMatch(text(off), /via:/);
    assert.match(text(on), /Add \| via: praise, gift, help, flirt, threat, shared-danger/);
    assert.equal(text(on).replace(/ Add \| via:[^.]*\./, ''), text(off), 'the only difference is the one gated sentence');
});

test('gate: replay equals live: rebuild, a swipe, a Re-read, a middle delete and a cold reload; the stored shapes validate', async () => {
    const s = await suite({ allowance: null, features: gateOn });
    await s.setDay(1);
    await s.say([praise()]);
    const middle = await s.say([praise()]);
    await s.say([praise()]);
    await s.swipe([praise()]);
    await s.setDay(2);
    const index = await s.say([praise()]);
    assert.equal((await s.host.sdk.reread(index)).ok, true);
    let live = shape(s);
    s.host.store.rebuild();
    assert.equal(shape(s), live, 'rebuild equals live');
    await s.host.st.loadChat(s.host.ctx.chat);
    await s.adapter.ticked();
    assert.equal(shape(s), live, 'a cold reload equals live');
    assert.ok(readApproachRing(record(s).via), 'the ring is stored whole as one text leaf');
    await s.host.st.deleteMessage(middle);
    await s.host.st.deleteMessage(middle - 1);
    live = shape(s);
    s.host.store.rebuild();
    assert.equal(shape(s), live, 'rebuild equals live after the delete');
    assert.deepEqual(s.host.store.problems(), []);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
});

test('gate: the swipe and the Re-read count a reply once (a repeat is another reply, never the same one again)', async () => {
    const s = await suite({ allowance: null, features: gateOn });
    await s.setDay(1);
    const first = await s.say([praise()]);
    await s.host.sdk.reread(first);
    await s.host.sdk.reread(first);
    assert.equal(s.npc('Oren').meters.affection, 3, 're-reading the same reply is still its first approach');
    assert.equal(JSON.parse(record(s).via).length, 1);
    await s.swipe([praise()]);
    assert.equal(s.npc('Oren').meters.affection, 3, 'a swipe replaces the reply\'s approach');
});

test('gate: stored shapes: a bad ring, a bad kind or a gate without its approach is refused', () => {
    const slice = via => ({ npcs: { npc_mira: { name: 'Mira', meters: { trust: 0, affection: 0, desire: 0, tension: 0 }, stages: {}, unlocked: [], ...via } }, problems: [] });
    assert.deepEqual(validateNpcSlice(slice({ via: JSON.stringify([{ d: 1, r: 'sw_a', v: 'praise' }]) })), []);
    assert.ok(validateNpcSlice(slice({ via: 'not json' })).length);
    assert.ok(validateNpcSlice(slice({ via: JSON.stringify([{ d: 1, r: 'sw_a', v: 'bribe' }]) })).length);
    const event = extra => JSON.stringify({ at: 1, date: '', events: [{ src: 'story', ask: { affection: 3 }, tier: 'major', held: false, note: '', ...extra }] });
    assert.ok(readEvent(event({ via: 'praise', gate: { mode: 'back', n: 3, span: 2 } })));
    assert.equal(readEvent(event({ gate: { mode: 'back', n: 3, span: 2 } })), null, 'a gate needs its approach');
    assert.equal(readEvent(event({ via: 'praise', gate: { mode: 'sulk', n: 3, span: 2 } })), null);
    assert.equal(readEvent(event({ via: 'flattery' })), null);
});
