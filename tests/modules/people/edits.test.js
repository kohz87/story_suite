// The reader's narrow people edits: people.edit, people.follow and people.portrait.set change one record on the head's reply, show on the reply card
// as reader edits (data.edit), refuse an unknown person, an id change and image bytes, and replay like any other write.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { readRecord } from '../../../core/persist.js';
import { replyEdits } from '../../../ui/legacy/reply-cards.js';
import { carriers, rebuildAt } from '../../suite/qa/helpers/oracle.js';

const plain = value => (value === undefined ? null : JSON.parse(JSON.stringify(value)));
const view = { v: 1, order: ['npc_ann'], npcs: { npc_ann: { id: 'npc_ann', name: 'Ann', role: 'smith' } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 1 };

async function rig(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    const s = host.store.sourceAt(host.store.headIndex());
    const out = await host.sdk.command('people.write', { v: 1, source: { sid: s.sid, swipeKey: s.swipeKey }, view });
    assert.equal(out.ok, true);
    return host;
}
const ann = host => host.head().domains.people.npcs.npc_ann;

test('edit, follow and a portrait change the record and are listed as reader edits', async t => {
    const host = await rig(t);
    assert.equal((await host.sdk.command('people.edit', { id: 'npc_ann', fields: { role: 'baker', goal: 'open a shop' } })).ok, true);
    assert.equal((await host.sdk.command('people.follow', { id: 'npc_ann', on: true })).ok, true);
    const ref = { path: 'user/files/ann.png', type: 'image/png', hash: 'h1' };
    assert.equal((await host.sdk.command('people.portrait.set', { id: 'npc_ann', portrait: ref })).ok, true);
    assert.equal(ann(host).role, 'baker');
    assert.equal(ann(host).goal, 'open a shop');
    assert.equal(ann(host).followed, true);
    assert.deepEqual(host.head().domains.people.portraitAssets.npc_ann, ref);
    const record = readRecord(host.ctx.chat[host.store.headIndex()]);
    const types = record.receipts.filter(receipt => receipt.data?.edit === true).map(receipt => receipt.type);
    assert.deepEqual(types, ['people.edit', 'people.follow', 'people.portrait.set']);
    assert.equal(replyEdits(record).length, 3);
    assert.equal((await host.sdk.command('people.follow', { id: 'npc_ann', on: false })).ok, true);
    assert.equal(Object.hasOwn(ann(host), 'followed'), false);
    assert.equal((await host.sdk.command('people.edit', { id: 'npc_ann', fields: { goal: null } })).ok, true);
    assert.equal(Object.hasOwn(ann(host), 'goal'), false);
    for (const index of carriers(host.ctx.chat)) assert.deepEqual(plain(host.store.at(index)), plain(rebuildAt(host.ctx.chat, index).state), `carrier ${index}`);
});

test('an unknown person, an id change, a bad field and image bytes are refused and change nothing', async t => {
    const host = await rig(t);
    const before = plain(host.head().domains.people);
    assert.equal((await host.sdk.command('people.edit', { id: 'npc_bo', fields: { role: 'x' } })).code, 'REFUSED');
    assert.equal((await host.sdk.command('people.edit', { id: 'npc_ann', fields: { id: 'npc_x' } })).code, 'INVALID');
    assert.equal((await host.sdk.command('people.edit', { id: 'npc_ann', fields: { 'a/b': 1 } })).code, 'INVALID');
    assert.equal((await host.sdk.command('people.edit', { id: 'npc_ann', fields: { face: 'data:image/png;base64,AAAA' } })).ok, false);
    assert.equal((await host.sdk.command('people.portrait.set', { id: 'npc_ann', portrait: { dataUrl: 'data:image/png;base64,AAAA' } })).ok, false);
    assert.equal((await host.sdk.command('people.follow', { id: 'npc_ann', on: 'yes' })).code, 'INVALID');
    assert.deepEqual(plain(host.head().domains.people), before);
});
