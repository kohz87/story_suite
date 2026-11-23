// `gear.wear { recorded: true }` is accepted from the RPG and from a module whose feature replaces it and is on; any other module is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { reply, equip, wear } from './gear-inventory.helpers.js';

const plug = (id, replaces) => ({
    id, name: id, version: '0.0.0',
    features: [{ id: `${id}.on`, label: id, default: false, ...(replaces ? { replaces } : {}) }],
    capture: {
        kinds: { smash: { grammar: '~ smash it', feature: `${id}.on` } },
        apply: ctx => ctx.call('gear.wear', { owner: 'party', slot: 'weapon', steps: 1, recorded: true }),
    },
});
const REPLACER = plug('zz-replacer', ['story-block.rpg']);
const OTHER = plug('zz-other', ['story-block.something']);
const LOOT = ['+ item Iron Sword | slot: weapon'];

async function play(t, modules, features) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules, settings: { features: { 'story-block.gear': true, ...features } } });
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Loot.', reply('A sword.', LOOT));
    await equip(host, 'Iron Sword');
    return host;
}
const condOf = host => host.sdk.query('gear.view', { owner: 'party' })?.slots.weapon?.word;

test('a module whose feature replaces the RPG and is on wears gear by its record, in the reply that caused it', async t => {
    const host = await play(t, [REPLACER], { 'zz-replacer.on': true });
    assert.equal(condOf(host), 'good');
    await host.send('Fight.', reply('A blow.', ['~ smash it']));
    assert.equal(condOf(host), 'worn');
    assert.deepEqual(host.store.problems(), []);
});

test('the same wear is refused while the replacing feature is off', async t => {
    const host = await play(t, [REPLACER], { 'zz-replacer.on': false, 'story-block.rpg': true });
    await host.send('Fight.', reply('A blow.', ['~ smash it']));
    assert.equal(condOf(host), 'good');
});

test('a module that replaces something else, or nothing, is refused the recorded flag', async t => {
    for (const mod of [OTHER, plug('zz-plain', null)]) {
        const host = await play(t, [mod], { [`${mod.id}.on`]: true, 'story-block.rpg': true });
        await host.send('Fight.', reply('A blow.', ['~ smash it']));
        assert.equal(condOf(host), 'good', mod.id);
    }
});

test('the replacer\'s wear is the reply\'s: a swipe, a Re-read and a middle delete give the same condition as live', async t => {
    const host = await play(t, [REPLACER], { 'zz-replacer.on': true });
    await host.send('Fight.', reply('A blow.', ['~ smash it']));
    const at = host.ctx.chat.length - 1;
    assert.equal(condOf(host), 'worn');
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(condOf(host), 'worn', 'a Re-read wears it once');
    host.store.rebuild();
    assert.equal(condOf(host), 'worn', 'a rebuild');
    await host.swipe(reply('Another way.', []));
    assert.equal(condOf(host), 'good', 'a swipe without the line takes the wear back');
    await host.st.swipeTo(at, 0);
    assert.equal(condOf(host), 'worn', 'and back');
    await host.send('Later.', reply('Nothing.', []));
    await host.st.deleteMessage(host.ctx.chat.findIndex(message => message.mes.includes('A blow.')));
    assert.equal(condOf(host), 'good', 'a middle delete');
    assert.deepEqual(host.store.problems(), []);
    assert.ok(wear(host, 'Iron Sword'));
});
