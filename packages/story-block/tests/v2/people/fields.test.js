// people.fields: a module's own command writes a person's story fields (NPC State's `~ npc` labels); a reader's button or a page cannot, only the listed
// fields are taken, it is not a reader edit, and an unknown person refuses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { readRecord } from '../../../../../core/persist.js';

const view = { v: 1, order: ['npc_ann'], npcs: { npc_ann: { id: 'npc_ann', name: 'Ann' } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {} };
const caller = { id: 'x', name: 'X', commands: { 'x.set': (ctx, p) => { ctx.call('people.fields', p); return { summary: 'set' }; } } };

test('only a module\'s command may write story fields; the fields are listed ones; it is not a reader edit', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [caller] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    const s = host.store.sourceAt(host.store.headIndex());
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: s.sid, swipeKey: s.swipeKey }, view })).ok, true);
    assert.equal((await host.sdk.command('people.fields', { id: 'npc_ann', fields: { goal: 'x' } })).ok, false, 'a reader or page cannot send it');
    assert.equal((await host.sdk.command('x.set', { id: 'npc_ann', fields: { goal: 'find the courier', location: 'the dock', appearance: 'a red coat' } })).ok, true);
    const ann = () => host.head().domains.people.npcs.npc_ann;
    assert.deepEqual([ann().goal, ann().location, ann().appearance], ['find the courier', 'the dock', 'a red coat']);
    assert.equal((await host.sdk.command('x.set', { id: 'npc_ann', fields: { goal: null } })).ok, true);
    assert.equal(Object.hasOwn(ann(), 'goal'), false);
    assert.notEqual((await host.sdk.command('x.set', { id: 'npc_ann', fields: { name: 'Bo' } })).ok, true, 'name is not a story field');
    assert.notEqual((await host.sdk.command('x.set', { id: 'npc_nobody', fields: { goal: 'x' } })).ok, true);
    const record = readRecord(host.ctx.chat[host.store.headIndex()]);
    assert.equal(record.receipts.some(receipt => receipt.data?.edit === true), false);
});
