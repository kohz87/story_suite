// A cast member's v1 skill types reach the Skills block (a join and a return), and replay equals live: rebuild, reload, Re-read (also of an edited reply), swipe and swipe back, delete in the middle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, reply, person, world, fieldsOf, bytes } from './cast-skills.helpers.js';

const SKILLS = [
    { name: 'Mending Prayer', about: 'Closes a wound.', stat: 'wis', uses: 'mp', type: 'heal', rank: 'adept' },
    { name: 'Wild Surge', about: 'Hits every foe in reach.', stat: 'int', uses: 'mp', type: 'area' },
    { name: 'Gentle Word', about: 'Talks people round.', stat: 'cha', type: 'utility' },
    { name: 'Plain Cut', about: 'A cut.', stat: 'str' },
];
const typesOf = fields => [1, 2, 3, 4, 5].map(n => [fields[`skill${n}`], fields[`type${n}`]]).filter(([name]) => name);
const EXPECTED = [['Mending Prayer', 'heal'], ['Wild Surge', 'area'], ['Gentle Word', 'utility'], ['Plain Cut', 'attack']];

test('a join writes each skill with its v1 type (attack when the pack names none), and a rebuild, a reload and a Re-read keep them', { skip }, async t => {
    const host = await world(t, { list: [person({ skills: SKILLS })] });
    await host.send('Mara walks in.', reply('+ party Mara'));
    assert.deepEqual(typesOf(fieldsOf(host, 'mara-skills')), EXPECTED);
    const live = bytes(host);
    host.store.rebuild();
    assert.equal(bytes(host), live, 'a rebuild equals live');
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(bytes(host), live, 'a reload equals live');
    assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
    assert.equal(bytes(host), live, 'a Re-read seeds what the reply seeded');
    assert.deepEqual(host.store.problems(), []);
});

test('swipe and swipe back, an edited Re-read (grown) and a delete in the middle keep the typed skills as the live join wrote them', { skip }, async t => {
    const host = await world(t, { list: [person({ skills: SKILLS })] });
    await host.send('Mara walks in.', reply('+ party Mara'));
    const at = host.ctx.chat.length - 1;
    const joined = bytes(host);
    await host.swipe(reply('Nobody after all.', '+ coin 1'));
    assert.equal(fieldsOf(host, 'mara-skills'), undefined, 'a swipe takes the join and its typed skills away together');
    await host.swipe(reply('Mara walks in.', '+ party Mara'));
    assert.deepEqual(typesOf(fieldsOf(host, 'mara-skills')), EXPECTED, 'swipe back');
    assert.equal(bytes(host), joined, 'swipe back equals the first live join');
    // an edited Re-read: the reply grows (a line after the join)
    host.ctx.chat[at].mes = reply('+ party Mara', '+ coin 5');
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(typesOf(fieldsOf(host, 'mara-skills')), EXPECTED, 'grown: the same typed skills, none twice');
    await host.send('More.', reply('+ coin 2'));
    await host.send('Even more.', reply('+ coin 3'));
    const live = bytes(host);
    host.store.rebuild();
    assert.equal(bytes(host), live, 'rebuild after the later replies');
    await host.st.deleteMessage(at);
    assert.equal(fieldsOf(host, 'mara-skills'), undefined, 'the join deleted from the middle takes its skills; the later replies replay');
    assert.deepEqual(host.store.problems(), []);
});

test('an edited Re-read that shrinks the reply (the join line is gone) takes the join and its typed skills away, and the chat still rebuilds to the same bytes', { skip }, async t => {
    const host = await world(t, { list: [person({ skills: SKILLS })] });
    await host.send('Mara walks in.', reply('+ party Mara'));
    const at = host.ctx.chat.length - 1;
    host.ctx.chat[at].mes = reply('+ coin 5');
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(fieldsOf(host, 'mara-skills'), undefined, 'shrunk: no join, no skills');
    const live = bytes(host);
    host.store.rebuild();
    assert.equal(bytes(host), live);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(bytes(host), live, 'a reload equals live');
});
