import test from 'node:test';
import assert from 'node:assert/strict';
import { applyXp } from '../src/module-parts/kinds/xp.js';
import { rollCards } from '../src/module-parts/roll-cards.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { leftOf, withFoes } from './helpers/foes.js';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';

const CARDS = rollCards();
const fair = (extra = {}) => ({ list: [10, 10, 10], floor: 0, used: 1, hardest: 3, threat: 2, ...extra });
// A reply that rolled at hard, over a foes record of `groups` (name, count, threat); with none, no record.
const setup = (groups, live = fair(), member = astra()) => {
    const s = sliceOf([member], live);
    return groups ? withFoes(s, groups) : s;
};
const paid = (labels, { groups = [['the rats', 60, 2]], live = fair(), member = astra(), size = 'minor' } = {}) => {
    const s = setup(groups, live, member);
    const done = run(applyXp, fakeCtx(s), line('xp', 'Party', 'the rats', { size, ...labels }));
    return { xp: s.members.ac_astra001.xp, done, s };
};

test('+ xp foes: each foe counts, six minor fair foes pay 30, beneath pays half', () => {
    const six = paid({ foes: '6' });
    assert.equal(six.xp, 30);
    assert.equal(six.done.result.data.amount, 30);
    assert.equal(six.done.result.data.foes, 6);
    assert.match(six.done.result.summary, /^30 xp for the rats \(6 foes\)/);
    assert.equal(paid({ foes: '6' }, { groups: [['the rats', 60, 1]] }).xp, 15, 'beneath you is x0.5: the record\'s threat, not the line\'s');
});

test('+ xp foes: missing or bad counts are one foe', () => {
    assert.equal(paid({}).xp, 5);
    assert.equal(paid({}).done.result.data.foes, 1);
    assert.doesNotMatch(paid({}).done.result.summary, /foes/);
    for (const bad of ['0', '60', 'six', '-2', '2.5', '', '51']) assert.equal(paid({ foes: bad }).xp, 5, `"${bad}" counts one`);
    assert.equal(paid({ foes: '50' }).xp, 250, '50 is the most');
    assert.equal(paid({ foes: '1' }).xp, 5);
});

test('+ xp foes pays only the foes still standing in the record, counts them down, and a group at 0 is closed', () => {
    const four = paid({ foes: '9' }, { groups: [['rats', 4, 2]] });
    assert.deepEqual([four.xp, four.done.result.data.foes, leftOf(four.s)], [20, 4, { rats: 0 }], 'nine asked, four stood');
    const some = paid({ foes: '3' }, { groups: [['rats', 4, 2]] });
    assert.deepEqual([some.xp, leftOf(some.s)], [15, { rats: 1 }]);
    // A later reply names more than are left: the closed group pays nothing more, and with no one standing it is one foe at most (no record to pay from).
    four.s.dice.sw_reply0002 = fair();
    const later = run(applyXp, fakeCtx(four.s, { sid: 'sw_reply0002' }), line('xp', 'Party', 'stragglers', { size: 'minor', foes: '5' }));
    assert.equal(later.result.data.foes, 1, 'the record has no one standing: one foe');
});

test('+ xp foes: a reply that rolled nothing pays nothing and counts nobody down', () => {
    const none = paid({ foes: '3' }, { live: { list: [10, 10, 10], floor: 0 }, groups: [['rats', 4, 2]] });
    assert.deepEqual([none.xp, none.done.result.data.foes, leftOf(none.s)], [0, 0, { rats: 4 }]);
});

test('+ xp foes: with no record the count is capped at one, so the narrator must set the foes up', () => {
    const none = paid({ foes: '6' }, { groups: null });
    assert.deepEqual([none.xp, none.done.result.data.foes], [5, 1]);
    assert.equal(paid({ foes: '50' }, { groups: null }).xp, 5);
});

test('+ xp foes: `group: Name` pays that group, the others stand; an unknown or closed group is refused', () => {
    const groups = [['rats', 6, 1], ['wolves', 3, 3]];
    const wolves = paid({ foes: '2', group: 'Wolves' }, { groups });
    assert.deepEqual([wolves.xp, wolves.done.result.data.foes, leftOf(wolves.s)], [20, 2, { rats: 6, wolves: 1 }], 'two above-you foes at 10 each');
    const more = paid({ foes: '5', group: 'wolves' }, { groups });
    assert.deepEqual([more.xp, leftOf(more.s)], [30, { rats: 6, wolves: 0 }], 'only the three that stood');
    assert.equal(paid({ foes: '1', group: 'trolls' }, { groups }).done.code, 'NOT_FOUND');
    assert.equal(paid({ foes: '1', group: 'rats' }, { groups: [['rats', 2, 1, 0]] }).done.code, 'NOT_FOUND', 'a closed group');
});

test('+ xp foes without a group takes the lowest threat first, group by group, each at its own threat', () => {
    const groups = [['wolves', 3, 3], ['rats', 6, 1]];
    const four = paid({ foes: '4' }, { groups });
    assert.deepEqual([four.xp, leftOf(four.s)], [10, { wolves: 3, rats: 2 }], 'four beneath-you rats: 4 × 2.5');
    const eight = paid({ foes: '8' }, { groups });
    assert.deepEqual([eight.xp, eight.done.result.data.foes, leftOf(eight.s)], [35, 8, { wolves: 1, rats: 0 }], 'six rats 15, two wolves 20');
});

test('+ xp foes: the guard, the rate and the level cap apply after the count', () => {
    assert.equal(paid({ size: 'major', foes: '3' }, { live: fair({ hardest: 2 }) }).xp, 60, 'major is cut to real, times three');
    const rules = { cap: 99, rate: 50 };
    assert.equal(paid({ foes: '6' }, { live: fair({ rules }) }).xp, 15, 'half rate of 30');
    assert.equal(paid({ foes: '6' }, { live: fair({ rules: { cap: 1, rate: 100 } }), member: astra({ xp: 90 }) }).xp, 99, 'held at the end of level 1');
    assert.equal(paid({ foes: '6' }, { member: astra({ xp: 90 }) }).xp, 120, 'no cap by default');
});

test('+ xp foes: the card says the count, and a rebuild == live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Strike.', reply('The rats swarm.', ['+ foes the rats | count: 6 | threat: a fair match', '? try Astra | Lore | hard | threat: a fair match', '+ xp Party — the rats | size: minor | foes: 6']));
    assert.equal(astraOf(host).xp, 30);
    assert.equal(slice(host).foes.groups['the-rats'].left, 0);
    const at = host.ctx.chat.length - 1;
    const cards = () => Object.keys(CARDS).map(key => CARDS[key].for(host.head(), null, { index: at, query: (name, args) => host.sdk.query(name, args) })).filter(Boolean);
    assert.match(cards()[0].rows.at(-1).text, /^Earned: 30 xp for the rats \(6 foes\)/);
    const live = JSON.stringify(slice(host));
    const liveCards = JSON.stringify(cards());
    host.store.rebuild();
    assert.equal(JSON.stringify(slice(host)), live);
    assert.equal(JSON.stringify(cards()), liveCards);
});
