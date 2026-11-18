// The Journal's Edit, Give up and Delete on a quest (`quest.edit`, `quest.giveup`, `quest.delete`): each changes the quest, and a fresh load of the chat gives the same state (replay == live), also after a swipe.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';

const said = (text, lines = []) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const QUEST = '+ quest Salt caravan escort — guard the salt wagons | giver: Mira | due: December 5 | reward: 20 gold';

async function setUp() {
    const host = await createHost({ modules: [createModule()] });
    await host.send('Hello.', said('The harbour.', ['~ time December 1, 1200, 08:00 am', QUEST]));
    const id = host.sdk.query('director.threads', { kind: 'quest' })[0].id;
    return { host, id, thread: () => host.sdk.query('director.thread', { id }) };
}

async function fresh(host) {
    const again = await createHost({ modules: [createModule()] });
    await again.st.loadChat(structuredClone(host.ctx.chat));
    assert.deepEqual(again.store.problems(), []);
    assert.equal(JSON.stringify(again.head().domains), JSON.stringify(host.head().domains), 'a fresh load == live');
    again.close();
}

test('quest.edit changes the title, summary, due and reward; the old title is free', async () => {
    const { host, id, thread } = await setUp();
    const answer = await host.sdk.command('quest.edit', { id, patch: { title: 'Salt run', summary: 'Guard the wagons.', due: 'December 9', reward: '' } });
    assert.equal(answer.ok, true, answer.message);
    assert.equal(thread().key, 'Salt run');
    assert.equal(thread().summary, 'Guard the wagons.');
    assert.equal(thread().fields.due, 'December 9');
    assert.equal(thread().fields.reward, undefined);
    assert.equal(host.sdk.query('director.thread', { key: 'Salt run' }).id, id);
    assert.equal(host.sdk.query('director.thread', { key: 'Salt caravan escort' }), null);
    await fresh(host);
    host.close();
});

test('quest.edit refuses a bad id, a blank title and a title another open thread has', async () => {
    const { host, id } = await setUp();
    await host.send('On.', said('The quay.', ['+ hook Old Debt — Mira owes the guild']));
    assert.equal((await host.sdk.command('quest.edit', { id: 'th_nothere', patch: {} })).ok, false);
    assert.equal((await host.sdk.command('quest.edit', { id, patch: { title: '   ' } })).ok, false);
    assert.equal((await host.sdk.command('quest.edit', { id, patch: { title: 'Old Debt' } })).ok, false);
    host.close();
});

test('quest.giveup closes the quest as given up, and the Journal lists it as closed', async () => {
    const { host, id, thread } = await setUp();
    assert.equal((await host.sdk.command('quest.giveup', { id })).ok, true);
    assert.equal(thread().status, 'resolved');
    assert.equal(thread().ended.outcome, 'abandoned');
    assert.equal((await host.sdk.command('quest.giveup', { id })).ok, false, 'not open any more');
    await fresh(host);
    host.close();
});

test('quest.delete removes the quest and frees its title; a swipe and a fresh load agree with live', async () => {
    const { host, id } = await setUp();
    assert.equal((await host.sdk.command('quest.delete', { id })).ok, true);
    assert.equal(host.sdk.query('director.thread', { id }), null);
    assert.equal(host.sdk.query('director.thread', { key: 'Salt caravan escort' }), null);
    await fresh(host);
    await host.swipe(said('The quay, again.', [QUEST]));
    await fresh(host);
    host.close();
});
