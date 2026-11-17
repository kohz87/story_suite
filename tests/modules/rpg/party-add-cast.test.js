// "Add to party" for a pack's cast member carries the same signature skills as the reply's card (so Edit first keeps them marked), and a chat change answers for the chat it lands on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOIN_ADD } from '../../../modules/rpg/join.js';
import { skip, reply, world, person, SKILLS, fieldsOf } from '../../core/cast-skills.helpers.js';

test('a cast member from a pack: the People card and the reply card give the same payload, skills included, and Add seeds them', { skip }, async t => {
    const host = await world(t, { list: [person({ skills: SKILLS })], join: 'ask' });
    await host.send('Mara walks in.', reply('+ party Mara'));
    const [story] = host.sdk.query('rpg.joins', {});
    assert.ok(story.skills?.length, 'the reply\'s offer carries the pack skills');
    const page = host.sdk.query('rpg.partyAdd', { name: 'Mara' });
    assert.deepEqual(page.card.actions[1].payload, { name: 'Mara', soul: story.soul, best: story.best, skills: story.skills }, 'Edit first: the same payload');
    assert.deepEqual(page.card.actions[0].payload, page.card.actions[1].payload);
    // a person the pack does not know has no skills in the payload
    assert.equal('skills' in host.sdk.query('rpg.partyAdd', { name: 'Stranger' }).card.actions[1].payload, false);
    const added = await host.sdk.command(JOIN_ADD, page.card.actions[0].payload, { cause: 'ui' });
    assert.equal(added.ok, true, added.message);
    assert.ok(fieldsOf(host, 'mara-skills'), 'Mara\'s Skills block was made with her pack skills');
});

test('a chat change: the query answers for the chat it lands on, and coming back gives the same story', { skip }, async t => {
    const host = await world(t, { join: 'ask' });
    await host.send('Mara waits.', 'Mara waits at the gate.');
    const added = await host.sdk.command(JOIN_ADD, host.sdk.query('rpg.partyAdd', { name: 'Mara' }).card.actions[0].payload, { cause: 'ui' });
    assert.equal(added.ok, true, added.message);
    assert.equal(host.sdk.query('rpg.partyAdd', { name: 'Mara' }), null);
    const live = JSON.stringify(host.head()), saved = JSON.parse(JSON.stringify(host.ctx.chat));
    await host.st.loadChat([{ name: 'Narrator', is_user: false, mes: 'A different chat.', extra: {} }]);
    assert.notEqual(host.sdk.query('rpg.partyAdd', { name: 'Mara' }), null, 'the other chat has no Mara in its party');
    await host.st.loadChat(saved);
    assert.equal(JSON.stringify(host.head()), live, 'back in the first chat: the same story');
    assert.equal(host.sdk.query('rpg.partyAdd', { name: 'Mara' }), null);
});
