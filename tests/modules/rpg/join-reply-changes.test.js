// "This reply" (`reply.changes`) lists a companion the reader took from the reply's join card (SOAK2CORE #6): Add to party and Edit first's Create both say
// "Mara joined the party", as the automatic join does; after a reload too, and a swipe takes the line away with the reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, reply, world, joinCardOf, rebuilt } from './join.helpers.js';
import { JOIN_ADD, JOIN_NO, joinDraft } from '../../../modules/rpg/join.js';
import { buildDefinitions } from '../../../modules/rpg/view/wizard-data.js';

const MARA = '+ party Mara | class: I | best: int';
const lines = host => (host.sdk.query('reply.changes', {})?.lines ?? []).map(entry => entry.line);

test('Ask › Add to party: This reply says "Mara joined the party"; a reload keeps it, a swipe takes it away', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Mara walks in.', reply(MARA));
    assert.equal(lines(host).includes('Mara joined the party'), false, 'only offered so far');
    const added = await host.sdk.command(JOIN_ADD, host.sdk.query('rpg.joins', {})[0], { cause: 'ui' });
    assert.equal(added.ok, true, added.message);
    assert.equal(lines(host).includes('Mara joined the party'), true);
    await rebuilt(host, 'after Add to party');
    assert.equal(lines(host).includes('Mara joined the party'), true, 'after a reload');
    await host.swipe('Nobody comes.');
    assert.equal(lines(host).includes('Mara joined the party'), false);
});

test('Ask › Edit first › Create (the wizard defines the Character itself): This reply says "Mara joined the party"', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Mara walks in.', reply(MARA));
    const edit = joinCardOf(host).actions.find(action => action.id === 'edit');
    const defs = buildDefinitions(joinDraft(edit.payload), { used: Object.keys(host.head().domains.dataModules.active) });
    assert.equal((await host.sdk.command('dm.define', { definition: defs.character }, { cause: 'ui' })).ok, true);
    assert.equal(lines(host).filter(line => line === 'Mara joined the party').length, 1);
    await rebuilt(host, 'after Edit first');
    assert.equal(lines(host).includes('Mara joined the party'), true, 'after a reload');
});

test('No, and a block the reader makes that no offer names, add no join line', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Mara walks in.', reply(MARA));
    assert.equal((await host.sdk.command(JOIN_NO, { name: 'Mara' }, { cause: 'ui' })).ok, true);
    const defs = buildDefinitions(joinDraft({ name: 'Ren', soul: 1, best: 'str' }), { used: Object.keys(host.head().domains.dataModules.active) });
    assert.equal((await host.sdk.command('dm.define', { definition: defs.character }, { cause: 'ui' })).ok, true);
    assert.deepEqual(lines(host).filter(line => /joined the party/.test(line)), []);
});

test('a reply whose only reader receipt is a block no offer names still has no This reply answer (null), as before', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Quiet.', 'Nothing happens.');
    const defs = buildDefinitions(joinDraft({ name: 'Ren', soul: 1, best: 'str' }), { used: Object.keys(host.head().domains.dataModules.active) });
    assert.equal((await host.sdk.command('dm.define', { definition: defs.character }, { cause: 'ui' })).ok, true);
    assert.equal(host.sdk.query('reply.changes', {}), null);
});
