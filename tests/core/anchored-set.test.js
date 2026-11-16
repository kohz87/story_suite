// Replay rule (h), the anchored set (ctx.anchored, SPEC §2.2): a count set to a value that depends on the one before it keeps `was`, `period`
// and `roll`, so a replay after an earlier edit or delete lands it where a fresh telling would. A day is 100 here. Each test fails without the rule. The host tests
// edit, delete, swipe and rewind a TOLD reply (never the greeting) and compare with a second host that was told the edited chat from the start.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rebaseOps } from '../../core/ops.js';
import { anchoredMove, anchoredValue, isAnchored } from '../../core/ops/anchored.js';
import { createHost } from '../../packages/story-block/testkit/index.js';

const PATH = '/domains/clock/minutes';
const op = (value, was, roll = 'same', extra = {}) => ({ op: 'replace', path: PATH, value, was, period: 100, roll, ...extra });
const state = minutes => ({ domains: { clock: { minutes } } });
const rebase = (minutes, ...ops) => rebaseOps(state(minutes), ops).ops;

// `! tick N` moves the clock; `~ tick N` is today's N (never earlier; `to` is the face before the clamp); `+ skip N` is N on the next day.
const clockModule = () => ({
    id: 'clock',
    name: 'Clock',
    domains: { clock: { initial: () => ({ minutes: 0 }), counters: ['minutes'] } },
    capture: {
        kinds: { tick: { grammar: '! tick <n> moves it; ~ tick <n> is today\'s n' }, skip: { grammar: '+ skip <n> is n tomorrow' } },
        apply(ctx, line) {
            const clock = ctx.draft('clock');
            const n = Number(line.name);
            const day = Math.floor(clock.minutes / 100) * 100;
            if (line.kind === 'skip') { ctx.anchored('clock', '/minutes', { period: 100, roll: 'after' }); clock.minutes = day + 100 + n; }
            else if (line.op === '~') { ctx.anchored('clock', '/minutes', { period: 100, roll: 'same', to: day + n }); clock.minutes = Math.max(clock.minutes, day + n); }
            else clock.minutes += n;
            return { summary: `Clock ${clock.minutes}.`, narrate: false };
        },
    },
});
const reply = lines => `Story.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const clockOf = host => host.head().domains.clock.minutes;
const TOLD = [['! tick 20'], ['~ tick 50'], ['+ skip 30']];

// A host told `replies` (lists of change lines), one per turn.
async function told(t, replies = TOLD) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [clockModule()] });
    t.after(() => host.close());
    for (const lines of replies) await host.send('Go.', reply(lines));
    return host;
}
const edit = async (host, at, lines) => {
    host.ctx.chat[at].mes = reply(lines);
    host.ctx.chat[at].swipes[host.ctx.chat[at].swipe_id] = host.ctx.chat[at].mes;
    assert.equal((await host.sdk.reread(at)).ok, true);
};
// The first TOLD reply: the first reply after the first user message (index 0 is the greeting).
const firstReply = host => host.ctx.chat.findIndex((message, at) => at > host.ctx.chat.findIndex(m => m.is_user) && message.is_user === false);
const reloaded = async (t, host) => {
    const copy = await createHost({ modules: [clockModule()], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => copy.close());
    return clockOf(copy);
};
// The host equals a fresh telling of `replies`, after a rebuild and a reload.
async function same(t, host, replies) {
    const fresh = await told(t, replies);
    assert.equal(clockOf(host), clockOf(fresh));
    assert.equal(await reloaded(t, host), clockOf(fresh), 'reload');
    host.store.rebuild();
    assert.equal(clockOf(host), clockOf(fresh), 'rebuild');
    return clockOf(fresh);
}

test('anchored value: as stored when now == was; a whole-day shift; same clamps; a clamped face keeps its target; after rolls on', () => {
    assert.equal(anchoredValue(op(150, 120, 'same'), 120), 150);
    assert.equal(anchoredValue(op(150, 120), 220), 250, 'a day on: a day later');
    assert.equal(anchoredValue(op(150, 120), 20), 50, 'a day back');
    assert.equal(anchoredValue(op(150, 120), 160), 160, 'same never lands below now');
    assert.equal(anchoredValue(op(250, 120, 'after'), 180), 250);
    assert.equal(anchoredValue(op(250, 120, 'after'), 290), 350, 'not after now: one more period');
    const clamped = op(80, 80, 'same', { to: 50 });
    assert.equal(anchoredValue(clamped, 80), 80);
    assert.equal(anchoredValue(clamped, 20), 50, 'the face again, not the clamp');
    assert.equal(anchoredValue(clamped, 180), 180, 'a day on, still below now: now');
    assert.equal(anchoredValue(clamped, 230), 250, 'two days on');
    assert.equal(anchoredMove(clamped, 220).to, 250, 'the target moves with the op');
    assert.equal(isAnchored(op(1, 0)), true);
    assert.equal(isAnchored({ ...op(1, 0), roll: 'later' }), false);
    assert.equal(isAnchored({ ...op(1, 0), period: 0 }), false);
    assert.equal(isAnchored({ ...op(1, 0), to: 1.5 }), false);
});

test('rebaseOps: an anchored set stands as stored on the value it was made on, follows another one, and an op without the mark is unchanged', () => {
    const stored = op(150, 120);
    assert.equal(rebase(120, stored)[0], stored, 'now == was: the op itself');
    assert.deepEqual(rebase(220, stored)[0], op(250, 220));
    const plain = { op: 'replace', path: PATH, value: 150, was: 120 };
    assert.deepEqual(rebase(220, plain)[0], { ...plain, value: 250, was: 220 }, 'unmarked: the counter rule, as before');
    const noRoll = { ...stored, roll: undefined };
    assert.equal(rebase(120, noRoll)[0], noRoll);
    assert.equal(rebase(undefined, stored)[0], stored, 'nothing there (its domain is gone): as stored, not a move');
    assert.deepEqual(rebase(20, op(80, 80, 'same', { to: 50 }))[0], op(50, 20, 'same', { to: 50 }), 'a clamped face lands on its face');
});

test('the mark is stored as written when the clock stood where it did (`to` only when the clamp moved it), and the op replays to the same', async t => {
    const host = await told(t);
    const ops = host.store.opsAt(host.ctx.chat.length - 1).filter(o => o.path === PATH);
    assert.deepEqual(ops, [op(130, 50, 'after')]);
    assert.deepEqual(host.store.opsAt(host.ctx.chat.length - 3).filter(o => o.path === PATH), [op(50, 20, 'same')], 'unclamped: no `to`');
    assert.equal(clockOf(host), 130);
    host.store.rebuild();
    assert.equal(clockOf(host), 130);
    const clamped = await told(t, [['! tick 80'], ['~ tick 50']]);
    assert.deepEqual(clamped.store.opsAt(clamped.ctx.chat.length - 1).filter(o => o.path === PATH), [op(80, 80, 'same', { to: 50 })], 'clamped: the face is kept');
});

test('firstReply is a told reply, not the greeting', async t => {
    const host = await told(t);
    assert.equal(host.ctx.chat[firstReply(host)].mes.includes('! tick 20'), true);
});

test('an edited Re-read of the first told reply that grows the clock: later sets follow it like a fresh telling; reload == live', async t => {
    const host = await told(t);
    await edit(host, firstReply(host), ['! tick 120']);
    assert.equal(await same(t, host, [['! tick 120'], TOLD[1], TOLD[2]]), 230);
});

test('an edited Re-read that shrinks or sits mid-day: same clamps to now, after keeps the next day', async t => {
    const host = await told(t);
    await edit(host, firstReply(host), ['! tick 60']);
    assert.equal(await same(t, host, [['! tick 60'], TOLD[1], TOLD[2]]), 130);
    await edit(host, firstReply(host), ['! tick 5']);
    assert.equal(await same(t, host, [['! tick 5'], TOLD[1], TOLD[2]]), 130);
});

test('a clamped face (the clock stood past it): an edited Re-read, a middle delete and a swipe back land where a fresh telling does; the unclamped case too', async t => {
    const told2 = [['! tick 80'], ['~ tick 50']];
    const edited = await told(t, told2);
    await edit(edited, firstReply(edited), ['! tick 20']);
    assert.equal(await same(t, edited, [['! tick 20'], ['~ tick 50']]), 50, 'the clamp is gone: the face');
    const deleted = await told(t, told2);
    const at = firstReply(deleted);
    await deleted.st.deleteMessage(at);
    await deleted.st.deleteMessage(at - 1);
    assert.deepEqual(deleted.store.problems(), []);
    assert.equal(await same(t, deleted, [['~ tick 50']]), 50);
    const grown = await told(t, [['! tick 20'], ['~ tick 50']]);
    await edit(grown, firstReply(grown), ['! tick 80']);
    assert.equal(await same(t, grown, told2), 80, 'unclamped to clamped');
    const back = await told(t, told2);
    await back.swipe(['! tick 20']);
    await back.st.swipeTo(firstReply(back) + 2, 0);
    await back.st.swipeTo(firstReply(back) + 2, 0);
    assert.equal(await same(t, back, told2), 80);
});

test('a middle delete of the first told reply, a delete of the second, a swipe of the last reply and a swipe back give what a fresh telling gives', async t => {
    const host = await told(t);
    const at = firstReply(host);
    await host.st.deleteMessage(at);
    await host.st.deleteMessage(at - 1);
    assert.deepEqual(host.store.problems(), []);
    assert.equal(await same(t, host, [TOLD[1], TOLD[2]]), 130, 'the face on a fresh day, then tomorrow 30');
    const second = await told(t);
    const last = second.ctx.chat.length - 1;
    await second.st.deleteMessage(last - 2);
    await second.st.deleteMessage(last - 3);
    assert.equal(await same(t, second, [TOLD[0], TOLD[2]]), 130);
    const swiped = await told(t);
    await swiped.swipe(reply(['+ skip 40']).replace(/^Story.\n\n<Changes>\n|\n<\/Changes>$/g, '').split('\n'));
    assert.equal(await same(t, swiped, [TOLD[0], TOLD[1], ['+ skip 40']]), 140);
    await swiped.st.swipeTo(swiped.ctx.chat.length - 1, 0);
    assert.equal(await same(t, swiped, TOLD), 130, 'swiped back');
});

test('rewind: deleting the last replies leaves what a fresh telling of the rest gives', async t => {
    const host = await told(t);
    for (let i = 0; i < 2; i++) { await host.st.deleteMessage(host.ctx.chat.length - 1); await host.st.deleteMessage(host.ctx.chat.length - 1); }
    assert.equal(await same(t, host, [TOLD[0]]), 20);
});

test('two anchored ops on one path in one reply, then an edited Re-read of an earlier reply: each starts from the one before it', async t => {
    const pair = ['+ skip 60', '~ tick 50'];
    const host = await told(t, [['! tick 20'], pair, ['! tick 10']]);
    assert.deepEqual(host.store.opsAt(host.ctx.chat.length - 3).filter(o => o.path === PATH).map(o => [o.roll, o.was, o.value]), [['after', 20, 160], ['same', 160, 160]]);
    await edit(host, firstReply(host), ['! tick 120']);
    assert.equal(await same(t, host, [['! tick 120'], pair, ['! tick 10']]), 270, 'grown: 120, tomorrow 260, the face is below it, +10');
    await edit(host, firstReply(host), ['! tick 90']);
    assert.equal(await same(t, host, [['! tick 90'], pair, ['! tick 10']]), 170, 'shrunk: 90, tomorrow 160, +10');
    await edit(host, firstReply(host) + 2, ['+ skip 5', '~ tick 70']);
    assert.equal(await same(t, host, [['! tick 90'], ['+ skip 5', '~ tick 70'], ['! tick 10']]), 180);
});

test('ctx.anchored is the domain owner\'s, needs a period and a roll, and does not mix with ctx.absolute', async t => {
    t.mock.method(console, 'warn', () => {});
    const other = { id: 'other', domains: { other: { initial: () => ({}) } }, commands: {
        'other.poke': ctx => { ctx.anchored('clock', '/minutes', { period: 100, roll: 'same' }); return {}; },
        'other.bad': ctx => { ctx.anchored('other', '/x', { period: 0, roll: 'same' }); return {}; },
        'other.roll': ctx => { ctx.anchored('other', '/x', { period: 5, roll: 'before' }); return {}; },
        'other.both': ctx => { ctx.absolute('other', '/x'); ctx.anchored('other', '/x', { period: 5, roll: 'same' }); return {}; },
    } };
    const host = await createHost({ modules: [clockModule(), other] });
    t.after(() => host.close());
    await host.send('Hello.', 'Start.');
    for (const [name, code] of [['poke', 'NOT_OWNER'], ['bad', 'INVALID'], ['roll', 'INVALID'], ['both', 'CONFLICT']]) {
        assert.equal((await host.sdk.command(`other.${name}`, {})).code, code, name);
    }
});
