import test from 'node:test';
import assert from 'node:assert/strict';
import { applyXp } from '../src/module-parts/kinds/xp.js';
import { rollCards } from '../src/module-parts/roll-cards.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';

const CARDS = rollCards();
const fair = (extra = {}) => ({ list: [10, 10, 10], floor: 0, used: 1, hardest: 2, threat: 2, ...extra });
const paid = (labels, live = fair(), member = astra()) => {
    const s = sliceOf([member], live);
    const done = run(applyXp, fakeCtx(s), line('xp', 'Party', 'the rats', { size: 'minor', ...labels }));
    return { xp: s.members.ac_astra001.xp, done };
};

test('+ xp foes: each foe counts, six minor fair foes pay 30, beneath pays half', () => {
    const six = paid({ foes: '6' });
    assert.equal(six.xp, 30);
    assert.equal(six.done.result.data.amount, 30);
    assert.equal(six.done.result.data.foes, 6);
    assert.match(six.done.result.summary, /^30 xp for the rats \(6 foes\)/);
    assert.equal(paid({ foes: '6' }, fair({ threat: 1 })).xp, 15, 'beneath you is x0.5');
});

test('+ xp foes: missing or bad counts are one foe', () => {
    assert.equal(paid({}).xp, 5);
    assert.equal(paid({}).done.result.data.foes, 1);
    assert.doesNotMatch(paid({}).done.result.summary, /foes/);
    for (const bad of ['0', '60', 'six', '-2', '2.5', '', '51']) assert.equal(paid({ foes: bad }).xp, 5, `"${bad}" counts one`);
    assert.equal(paid({ foes: '50' }).xp, 250, '50 is the most');
    assert.equal(paid({ foes: '1' }).xp, 5);
});

test('+ xp foes: the guard, the rate and the level cap apply after the count', () => {
    assert.equal(paid({ size: 'major', foes: '3' }, fair({ hardest: 1 })).xp, 60, 'major is cut to real, times three');
    const rules = { cap: 99, rate: 50 };
    assert.equal(paid({ foes: '6' }, fair({ rules })).xp, 15, 'half rate of 30');
    assert.equal(paid({ foes: '6' }, fair({ rules: { cap: 1, rate: 100 } }), astra({ xp: 90 })).xp, 99, 'held at the end of level 1');
    assert.equal(paid({ foes: '6' }, fair(), astra({ xp: 90 })).xp, 120, 'no cap by default');
});

test('+ xp foes: the card says the count, and a rebuild == live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Strike.', reply('The rats swarm.', ['? try Astra | Lore | hard | threat: a fair match', '+ xp Party — the rats | size: minor | foes: 6']));
    assert.equal(astraOf(host).xp, 30);
    const at = host.ctx.chat.length - 1;
    const cards = () => Object.keys(CARDS).map(key => CARDS[key].for(host.head(), null, { index: at, query: (name, args) => host.sdk.query(name, args) })).filter(Boolean);
    assert.match(cards()[0].rows.at(-1).text, /^Earned: 30 xp for the rats \(6 foes\)/);
    const live = JSON.stringify(slice(host));
    const liveCards = JSON.stringify(cards());
    host.store.rebuild();
    assert.equal(JSON.stringify(slice(host)), live);
    assert.equal(JSON.stringify(cards()), liveCards);
});
