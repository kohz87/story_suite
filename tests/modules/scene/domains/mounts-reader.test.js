// The Bag › Transport's own mount commands (mounts-parts/reader.js): `mounts.add` makes a row with the `+ mount` line's fields (a missing pace
// is the kind's usual one) and never changes a mount the party has; `mounts.remove` is the `- mount` line. Both are the reader's only.
// Replay equals live after a swipe, an edited Re-read, a middle delete and a reload; deleting the reply that holds the reader's add passes
// over a later edit, ride or remove of that mount; deleting the one that holds a remove gives the mount back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { validateScene } from '../../../../modules/scene/index.js';
import { addMount, removeMount } from '../../../../modules/scene/mounts-parts/reader.js';
import { checkInvariants } from '../../../suite/qa/helpers/oracle.js';
import { block, fresh, lastIndex } from './mounts.helpers.js';

const rows = host => host.sdk.query('mounts.list').map(row => [row.name, row.kind, row.count, row.pace, row.where]);
const ok = async (host, name, payload) => {
    const out = await host.sdk.command(name, payload);
    assert.equal(out.ok, true, out.message);
    return out;
};
function steady(host, label) {
    assert.deepEqual(validateScene(host.head().domains.scene), [], label);
    checkInvariants(host, label);
    const live = JSON.stringify(host.head().domains.scene.mounts ?? null);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains.scene.mounts ?? null), live, `${label}: a rebuild equals live`);
}

test('mounts.add: the kind\'s usual pace, a count, where; mounts.remove takes it away', async t => {
    const host = await fresh(t);
    const out = await ok(host, 'mounts.add', { name: 'Grey Mare', kind: 'horse', count: 1, where: 'ridden by Mara' });
    assert.equal(out.receipt.summary, 'The party gets Grey Mare: horse, 35 km/day.');
    await ok(host, 'mounts.add', { name: 'Supply Cart', kind: 'cart', count: 2, pace: 22, where: '' });
    await ok(host, 'mounts.add', { name: 'Odd Beast' });
    assert.deepEqual(rows(host), [['Grey Mare', 'horse', 1, 35, 'ridden by Mara'], ['Supply Cart', 'cart', 2, 22, ''], ['Odd Beast', '', 1, 30, '']]);
    assert.equal(host.sdk.query('mounts.pace').pace, 22, 'the slowest sets the pace');
    await ok(host, 'mounts.remove', { mount: 'odd beast' });
    assert.deepEqual(rows(host).map(row => row[0]), ['Grey Mare', 'Supply Cart']);
    steady(host, 'after add and remove');
});

test('the refusals: a name in use, no name, no such mount, a thirteenth row, and nothing but the reader', async t => {
    const host = await fresh(t);
    await host.send('Yard.', block('The yard.', ['+ mount Burr | kind: mule']));
    for (const [type, payload, pattern] of [
        ['mounts.add', { name: ' burr ', kind: 'horse' }, /"burr" is already the name of another mount/],
        ['mounts.add', { name: '  ', kind: 'horse' }, /needs the mount's name/],
        ['mounts.add', { name: 7 }, /must be text/],
        ['mounts.add', { name: 'Tall', kind: 'horse', count: 'many' }, /must be a whole number/],
        ['mounts.remove', { mount: 'Nobody' }, /no mount called Nobody/],
        ['mounts.remove', {}, /Which mount/],
    ]) {
        const out = await host.sdk.command(type, payload);
        assert.equal(out.ok, false, JSON.stringify(payload));
        assert.match(out.message, pattern);
    }
    assert.deepEqual(rows(host), [['Burr', 'mule', 1, 25, '']], 'a refusal changes nothing');
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) await ok(host, 'mounts.add', { name: `Pony ${n}`, kind: 'pony' });
    assert.match((await host.sdk.command('mounts.add', { name: 'Pony 13', kind: 'pony' })).message, /at most 12 mounts/);
    // A story line or a module's nested call cannot use them (the story has its own + mount / - mount lines).
    const failed = [];
    const ctx = cause => ({ cause, caller: cause === 'ui' ? 'zz-quest' : null, fail: (code, message) => { failed.push(message); throw new Error(message); } });
    for (const cause of ['story', 'system', 'ui']) {
        assert.throws(() => addMount(ctx(cause), { name: 'Sneaky' }));
        assert.throws(() => removeMount(ctx(cause), { mount: 'Burr' }));
    }
    assert.ok(failed.every(message => message === 'Only the reader changes a mount by hand.'));
});

