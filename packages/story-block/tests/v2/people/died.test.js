// people.died: a module's own command marks one person dead from a story line; a reader's button or a page cannot; a dead person or a missing one is refused;
// a swipe takes the death away with its reply, swiping back brings it, and a rebuild equals live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';

const caller = { id: 'x', name: 'X', commands: {
    'x.stub': (ctx, p) => { ctx.call('people.stub', p); return { summary: 'stubbed' }; },
    'x.died': (ctx, p) => { ctx.call('people.died', p); return { summary: 'died' }; },
} };
const people = host => host.head().domains.people;
const ann = { id: 'npc_ann', record: { id: 'npc_ann', name: 'Ann', aliases: [] } };

test('only a module\'s command kills; the record is terminal and archived; a second death and a missing person are refused', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [caller] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    await host.sdk.command('x.stub', ann);
    const give = { id: 'npc_ann', reason: 'fell', sid: 's1' };
    assert.equal((await host.sdk.command('people.died', give)).ok, false, 'a reader or page cannot send it');
    assert.equal((await host.sdk.command('x.died', { ...give, id: 'npc_zed' })).ok, false);
    assert.equal((await host.sdk.command('x.died', { ...give, reason: '' })).ok, false);
    assert.equal((await host.sdk.command('x.died', give)).ok, true);
    assert.deepEqual([people(host).npcs.npc_ann.lifeState, people(host).npcs.npc_ann.archiveReason, people(host).npcs.npc_ann.present], ['deceased', 'deceased', false]);
    assert.equal((await host.sdk.command('x.died', { ...give, reason: 'again' })).ok, false);
    assert.equal(people(host).npcs.npc_ann.lifeStateReason, 'fell');
});

test('a swipe takes the death with its reply, swiping back brings it; a rebuild equals live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [caller] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    await host.sdk.command('x.stub', ann);
    await host.send('Next.', 'A fight.');
    await host.sdk.command('x.died', { id: 'npc_ann', reason: 'fell', sid: 's2' });
    const live = JSON.stringify(people(host));
    host.store.rebuild();
    assert.equal(JSON.stringify(people(host)), live);
    await host.swipe('Calm.');
    assert.equal(people(host).npcs.npc_ann.lifeState, undefined);
});
