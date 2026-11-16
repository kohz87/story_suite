// Replay rule (h), the anchored set (ctx.anchored, SPEC §2.2): a count set to a value that depends on the one before it keeps `was`, `period`
// and `roll`, so a replay after an earlier edit or delete lands it where a fresh telling would. A day is 100 here. Each test fails without the rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rebaseOps } from '../../src/v2/ops.js';
import { anchoredValue, isAnchored } from '../../src/v2/ops/anchored.js';
import { createHost } from '../../testkit/index.js';

const PATH = '/domains/clock/minutes';
const op = (value, was, roll = 'same', extra = {}) => ({ op: 'replace', path: PATH, value, was, period: 100, roll, ...extra });
const state = minutes => ({ domains: { clock: { minutes } } });
const rebase = (minutes, ...ops) => rebaseOps(state(minutes), ops).ops;

// `! tick N` moves the clock; `~ tick N` is today's N (never earlier); `+ skip N` is N on the next day.
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
            else if (line.op === '~') { ctx.anchored('clock', '/minutes', { period: 100, roll: 'same' }); clock.minutes = Math.max(clock.minutes, day + n); }
            else clock.minutes += n;
            return { summary: `Clock ${clock.minutes}.`, narrate: false };
        },
    },
});
const reply = lines => `Story.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const clockOf = host => host.head().domains.clock.minutes;
const TOLD = [['! tick 20'], ['~ tick 50'], ['+ skip 30']];

async function told(t, first = TOLD[0]) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [clockModule()] });
    t.after(() => host.close());
    await host.send('Go.', reply(first));
    await host.send('Go.', reply(TOLD[1]));
    await host.send('Go.', reply(TOLD[2]));
    return host;
}
const edit = async (host, at, lines) => {
    host.ctx.chat[at].mes = reply(lines);
    host.ctx.chat[at].swipes[host.ctx.chat[at].swipe_id] = host.ctx.chat[at].mes;
    assert.equal((await host.sdk.reread(at)).ok, true);
};
const firstReply = host => host.ctx.chat.findIndex(message => message.is_user === false);
const reloaded = async (t, host) => {
    const copy = await createHost({ modules: [clockModule()], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => copy.close());
    return clockOf(copy);
};

test('anchored value: as stored when now == was; a whole-day shift; same clamps; after rolls on', () => {
    assert.equal(anchoredValue(op(150, 120, 'same'), 120), 150);
    assert.equal(anchoredValue(op(150, 120), 220), 250, 'a day on: a day later');
    assert.equal(anchoredValue(op(150, 120), 20), 50, 'a day back');
    assert.equal(anchoredValue(op(150, 120), 160), 160, 'same never lands below now');
    assert.equal(anchoredValue(op(250, 120, 'after'), 180), 250);
    assert.equal(anchoredValue(op(250, 120, 'after'), 290), 350, 'not after now: one more period');
    assert.equal(isAnchored(op(1, 0)), true);
    assert.equal(isAnchored({ ...op(1, 0), roll: 'later' }), false);
    assert.equal(isAnchored({ ...op(1, 0), period: 0 }), false);
});

test('rebaseOps: an anchored set stands as stored on the value it was made on, follows another one, and an op without the mark is unchanged', () => {
    const stored = op(150, 120);
    assert.equal(rebase(120, stored)[0], stored, 'now == was: the op itself');
    assert.deepEqual(rebase(220, stored)[0], op(250, 220));
    const plain = { op: 'replace', path: PATH, value: 150, was: 120 };
    assert.deepEqual(rebase(220, plain)[0], { ...plain, value: 250, was: 220 }, 'unmarked: the counter rule, as before');
    const noRoll = { ...stored, roll: undefined };
    assert.equal(rebase(120, noRoll)[0], noRoll);
    assert.equal(rebase(undefined, stored)[0], stored, 'nothing there: as stored');
});

test('the mark is stored as written when the clock stood where it did, and the op replays to the same', async t => {
    const host = await told(t);
    const ops = host.store.opsAt(host.ctx.chat.length - 1).filter(o => o.path === PATH);
    assert.deepEqual(ops, [op(130, 50, 'after')]);
    assert.equal(clockOf(host), 130);
    host.store.rebuild();
    assert.equal(clockOf(host), 130);
});

test('an edited Re-read that grows the clock: later sets follow it like a fresh telling; reload == live', async t => {
    const host = await told(t);
    await edit(host, firstReply(host), ['! tick 120']);
    const fresh = await told(t, ['! tick 120']);
    assert.equal(clockOf(host), 230);
    assert.equal(clockOf(host), clockOf(fresh));
    assert.equal(await reloaded(t, host), 230);
    host.store.rebuild();
    assert.equal(clockOf(host), 230);
});

test('an edited Re-read that shrinks or sits mid-day: same clamps to now, after keeps the next day', async t => {
    const host = await told(t);
    await edit(host, firstReply(host), ['! tick 60']);
    const fresh = await told(t, ['! tick 60']);
    assert.equal(clockOf(host), 130);
    assert.equal(clockOf(host), clockOf(fresh));
    await edit(host, firstReply(host), ['! tick 5']);
    assert.equal(clockOf(host), 130);
    assert.equal(await reloaded(t, host), 130);
});

test('a middle delete and a swipe of the first reply give what a fresh telling gives', async t => {
    const host = await told(t);
    const at = firstReply(host);
    await host.st.deleteMessage(at + 2);
    await host.st.deleteMessage(at);
    assert.deepEqual(host.store.problems(), []);
    assert.equal(clockOf(host), 130, 'a skip alone: tomorrow 30');
    assert.equal(await reloaded(t, host), 130);
    // A swipe of the last reply replays it on the clock before it (50), like a fresh telling of that swipe.
    const second = await told(t);
    await second.swipe(reply(['+ skip 40']));
    assert.equal(clockOf(second), 140);
    second.store.rebuild();
    assert.equal(clockOf(second), 140);
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