test('replay equals live: a swipe, an edited Re-read, a middle delete and a reload', async t => {
    const host = await fresh(t);
    await host.send('Yard.', block('The yard.', ['+ mount Burr | kind: mule', '+ mount Old Pia | kind: pony']));
    await host.send('A ford.', block('A ford.', ['~ place Weir | kind: ford']));
    const middle = lastIndex(host);
    await host.send('On.', block('On.', ['~ mount Burr | condition: tired']));
    await ok(host, 'mounts.add', { name: 'Grey Mare', kind: 'horse', where: 'ridden by Mara' });
    await ok(host, 'mounts.remove', { mount: 'Old Pia' });
    await ok(host, 'mounts.edit', { mount: 'Grey Mare', pace: 40 });
    const live = rows(host);
    assert.deepEqual(live, [['Burr', 'mule', 1, 25, ''], ['Grey Mare', 'horse', 1, 40, 'ridden by Mara']]);
    steady(host, 'live');
    const other = await createHost({ st: { chat: structuredClone(host.ctx.chat) } });
    t.after(() => other.close());
    assert.deepEqual(other.head().domains.scene.mounts, host.head().domains.scene.mounts, 'a reload equals live');
    // An edited Re-read of the head reply: its own line changes, the reader's add and remove (kept on it) stay.
    host.ctx.chat[lastIndex(host)].mes = block('On.', ['~ mount Burr | condition: lame']);
    assert.equal((await host.turn.reread(lastIndex(host))).ok, true);
    assert.deepEqual(rows(host), live);
    await host.st.deleteMessage(middle);
    assert.deepEqual(rows(host), live, 'a middle delete keeps them');
    steady(host, 'after the delete');
    // A swipe of the head reply has none of the reader's changes; back on the first swipe they are back.
    await host.swipe(block('Elsewhere.', ['~ mount Burr | condition: fine']));
    assert.deepEqual(rows(host).map(row => row[0]), ['Burr', 'Old Pia']);
    await host.st.swipeTo(lastIndex(host), 0);
    assert.deepEqual(rows(host), live);
    steady(host, 'after the swipe back');
});

test('deleting the reply that holds the add: a later edit, ride and remove of that mount are passed over; the rest applies', async t => {
    const host = await fresh(t);
    await host.send('Yard.', block('The yard.', ['+ mount Burr | kind: mule']));
    // (a reader command is kept on the latest reply: the add sits on a reply of its own)
    await host.send('Rest.', block('Rest.', ['+ coin 3']));
    await ok(host, 'mounts.add', { name: 'Grey Mare', kind: 'horse' });
    const added = lastIndex(host);
    await host.send('Ride.', block('Ride.', ['~ mount Grey Mare | condition: tired', '~ mount Burr | condition: lame']));
    await ok(host, 'mounts.ride', { who: 'Mara', mount: 'Grey Mare' });
    await ok(host, 'mounts.edit', { mount: 'Grey Mare', count: 2 });
    await host.send('Later.', block('Later.', ['+ coin 1']));
    await ok(host, 'mounts.remove', { mount: 'Grey Mare' });
    assert.deepEqual(rows(host).map(row => row[0]), ['Burr']);
    await host.st.deleteMessage(added);
    assert.deepEqual(host.sdk.query('mounts.list').map(row => [row.name, row.condition]), [['Burr', 'lame']], 'the later changes to Burr still apply');
    steady(host, 'add deleted');
});

test('deleting the reply that holds the reader\'s remove gives the mount back; one that holds the add before a later ride keeps the rest whole', async t => {
    const host = await fresh(t);
    await host.send('Yard.', block('The yard.', ['+ mount Burr | kind: mule']));
    await host.send('Sell.', block('Sell.', ['+ coin 2']));
    await ok(host, 'mounts.remove', { mount: 'Burr' });
    const removed = lastIndex(host);
    await host.send('On.', block('On.', ['+ coin 1']));
    await ok(host, 'mounts.add', { name: 'Grey Mare', kind: 'horse' });
    await ok(host, 'mounts.ride', { who: 'Mara', mount: 'Grey Mare' });
    await host.st.deleteMessage(removed);
    assert.deepEqual(rows(host), [['Burr', 'mule', 1, 25, ''], ['Grey Mare', 'horse', 1, 35, 'ridden by Mara']]);
    steady(host, 'remove deleted');
});
