// "Add to party": a chat change answers for the chat it lands on (a person's skills come from their NPC State record now; join-pull.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOIN_ADD } from '../../../modules/rpg/join.js';
import { skip, world } from '../../core/cast-skills.helpers.js';

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
