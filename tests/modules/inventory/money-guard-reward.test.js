// The money guard does not flag a payment that is exactly an open quest's stated reward (from its giver), and still flags other far-above-purse payments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { withD1 } from '../../helpers/director/d1.js';
import { moneyWarning, openRewards } from '../../../core/turn/money-guard.js';
import { currencyOf } from '../../../modules/inventory/money-parts/coins.js';

const said = lines => `Told.\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const warned = host => host.turn.problems().filter(item => /applied; undo it/u.test(item.message));

async function directorHost(t) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
    host = await createHost({ modules: [director], settings: { 'story-director.pulse': false } });
    t.after(() => host.close());
    return host;
}

test('a payment equal to the open quest reward from its giver is not warned; another amount or giver still is', async t => {
    const host = await directorHost(t);
    await host.send('Pockets.', said(['+ coin 3 | from: a pocket']));
    await host.send('Job.', said(['+ quest Missing ferryman | giver: Hedda Vane | reward: 20 copper']));
    await host.send('Paid.', said(['+ coin 20 | from: Hedda Vane']));
    assert.equal(warned(host).length, 0, 'the quest reward is expected');
    await host.send('Windfall.', said(['+ coin 200 | from: a chest']));
    assert.equal(warned(host).length, 1, 'a different amount is still far above the purse');
    assert.equal(host.head().domains.inventory.wallets.party.coin, 223, 'the guard never blocks');
});

test('rewards are read from open quests only, and the guard takes them as an argument', () => {
    const receipt = { type: 'capture.coin', summary: 'The party receives 20 copper', data: { owner: 'party', amount: 20, now: 23, note: 'from Hedda Vane' } };
    assert.match(moneyWarning(receipt, []) ?? '', /more than 5 times/u, 'without a quest it is flagged');
    assert.equal(moneyWarning(receipt, [], [], [{ reward: '20 copper', giver: 'hedda vane' }]), null);
    assert.match(moneyWarning(receipt, [], [], [{ reward: '25 copper', giver: 'hedda vane' }]) ?? '', /more than 5 times/u);
    assert.match(moneyWarning(receipt, [], [], [{ reward: '20 copper', giver: 'nelke' }]) ?? '', /more than 5 times/u);
    const state = { domains: { director: { threads: { a: { kind: 'quest', status: 'active', fields: { reward: '20 copper', giver: 'Hedda Vane' } }, b: { kind: 'quest', status: 'resolved', fields: { reward: '5' } }, c: { kind: 'hook', status: 'active', fields: { reward: '7' } } } } } };
    assert.deepEqual(openRewards(state), [{ reward: '20 copper', giver: 'hedda vane', amount: 20 }]);
});

test('a reward written in a larger coin and paid in the smallest is the reward, and so is one whose quest the reply closed first', async t => {
    const currency = { currency: 'copper', coins: [{ name: 'silver', value: 10 }] };
    const receipt = { type: 'capture.coin', summary: 'The party receives 20 copper', data: { owner: 'party', amount: 20, now: 23, note: 'from Hedda Vane' } };
    const state = { domains: { director: { threads: { a: { kind: 'quest', status: 'active', fields: { reward: '2 silver', giver: 'Hedda Vane' } } } } } };
    const rewards = openRewards(state, currencyOf(currency));
    assert.equal(rewards[0].amount, 20);
    assert.equal(moneyWarning(receipt, [], [], rewards), null);
    assert.match(moneyWarning({ ...receipt, data: { ...receipt.data, amount: 30, now: 33 } }, [], [], rewards) ?? '', /more than 5 times/u);
    const host = await directorHost(t);
    await host.send('Pockets.', said(['+ coin 3 | from: a pocket']));
    await host.send('Job.', said(['+ quest Missing ferryman | giver: Hedda Vane | reward: 20 copper']));
    await host.send('Done.', said(['- quest Missing ferryman', '+ coin 20 | from: Hedda Vane']));
    assert.equal(warned(host).length, 0, 'the quest was open when the reply began');
});
