// The no-record 10 XP pays only away from a battle; the battle cap is in granted XP and comes from the groups that fell or stand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFoes } from '../src/module-parts/kinds/foes.js';
import { applyXp } from '../src/module-parts/kinds/xp.js';
import { capOf } from '../src/module-parts/foes-pay.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

const reply = n => `sw_reply${String(n).padStart(4, '0')}`;
const rolled = (extra = {}) => ({ list: [10, 10, 10], floor: 0, used: 1, hardest: 2, won: true, ...extra });
const world = ({ clocks = null, rules = null } = {}) => {
    const slice = sliceOf([astra()], null);
    for (let n = 1; n <= 5; n++) slice.dice[reply(n)] = rolled({ ...(clocks ? { clock: clocks[n - 1] } : {}), ...(rules ? { rules } : {}) });
    return slice;
};
const foes = (slice, n, name, kind, count, op = '+') => run(applyFoes, fakeCtx(slice, { sid: reply(n) }), { ...line('foes', name, '', { count: String(count), kind }), op });
const xp = (slice, n, count, labels = {}) => run(applyXp, fakeCtx(slice, { sid: reply(n) }), line('xp', 'Party', 'they fall', { foes: String(count), ...labels }));

test('a + xp after the battle pays 0 while it is current, and 10 for a won roll once a new reply is clear of it (no clock)', () => {
    const slice = world();
    foes(slice, 1, 'Guards', 'trained', 1);
    assert.equal(xp(slice, 2, 1).result.data.amount, 20 * 2, 'the fall pays at its threat (trained at level 1: above, ×2)');
    const after = xp(slice, 3, 1);
    assert.equal(after.result.data.amount, 0);
    assert.match(after.result.summary, /the battle is over; its XP was paid as the foes fell/);
    assert.equal(xp(slice, 4, 1).result.data.amount, 10, 'two replies after the close: a deed away from any fight');
});

test('with a clock the join window is 60 story minutes', () => {
    const slice = world({ clocks: [0, 10, 60, 200, 300] });
    foes(slice, 1, 'Guards', 'trained', 1);
    xp(slice, 2, 1);
    assert.equal(xp(slice, 3, 1).result.data.amount, 0, '50 minutes after the close');
    assert.equal(xp(slice, 4, 1).result.data.amount, 10, '190 minutes after it');
});

test('the cap is scaled by the XP rate, and the receipt shows granted numbers', () => {
    const slice = world({ rules: { cap: 99, rate: 200 } });
    foes(slice, 1, 'Rats', 'vermin', 24);
    const done = xp(slice, 2, 24);
    assert.equal(done.result.data.amount, 50, 'the cap of 25 granted at 200%');
    assert.deepEqual(done.result.data.battle, { paid: 50, cap: 50 });
    assert.match(done.result.summary, /battle cap reached: 50 of 50/);
    const half = world({ rules: { cap: 99, rate: 50 } });
    foes(half, 1, 'Rats', 'vermin', 4);
    const some = xp(half, 2, 4);
    assert.match(some.result.summary, /battle 5 of 12\./, '4 × 2.5 = 10 at half: 5 of a cap of 12');
});

test('the cap comes from the strongest group that fell or stands: a group ended with no kills does not count', () => {
    const slice = world();
    foes(slice, 1, 'Dragon', 'legend', 1);
    foes(slice, 1, 'Rats', 'vermin', 4);
    const fight = Object.values(slice.foes.groups)[0].fight;
    assert.equal(capOf(slice, fight), 200, 'the dragon stands');
    foes(slice, 2, 'Dragon', 'legend', 1, '-');
    assert.equal(capOf(slice, fight), 25, 'ended with no kills: only the rats count');
    assert.equal(xp(slice, 2, 4).result.data.amount, 10, 'four rats at 2.5 under a cap of 25');
    foes(slice, 3, 'Orcs', 'monster', 2);
    xp(slice, 3, 1, { group: 'Orcs' });
    foes(slice, 3, 'Orcs', 'monster', 1, '-');
    assert.equal(capOf(slice, fight), 200, 'an ended group that had a foe fall still counts');
});
