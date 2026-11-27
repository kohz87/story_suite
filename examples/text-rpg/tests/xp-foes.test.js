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
const paid = (labels, { groups = [['the rats', 60, 2]], live = fair(), member = astra() } = {}) => {
    const s = setup(groups, live, member);
    const done = run(applyXp, fakeCtx(s), line('xp', 'Party', 'the rats', labels));
    return { xp: s.members.ac_astra001.xp, done, s };
};

test('+ xp foes: each foe counts, four common fair foes pay 40, beneath pays half; a size: on the line pays nothing', () => {
    const four = paid({ foes: '4' });
    assert.equal(four.xp, 40);
    assert.equal(four.done.result.data.amount, 40);
    assert.equal(four.done.result.data.foes, 4);
    assert.match(four.done.result.summary, /^40 xp for the rats \(4 foes\)/);
    assert.equal(paid({ foes: '4' }, { groups: [['the rats', 60, 1]] }).xp, 20, 'beneath you is x0.5: the record\'s threat, not the line\'s');
    assert.equal(paid({ foes: '4', size: 'great', threat: 'beyond you' }).xp, 40, 'the old size: and threat: change nothing');
    assert.equal(paid({ foes: '4', size: 'great' }).done.result.data.size, undefined, 'and are not kept');
});

test('+ xp foes: missing or bad counts are one foe', () => {
    assert.equal(paid({}).xp, 10);
    assert.equal(paid({}).done.result.data.foes, 1);
    assert.doesNotMatch(paid({}).done.result.summary, /foes/);
    for (const bad of ['0', '60', 'six', '-2', '2.5', '', '51']) assert.equal(paid({ foes: bad }).xp, 10, `"${bad}" counts one`);
    assert.equal(paid({ foes: '50' }).done.result.data.foes, 50, '50 is the most');
    assert.equal(paid({ foes: '50' }).xp, 50, 'and the battle cap of a fair fight (50) holds the pay');
    assert.equal(paid({ foes: '1' }).xp, 10);
});

test('+ xp foes pays only the foes still standing in the record, counts them down, and a group at 0 is closed', () => {
    const four = paid({ foes: '9' }, { groups: [['rats', 4, 2]] });
    assert.deepEqual([four.xp, four.done.result.data.foes, leftOf(four.s)], [40, 4, { rats: 0 }], 'nine asked, four stood');
    const some = paid({ foes: '3' }, { groups: [['rats', 4, 2]] });
    assert.deepEqual([some.xp, leftOf(some.s)], [30, { rats: 1 }]);
    // A later reply names more than are left: the closed group pays nothing more, and with no one standing nothing is counted (no record to pay from).
    four.s.dice.sw_reply0002 = fair();
    const later = run(applyXp, fakeCtx(four.s, { sid: 'sw_reply0002' }), line('xp', 'Party', 'stragglers', { size: 'minor', foes: '5' }));
    assert.equal(later.result.data.foes, 0, 'the record has no one standing: no foe');
});

test('+ xp foes: a reply that rolled nothing pays nothing but counts the foes down, and says so', () => {
    const none = paid({ foes: '3' }, { live: { list: [10, 10, 10], floor: 0 }, groups: [['rats', 4, 2]] });
    assert.deepEqual([none.xp, none.done.result.data.foes, leftOf(none.s)], [0, 3, { rats: 1 }]);
    assert.equal(none.done.result.summary, 'no roll this reply: no XP for the rats (3 foes).');
});

test('+ xp foes: with no record nothing is counted: 10 XP when a roll succeeded this reply, else none, whatever the count or size says', () => {
    const none = paid({ foes: '6', size: 'major' }, { groups: null });
    assert.deepEqual([none.xp, none.done.result.data.foes], [0, 0]);
    const won = paid({ foes: '6', size: 'major' }, { groups: null, live: fair({ won: true }) });
    assert.deepEqual([won.xp, won.done.result.data.foes], [10, 0]);
    assert.equal(paid({ foes: '50' }, { groups: null, live: fair({ won: true }) }).xp, 10);
});

test('+ xp foes: `group: Name` pays that group, the others stand; an unknown or closed group is refused', () => {
    const groups = [['rats', 6, 1], ['wolves', 3, 3]];
    const wolves = paid({ foes: '2', group: 'Wolves' }, { groups });
    assert.deepEqual([wolves.xp, wolves.done.result.data.foes, leftOf(wolves.s)], [40, 2, { rats: 6, wolves: 1 }], 'two above-you foes at 20 each');
    const more = paid({ foes: '5', group: 'wolves' }, { groups });
    assert.deepEqual([more.xp, leftOf(more.s)], [60, { rats: 6, wolves: 0 }], 'only the three that stood');
    assert.equal(paid({ foes: '1', group: 'trolls' }, { groups }).done.code, 'NOT_FOUND');
    assert.equal(paid({ foes: '1', group: 'rats' }, { groups: [['rats', 2, 1, 0]] }).done.code, 'NOT_FOUND', 'a closed group');
});

test('+ xp foes without a group takes the lowest threat first, group by group, each at its own threat', () => {
    const groups = [['wolves', 3, 3], ['rats', 6, 1]];
    const four = paid({ foes: '4' }, { groups });
    assert.deepEqual([four.xp, leftOf(four.s)], [20, { wolves: 3, rats: 2 }], 'four beneath-you rats: 4 × 5');
    const eight = paid({ foes: '8' }, { groups });
    assert.deepEqual([eight.xp, eight.done.result.data.foes, leftOf(eight.s)], [70, 8, { wolves: 1, rats: 0 }], 'six rats 30, two wolves 40');
});

test('+ xp foes: the guard, the rate and the level cap apply after the count', () => {
    assert.equal(paid({ size: 'major', foes: '3' }, { live: fair({ hardest: 2 }) }).xp, 30, 'three common foes; the size: is ignored');
    const rules = { cap: 99, rate: 50 };
    assert.equal(paid({ foes: '4' }, { live: fair({ rules }) }).xp, 20, 'half rate of 40');
    assert.equal(paid({ foes: '6' }, { live: fair({ rules: { cap: 1, rate: 100 } }), member: astra({ xp: 90 }) }).xp, 99, 'held at the end of level 1');
    assert.equal(paid({ foes: '6' }, { member: astra({ xp: 90 }) }).xp, 140, 'no cap by default');
});

test('+ xp foes: the card says the count, and a rebuild == live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Strike.', reply('The rats swarm.', ['+ foes the rats | count: 6 | kind: common', '? try Astra | Lore | hard', '+ xp Party — the rats | foes: 6']));
    assert.equal(astraOf(host).xp, 50, 'six common foes, held to the cap of a fair battle');
    assert.equal(slice(host).foes.groups['the-rats'].left, 0);
    const at = host.ctx.chat.length - 1;
    const cards = () => Object.keys(CARDS).map(key => CARDS[key].for(host.head(), null, { index: at, query: (name, args) => host.sdk.query(name, args) })).filter(Boolean);
    assert.match(cards()[0].rows.at(-1).text, /^Earned: 50 xp for the rats \(6 foes\)/);
    const live = JSON.stringify(slice(host));
    const liveCards = JSON.stringify(cards());
    host.store.rebuild();
    assert.equal(JSON.stringify(slice(host)), live);
    assert.equal(JSON.stringify(cards()), liveCards);
});
