// N4: a module's command (the RPG's write-back, R2) may write the story facts people.fields lists, and nothing else: Level only up, abilities and keepsakes on
// the built-in lists. The stored dossier is what a rebuild from the change sets gives, through a swipe and back, a rewind and a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';

const view = { v: 1, order: ['npc_ann'], npcs: { npc_ann: { id: 'npc_ann', name: 'Ann' } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {} };
const sheet = { id: 'sheet', name: 'Sheet', commands: { 'sheet.back': (ctx, p) => { ctx.call('people.fields', p); return { summary: 'written back' }; } } };
const people = host => JSON.stringify(host.head().domains.people);
const ann = host => host.head().domains.people.npcs.npc_ann;

test('the write-back is accepted as story facts: Level only up, an ability, a keepsake in and out; replay equals live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [sheet] });
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    const source = host.store.sourceAt(host.store.headIndex());
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view })).ok, true);
    const back = fields => host.sdk.command('sheet.back', { id: 'npc_ann', fields });
    assert.equal((await back({ level: '4', learns: 'Ward — turns a blow aside', keepsake: '+ Brass key — a cellar key' })).ok, true);
    assert.equal(ann(host).level, 4);
    assert.deepEqual(ann(host).abilities, [{ name: 'Ward', description: 'turns a blow aside' }]);
    assert.deepEqual(ann(host).keepsakes, [{ name: 'Brass key', description: 'a cellar key' }]);
    await back({ level: '3' });
    assert.equal(ann(host).level, 4, 'a lower Level is not written');
    await back({ level: '6', keepsake: '- brass key' });
    assert.equal(ann(host).level, 6);
    assert.equal(ann(host).keepsakes, undefined);
    assert.notEqual((await back({ hp: '10' })).ok, true, 'a number the sheet owns is not a story fact');
    assert.notEqual((await host.sdk.command('people.fields', { id: 'npc_ann', fields: { level: '9' } })).ok, true, 'a page cannot send it');
    const live = people(host);
    host.store.rebuild();
    assert.equal(people(host), live, 'a rebuild equals live');
    await host.turn.onChatChanged();
    assert.equal(people(host), live, 'a reload equals live');
});
