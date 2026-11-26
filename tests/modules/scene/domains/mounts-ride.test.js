// The Party paper-doll's Mount slot (`mounts.ride`, mounts-parts/ride.js): a member rides a mount (their name in its `where`),
// moving off any other one, None takes them off; a mount left behind or with no seat free is refused; gear.view's Mount slot and
// picker rows follow; replay equals live after a swipe, an edited Re-read, a middle delete and a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { validateScene } from '../../../../modules/scene/index.js';
import { block, fresh, lastIndex } from './mounts.helpers.js';
import { whereWith, nameList } from '../../../../modules/scene/mounts-parts/ride.js';

const wheres = host => host.sdk.query('mounts.list').map(row => [row.name, row.where]);
const run = async (host, payload) => {
    const out = await host.sdk.command('mounts.ride', payload);
    assert.equal(out.ok, true, out.message);
    return out;
};
const YARD = ['+ mount Grey Mare | kind: horse | pace: 35', '+ mount Burr | kind: mule | where: led by Tam', '+ mount Remounts | kind: horse | count: 2', '+ mount Old Pia | kind: pony | where: stabled at the Weir'];

test('whereWith and nameList: the verb a row had, else "ridden by"; nobody is with the party', () => {
    assert.equal(nameList(['A']), 'A');
    assert.equal(nameList(['A', 'B', 'C']), 'A, B and C');
    assert.equal(whereWith('led by Tam', ['Tam', 'Mara']), 'led by Tam and Mara');
    assert.equal(whereWith('at the gate', ['Mara']), 'ridden by Mara');
    assert.equal(whereWith('ridden by Mara', []), '');
});

test('a member rides a mount, moves to another (off the first), and None takes them off', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', YARD));
    const out = await run(host, { who: 'Mara', mount: 'Grey Mare' });
    assert.equal(out.receipt.summary, 'Mara rides Grey Mare.');
    assert.deepEqual(wheres(host).slice(0, 3), [['Grey Mare', 'ridden by Mara'], ['Burr', 'led by Tam'], ['Remounts', '']]);
    await run(host, { who: 'Mara', mount: 'Remounts' });
    await run(host, { who: 'Wessel', mount: 'Remounts' });
    assert.deepEqual(wheres(host).slice(0, 3), [['Grey Mare', ''], ['Burr', 'led by Tam'], ['Remounts', 'ridden by Mara and Wessel']]);
    await run(host, { who: 'Mara', mount: null });
    assert.deepEqual(wheres(host)[2], ['Remounts', 'ridden by Wessel']);
    assert.deepEqual(validateScene(host.head().domains.scene), []);
});

test('taking a rider off a bare list keeps the parts of `where` that are not their name', async t => {
    const host = await fresh(t);
    const me = host.ctx.name1;
    await host.send('Saddle up.', block('The yard.', [`+ mount Grey Mare | kind: horse | where: Penned, ${me}`, `+ mount Roan | kind: horse | where: Corporal Stenn and ${me}`, '+ mount Dun | kind: horse']));
    await run(host, { who: me, mount: 'Dun' });
    assert.deepEqual(wheres(host), [['Grey Mare', 'Penned'], ['Roan', 'Corporal Stenn'], ['Dun', `ridden by ${me}`]]);
    await run(host, { who: me, mount: null });
    assert.deepEqual(wheres(host)[2], ['Dun', '']);
    await host.send('Back.', block('Back.', [`~ mount Grey Mare | where: ${me}, Penned`]));
    await run(host, { who: me, mount: null });
    assert.deepEqual(wheres(host)[0], ['Grey Mare', 'Penned']);
    const live = JSON.stringify(wheres(host));
    host.store.rebuild();
    assert.equal(JSON.stringify(wheres(host)), live, 'rebuild == live');
});

test('the refusals: left behind, no seat free, already riding it, riding nothing, no such mount, not the reader', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', YARD));
    for (const [payload, pattern] of [
        [{ who: 'Mara', mount: 'Old Pia' }, /Old Pia is not with the party \(stabled at the Weir\)/],
        [{ who: 'Mara', mount: 'Burr' }, /Burr already carries Tam/],
        [{ who: 'Tam', mount: 'Burr' }, /Tam already rides Burr/],
        [{ who: 'Mara', mount: null }, /Mara rides no mount/],
        [{ who: 'Mara', mount: 'Nobody' }, /no mount called Nobody/],
        [{ mount: 'Grey Mare' }, /Say who rides/],
    ]) {
        const out = await host.sdk.command('mounts.ride', payload);
        assert.equal(out.ok, false, JSON.stringify(payload));
        assert.match(out.message, pattern);
    }
    // The story cannot ride a mount by the command (its lines are the capture kind's).
    const before = wheres(host);
    await host.send('On.', block('On.', ['~ mount Grey Mare | where: ridden by Wessel']));
    assert.notDeepEqual(wheres(host), before);
});

test('gear.view: the Mount slot and the picker rows (kind, pace, seats, riders, with the party)', async t => {
    const host = await fresh(t, { features: { 'story-block.gear': true, 'story-block.rpg': true } });
    await host.send('Saddle up.', block('The yard.', YARD));
    const you = host.sdk.query('gear.view', { owner: 'party' }).owners[0].label;
    await run(host, { who: you, mount: 'Grey Mare' });
    const view = host.sdk.query('gear.view', { owner: 'party' });
    assert.deepEqual(view.ride, { name: 'Grey Mare', kind: 'horse', pace: 35, carry: 40 });
    assert.deepEqual(view.carriers.rides.map(row => [row.name, row.count, row.riders, row.withParty]),
        [['Grey Mare', 1, [you], true], ['Burr', 1, ['Tam'], true], ['Remounts', 2, [], true], ['Old Pia', 1, [], false]]);
});

test('replay equals live: a swipe, an edited Re-read, a middle delete and a reload', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', YARD));
    await host.send('A ford.', block('A ford.', ['~ place Weir | kind: ford']));
    const middle = lastIndex(host);
    await host.send('On.', block('On.', ['~ mount Burr | condition: tired']));
    await run(host, { who: 'Mara', mount: 'Grey Mare' });
    await run(host, { who: 'Wessel', mount: 'Remounts' });
    const live = wheres(host);
    host.store.rebuild();
    assert.deepEqual(wheres(host), live, 'a rebuild equals live');
    const other = await createHost({ st: { chat: structuredClone(host.ctx.chat) } });
    t.after(() => other.close());
    assert.deepEqual(other.head().domains.scene.mounts, host.head().domains.scene.mounts, 'a reload equals live');
    // An edited Re-read of the head reply: its own line changes, the riders (the reader's, kept on it) stay.
    host.ctx.chat[lastIndex(host)].mes = block('On.', ['~ mount Burr | condition: lame']);
    assert.equal((await host.turn.reread(lastIndex(host))).ok, true);
    assert.deepEqual(wheres(host), live);
    // A middle delete: the riders stay; a rebuild agrees.
    await host.st.deleteMessage(middle);
    assert.deepEqual(wheres(host), live);
    host.store.rebuild();
    assert.deepEqual(wheres(host), live, 'a rebuild equals live after the delete');
    // A swipe of the head reply has none of the reader's riding; back on the first swipe they are back.
    await host.swipe(block('Elsewhere.', ['~ mount Burr | condition: fine']));
    assert.deepEqual(wheres(host).slice(0, 3), [['Grey Mare', ''], ['Burr', 'led by Tam'], ['Remounts', '']]);
    await host.st.swipeTo(lastIndex(host), 0);
    assert.deepEqual(wheres(host), live);
});
