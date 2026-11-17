// "Add to party" on a People page: rpg.partyAdd gives the join card for a person the story holds (not You, not in the party, not one who left, room for 4 active),
// and the card's Add is the same dm.join a reply's card sends, so it replays as live (swipe, swipe back, middle delete, rewind, Re-read, reload).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOIN_ADD, joinCard, partyAdd } from '../../../modules/rpg/join.js';
import { fakeState, characterDefinition } from './view/helpers.js';
import { MARA, blocks, fields, reply, rebuilt, skip, world, active } from './join.helpers.js';

const member = (slug, who, fieldsMore = {}) => ({ definition: { ...characterDefinition(slug, who), role: 'character', state: { left: { type: 'bool' } } }, fields: { who, ...fieldsMore } });
const party = (...names) => fakeState(names.map((who, at) => member(`m${at}`, who)));

test('partyAdd: the card for someone who may join, and nothing for You, a member, one who left, a full party or a bad name', () => {
    const state = party('Wessel', 'Ren');
    const offer = partyAdd(state, 'Mara');
    assert.deepEqual([offer.name, offer.soul, offer.best], ['Mara', 1, '']);
    assert.deepEqual(offer.card, joinCard([{ name: 'Mara', soul: 1, best: '' }], state), 'the card is the one a + party line gives');
    assert.deepEqual(offer.card.actions.map(action => [action.label, action.command ?? action.open]), [['Add to party', JOIN_ADD], ['Edit first', 'story-block/new-character'], ['No', 'rpg.joinNo']]);
    assert.equal(partyAdd(state, 'Wessel', name => name === 'Wessel'), null, 'You');
    assert.equal(partyAdd(state, 'ren'), null, 'already in the party');
    assert.equal(partyAdd(fakeState([member('m0', 'Wessel'), member('m1', 'Ren', { left: true })]), 'Ren'), null, 'one who left is a return, not an add');
    assert.equal(partyAdd(party('A', 'B', 'C', 'D'), 'Mara'), null, 'no room: 4 active');
    assert.notEqual(partyAdd(party('A', 'B', 'C'), 'Mara'), null, 'room for the fourth');
    assert.equal(partyAdd(state, '   '), null, 'no name');
    assert.equal(partyAdd(state, 'x'.repeat(200)), null, 'a name too long for a Character');
});

test('Add to party from a People page: dm.join with the card payload, then replays as live (swipe, swipe back, middle delete, rewind, Re-read, reload)', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Mara waits.', 'Mara waits at the gate.');
    const offer = host.sdk.query('rpg.partyAdd', { name: 'Mara' });
    assert.equal(offer.card.actions[0].command, JOIN_ADD);
    assert.equal(host.sdk.query('rpg.partyAdd', { name: 'Wessel' }), null, 'already in the party');
    const added = await host.sdk.command(JOIN_ADD, offer.card.actions[0].payload, { cause: 'ui' });
    assert.equal(added.ok, true, added.message);
    assert.deepEqual(blocks(host), ['pack.chat/mara', 'pack.chat/mara-skills', 'pack.chat/wessel', 'pack.chat/wessel-skills']);
    assert.equal(host.sdk.query('rpg.partyAdd', { name: 'Mara' }), null, 'in the party now: no button');
    await rebuilt(host, 'after Add to party');
    const joined = JSON.stringify(host.head());
    await host.swipe('Nobody waits.');
    assert.deepEqual(blocks(host), ['pack.chat/wessel', 'pack.chat/wessel-skills'], 'a swipe takes the add with the reply');
    assert.notEqual(host.sdk.query('rpg.partyAdd', { name: 'Mara' }), null, 'and the button is back');
    await rebuilt(host, 'swipe');
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(JSON.stringify(host.head()), joined, 'swipe back: the add is back');
    // an edited Re-read of the reply keeps the click, grown and shrunk
    const at = host.ctx.chat.length - 1, text = host.ctx.chat[at].mes;
    host.ctx.chat[at].mes = `${text} She nods.`;
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(active(host), 2, 'grown Re-read');
    host.ctx.chat[at].mes = text;
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(JSON.stringify(host.head()), joined, 'shrunk Re-read');
    await rebuilt(host, 'Re-read');
    // rewind: a branch at the reply holds the add; a middle delete of the opening reply leaves it
    assert.ok(await host.ctx.branchChat(at));
    assert.equal(blocks(host).includes('pack.chat/mara'), true, 'rewind');
    await rebuilt(host, 'rewind');
    await host.st.deleteMessage(1);
    assert.equal(fields(host, 'mara') !== undefined, true, 'a middle delete');
    await rebuilt(host, 'middle delete');
});

test('a story offer and the page agree: the same payload as the reply card for the same person', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Mara comes.', reply(MARA.replace(/ \| about.*$/, '')));
    const page = host.sdk.query('rpg.partyAdd', { name: 'Mara' });
    const [story] = host.sdk.query('rpg.joins', {});
    assert.deepEqual(page.card.actions[0].payload, { name: story.name, soul: story.soul, best: story.best }, 'Add sends what the reply\'s card sends for a line with no class or best');
});
