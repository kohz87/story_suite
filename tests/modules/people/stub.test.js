// people.stub: a module's own command makes one person from a story line's stub (the domain starts at the first one); a reader's button or a page cannot;
// an existing person is never replaced; the record must be sound; a swipe and a rebuild take the person away or bring them back with their reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';

const record = (id, name) => ({ id, name, aliases: [], role: 'clerk', appearance: 'a braid' });
const caller = { id: 'x', name: 'X', commands: { 'x.stub': (ctx, p) => { ctx.call('people.stub', p); return { summary: 'stubbed' }; } } };
const people = host => host.head().domains.people;

test('only a module\'s command makes a person; the domain starts with the first; the id joins the order; an existing person is refused', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [caller] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    assert.equal((await host.sdk.command('people.stub', { id: 'npc_ann', record: record('npc_ann', 'Ann') })).ok, false, 'a reader or page cannot send it');
    assert.equal((await host.sdk.command('x.stub', { id: 'npc_ann', record: record('npc_ann', 'Ann') })).ok, true);
    assert.deepEqual(people(host).order, ['npc_ann']);
    assert.equal(people(host).npcs.npc_ann.appearance, 'a braid');
    assert.equal((await host.sdk.command('x.stub', { id: 'npc_ann', record: { ...record('npc_ann', 'Ann'), role: 'changed' } })).ok, false, 'never replaces');
    assert.equal(people(host).npcs.npc_ann.role, 'clerk');
    assert.equal((await host.sdk.command('x.stub', { id: 'npc_bo', record: record('npc_bo', 'Bo') })).ok, true);
    assert.deepEqual(people(host).order, ['npc_ann', 'npc_bo']);
});

test('a record that is not sound makes nobody: a wrong id, no name, a bad key, image bytes', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [caller] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    const bad = [
        { id: 'npc_ann', record: record('npc_zed', 'Ann') }, { id: 'npc_ann', record: { id: 'npc_ann', name: '  ' } }, { id: 'ann', record: record('ann', 'Ann') },
        { id: 'npc_ann', record: { ...record('npc_ann', 'Ann'), portrait: 'data:image/png;base64,AAAA' } }, { id: 'npc_ann' }, null,
    ];
    for (const payload of bad) assert.notEqual((await host.sdk.command('x.stub', payload)).ok, true);
    assert.equal(people(host)?.order?.length ?? 0, 0);
});

test('a swipe takes the person with its reply, swiping back brings them; a rebuild equals live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [caller] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    await host.sdk.command('x.stub', { id: 'npc_ann', record: record('npc_ann', 'Ann') });
    const live = JSON.stringify(people(host));
    await host.swipe('Another road.');
    assert.equal(people(host)?.npcs?.npc_ann, undefined, 'the swipe\'s reply never made her');
    await host.st.swipeTo(host.store.headIndex(), 0);
    assert.equal(JSON.stringify(people(host)), live);
    host.store.rebuild();
    assert.equal(JSON.stringify(people(host)), live);
});
