// SOAK2UI 3: a companion's offer stays open (Now › Needs you) until Add to party or No answers it, however many replies came after;
// read from receipts, so swipe, middle delete, edited Re-read, rewind, reload and chat change bring it and take it away with its reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOIN_ADD, JOIN_NO, openJoinOffers } from '../../../modules/rpg/join.js';
import { MARA, rebuilt, reply, skip, world } from './join.helpers.js';

const open = host => host.sdk.query('rpg.joinsOpen', {}).map(offer => offer.name);

test('an offer outlives its reply: still open after later replies, gone after No, and an Add closes it', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Two come.', reply(MARA, '+ party Ilse | class: II'));
    assert.deepEqual(open(host), ['Mara', 'Ilse']);
    await host.send('On.', 'Nothing more.');
    assert.deepEqual(host.sdk.query('rpg.joins', {}), [], 'the card under the latest reply is gone');
    assert.deepEqual(open(host), ['Mara', 'Ilse'], 'but the offers wait');
    await host.send('Still.', 'More walking.');
    assert.equal((await host.sdk.command(JOIN_NO, { name: 'Mara' })).ok, true);
    assert.deepEqual(open(host), ['Ilse'], 'No at a later reply closes the earlier offer');
    await rebuilt(host, 'after No');
    assert.deepEqual(open(host), ['Ilse']);
    const offer = host.sdk.query('rpg.joinsOpen', {})[0];
    assert.equal((await host.sdk.command(JOIN_ADD, offer)).ok, true);
    assert.deepEqual(open(host), [], 'Add closes it');
    await rebuilt(host, 'after Add');
});

test('a swipe, a middle delete and an edited Re-read of the offering reply take the offer with them; a reload keeps it', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Mara comes.', reply(MARA));
    const at = host.ctx.chat.length - 1;
    await host.send('On.', 'Nothing more.');
    await rebuilt(host, 'offer kept over a reload');
    assert.deepEqual(open(host), ['Mara']);
    // an edited Re-read that takes the line out
    host.ctx.chat[at].mes = 'Nobody comes.';
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(open(host), []);
    // and one that grows it back
    host.ctx.chat[at].mes = reply(MARA, '+ party Dov | class: I');
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(open(host), ['Mara', 'Dov']);
    // a middle delete of the offering reply
    await host.st.deleteMessage(at);
    assert.deepEqual(open(host), []);
    await rebuilt(host, 'after the delete');
    // a swipe of the head reply that offered
    await host.send('Ilse comes.', reply('+ party Ilse | class: II'));
    assert.deepEqual(open(host), ['Ilse']);
    await host.swipe('Nobody.');
    assert.deepEqual(open(host), []);
    await rebuilt(host, 'after the swipe');
});

test('openJoinOffers: a re-offer after an answer opens again; a bench choice, a return or a name in the party closes; a full-party offer is left to its card', () => {
    const at = (index, join) => ({ index, receipt: { data: { join } } });
    const offer = name => ({ op: 'offer', name, soul: 2, best: 'int' });
    assert.deepEqual(openJoinOffers([at(1, offer('Mara')), at(2, { op: 'no', name: 'mara' }), at(3, offer('Mara'))]).map(item => item.name), ['Mara']);
    assert.deepEqual(openJoinOffers([at(1, offer('Mara')), at(2, { op: 'added', name: 'Mara' })]), []);
    assert.deepEqual(openJoinOffers([at(1, offer('Mara')), at(2, { op: 'back', name: 'Mara' })]), []);
    assert.deepEqual(openJoinOffers([at(1, offer('Mara'))], [{ name: 'Mara', left: false }]), []);
    assert.deepEqual(openJoinOffers([at(1, offer('Mara'))], [{ name: 'Mara', left: true }]).map(item => item.name), ['Mara']);
    assert.deepEqual(openJoinOffers([at(1, { ...offer('Torka'), full: true })]), []);
    assert.deepEqual(openJoinOffers(null), []);
});
