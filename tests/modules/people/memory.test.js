// people.memory: a module's own command stores a person's memories and their dates in the reply's transaction; a reader or page cannot; bad lists are refused; swipe and rebuild equal live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';

const stub = { id: 'x', name: 'X', commands: {
    'x.stub': (ctx, p) => { ctx.call('people.stub', p); return { summary: 'stubbed' }; },
    'x.mem': (ctx, p) => { ctx.call('people.memory', p); return { summary: 'remembered' }; },
} };
const people = host => host.head().domains.people;
const ann = { id: 'npc_ann', record: { id: 'npc_ann', name: 'Ann', aliases: [] } };

test('only a module stores memories; the list and the dates are stored whole; bad input is refused', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [stub] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    await host.sdk.command('x.stub', ann);
    assert.equal((await host.sdk.command('people.memory', { id: 'npc_ann', memories: ['a'] })).ok, false, 'a reader or page cannot send it');
    assert.equal((await host.sdk.command('x.mem', { id: 'npc_ann', memories: ['She kept a promise.'], stamps: { 'she kept a promise': { m: 1, d: 'Day 2' } } })).ok, true);
    assert.deepEqual(people(host).npcs.npc_ann.memories, ['She kept a promise.']);
    assert.deepEqual(people(host).npcs.npc_ann.memoryStamps, { 'she kept a promise': { m: 1, d: 'Day 2' } });
    for (const bad of [{ id: 'npc_zed', memories: ['a'] }, { id: 'npc_ann', memories: 'a' }, { id: 'npc_ann', memories: [''] }, { id: 'npc_ann', memories: ['a'], stamps: { a: { m: -1 } } }, { id: 'npc_ann', memories: ['a'.repeat(401)] }]) {
        assert.notEqual((await host.sdk.command('x.mem', bad)).ok, true);
    }
    assert.deepEqual(people(host).npcs.npc_ann.memories, ['She kept a promise.'], 'a refusal stores nothing');
});

test('a swipe takes the memory with its reply, swiping back brings it; a rebuild equals live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [stub] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    await host.sdk.command('x.stub', ann);
    await host.sdk.command('x.mem', { id: 'npc_ann', memories: ['One.'] });
    const live = JSON.stringify(people(host));
    await host.swipe('Another road.');
    assert.equal(people(host)?.npcs?.npc_ann, undefined);
    await host.st.swipeTo(host.store.headIndex(), 0);
    assert.equal(JSON.stringify(people(host)), live);
    host.store.rebuild();
    assert.equal(JSON.stringify(people(host)), live);
});
