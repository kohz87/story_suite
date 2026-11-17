import test from "node:test";
import assert from "node:assert/strict";
import { PARTY_ACTIVE } from "../../../modules/rpg/names.js";
import { JOIN_ADD, JOIN_BENCH, JOIN_NO, benchable, checkJoin, joinCard, joinGrammar, joinGrammarOwn, partyOf } from "../../../modules/rpg/join.js";
import { LEAN_RPG_TEMPLATES } from "./fixtures/templates-2.16.js";
import * as leanRpg from "../../../modules/rpg/index.js";
import { fakeState, characterDefinition } from "./view/helpers.js";
import { TORKA, active, four, joinCardOf, lastReceipts, names, problems, rebuilt, reply, settled, skip, world } from "./join.helpers.js";

// ---- a full party asks who to bench (partyFour: 4 active, the reader's character included) -------------------------------------------------

test('partyFour: the active limit is 4 on a reply with the new mark, 8 on a reply with only partyRoom, and checkJoin says a full party is `full`', () => {
    const character = (slug, who, fields = {}) => ({ definition: { ...characterDefinition(slug, who), role: 'character', state: { left: { type: 'bool' } } }, fields: { who, ...fields } });
    const request = name => ({ op: '+', name, about: '', soul: 1, best: '' });
    const members = n => fakeState(Array.from({ length: n }, (_, at) => character(`m${at}`, `M${at}`)));
    assert.equal(PARTY_ACTIVE, 4);
    assert.deepEqual(checkJoin(members(4), request('New'), undefined, PARTY_ACTIVE), { ok: false, full: true, why: 'the party is full (4 active); someone must leave first' });
    assert.equal(checkJoin(members(3), request('New'), undefined, PARTY_ACTIVE).ok, true);
    assert.equal(checkJoin(members(4), request('New')).ok, true, 'the limit of 8 stays the default (a reply with only partyRoom)');
    assert.equal(checkJoin(members(8), request('New')).full, true);
    const gone = fakeState([...Array.from({ length: 4 }, (_, at) => character(`m${at}`, `M${at}`)), character('ren', 'Ren', { left: true })]);
    assert.deepEqual(checkJoin(gone, request('Ren'), undefined, PARTY_ACTIVE), { ok: false, full: true, back: true, why: 'the party is full (4 active); someone must leave first' }, 'a return meets the limit too');
    // the reader's character is never offered: the one named like the persona, else the first block
    assert.deepEqual(benchable(members(4), name => name === 'M2').map(entry => entry.name), ['M0', 'M1', 'M3']);
    assert.deepEqual(benchable(members(4)).map(entry => entry.name), ['M1', 'M2', 'M3'], 'nobody named: the first block is the reader\'s');
});

test('A long name in the bench card keeps its level', () => {
    const character = (slug, who) => ({ definition: { ...characterDefinition(slug, who), role: 'character', state: { left: { type: 'bool' } } }, fields: { who } });
    const long = 'Sir Bartholomew Featherstonehaugh-Wetherby the Third of Ersveil';
    assert.equal([...long].length >= 60, true);
    const state = fakeState([character('m0', 'M0'), character('m1', long), character('m2', 'Kel'), character('m3', 'M3')]);
    const card = joinCard([{ name: 'New', about: '', soul: 1, best: '', full: true }], state);
    const labels = card.actions.map(action => action.label);
    assert.match(labels[0], /^Sir Bartholomew.*… · Lv \d+$/);
    assert.equal([...labels[0]].length <= 32, true);
    assert.match(labels[1], /^Kel · Lv \d+$/, 'a short name is unchanged');
    // a name of astral characters (emoji) counts by code points in both places: it keeps " · Lv N"
    const emoji = fakeState([character('m0', 'M0'), character('m1', '🐉'.repeat(25)), character('m2', 'Kel'), character('m3', 'M3')]);
    const emojiLabel = joinCard([{ name: 'New', about: '', soul: 1, best: '', full: true }], emoji).actions[0].label;
    assert.match(emojiLabel, / · Lv \d+$/, 'an emoji name keeps its level');
    assert.equal([...emojiLabel].length <= 32, true);
    // a huge label is cut before it is spread into code points, and still comes out at 32
    const huge = joinCard([{ name: '🐉'.repeat(5000), about: '', soul: 1, best: '', full: true }], emoji).actions[0].label;
    assert.equal([...huge].length <= 32, true);
    // 5 active: the card keeps room for Not now
    const five = fakeState(['m0', 'm1', 'm2', 'm3', 'm4'].map(slug => character(slug, slug.toUpperCase())));
    const many = joinCard([{ name: 'New', about: '', soul: 1, best: '', full: true }], five).actions;
    assert.equal(many.length, 4);
    assert.equal(many.at(-1).command, JOIN_NO);
});

test('a full party shows the bench card: one button per active companion with their level, never the reader, and Not now', { skip }, async t => {
    const host = await four();
    t.after(() => host.close());
    await host.send('Torka walks in.', reply(TORKA));
    const card = joinCardOf(host);
    assert.equal(card.title, 'The party is full (4 active)');
    assert.equal(card.text, 'Bench one to let Torka Bloodsong in. They keep their level, XP, skills and gear, and can come back.');
    const levels = Object.fromEntries(partyOf(host.head()).map(person => [person.name, person.level]));
    assert.deepEqual(card.actions.map(action => action.label), [`Mara · Lv ${levels.Mara}`, `Ren · Lv ${levels.Ren}`, `Ilse · Lv ${levels.Ilse}`, 'Not now'], 'Wessel is the reader\'s: never offered');
    assert.deepEqual(card.actions.map(action => action.command), [JOIN_BENCH, JOIN_BENCH, JOIN_BENCH, JOIN_NO]);
    assert.equal(card.actions[0].payload.bench, 'Mara');
    assert.equal(card.actions[0].payload.name, 'Torka Bloodsong');
    assert.deepEqual(host.sdk.query('rpg.joins', {}).map(offer => [offer.name, offer.full]), [['Torka Bloodsong', true]]);
    const refused = await host.sdk.command(JOIN_BENCH, { ...card.actions[0].payload, bench: 'Wessel' });
    assert.equal(refused.ok, false, 'the reader\'s own character cannot be benched');
    assert.deepEqual(names(host), ['Wessel', 'Mara', 'Ren', 'Ilse']);
});

test('tapping a name benches that member (marked left, kept) and joins the newcomer in one action; the card then says so; a rebuild and a reload agree', { skip }, async t => {
    const host = await four();
    t.after(() => host.close());
    await host.send('Torka walks in.', reply(TORKA));
    const done = await host.sdk.command(JOIN_BENCH, joinCardOf(host).actions[1].payload);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(names(host), ['Wessel', 'Mara', 'Ilse', 'Torka Bloodsong']);
    assert.equal(partyOf(host.head()).find(person => person.name === 'Ren').left, true, 'Ren is kept, marked left');
    assert.equal(active(host), 4);
    assert.equal(joinCardOf(host).text, 'Ren left the party (benched) · Torka Bloodsong joined.');
    assert.deepEqual(joinCardOf(host).actions, []);
    await settled(host, 'after the bench choice');
});

test('Not now keeps the card: the newcomer is not joined and the bench buttons are still there later', { skip }, async t => {
    const host = await four();
    t.after(() => host.close());
    await host.send('Torka walks in.', reply(TORKA));
    assert.equal((await host.sdk.command(JOIN_NO, { name: 'Torka Bloodsong' })).ok, true);
    assert.deepEqual(names(host), ['Wessel', 'Mara', 'Ren', 'Ilse']);
    const card = joinCardOf(host);
    assert.equal(card.text, 'Torka Bloodsong did not join. You can still bench someone here later.');
    assert.deepEqual(card.actions.map(action => action.command), [JOIN_BENCH, JOIN_BENCH, JOIN_BENCH]);
    const done = await host.sdk.command(JOIN_BENCH, card.actions[2].payload);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(names(host), ['Wessel', 'Mara', 'Ren', 'Torka Bloodsong']);
    await settled(host, 'bench after Not now');
});

test('a return to a full party asks too: benching a member brings the one who left back', { skip }, async t => {
    const host = await four();
    t.after(() => host.close());
    await host.send('Ren goes.', reply('- party Ren'));
    await host.send('Kit joins.', reply('+ party Kit'));
    assert.equal(active(host), 4);
    await host.send('Ren is back.', reply('+ party Ren'));
    assert.deepEqual(host.sdk.query('rpg.joins', {}).map(entry => [entry.name, entry.full, entry.back]), [['Ren', true, true]]);
    assert.equal(partyOf(host.head()).find(person => person.name === 'Ren').left, true, 'still away');
    const done = await host.sdk.command(JOIN_BENCH, joinCardOf(host).actions[0].payload);
    assert.equal(done.ok, true, done.message);
    assert.match(joinCardOf(host).text, /^\S+ left the party \(benched\) · Ren joined\.$/);
    assert.equal(partyOf(host.head()).find(person => person.name === 'Ren').left, false, 'Ren is back');
    assert.equal(active(host), 4);
    await settled(host, 'a return by bench');
});

test('the bench action replays like other reader actions: a rebuild and a reload agree, and deleting the earlier reply that filled the party skips it, leaving the newcomer\'s offer to be added', { skip }, async t => {
    const host = await four();
    t.after(() => host.close());
    const joined = host.ctx.chat.length - 1;   // Ilse's reply (the party's 4th)
    await host.send('Torka walks in.', reply(TORKA));
    const done = await host.sdk.command(JOIN_BENCH, joinCardOf(host).actions[0].payload);
    assert.equal(done.ok, true, done.message);
    await settled(host, 'the bench action');
    await host.st.deleteMessage(joined);
    await settled(host, 'after deleting the reply that filled the party');
    assert.equal(names(host).includes('Torka Bloodsong'), false, 'the bench action relied on a full party: it is skipped, not applied to a party with room');
    assert.equal(partyOf(host.head()).find(person => person.name === 'Mara')?.left, false, 'Mara was not benched');
    const card = joinCardOf(host);
    assert.equal(card.title, 'Torka Bloodsong joins the party', 'with room again the offer is an ordinary Ask card');
    assert.equal(card.actions[0].command, JOIN_ADD);
    const stale = await host.sdk.command(JOIN_BENCH, { name: 'Torka Bloodsong', bench: 'Mara' });
    assert.equal(stale.ok, false, 'a stale bench button: there is room now, nobody steps out');
    assert.match(stale.message, /room now/);
});

test('partyFields: the + party grammar names the story\'s own class field in a chat under the mark; a chat begun before keeps the earlier text, byte for byte', { skip }, async t => {
    const sent = host => host.st.requests.at(-1).chat.find(message => message.role === 'system').content.split('\n').find(line => line.startsWith('+ party Mara'));
    const names = { 1: 'Novice', 2: 'Adept', 3: 'Master', 4: 'Sage', 5: 'Hero', 6: 'Legend', 7: 'Myth', 8: 'Titan', 9: 'Mythic' };
    async function story() {
        const host = await world({ wessel: false });
        t.after(() => host.close());
        const def = structuredClone(LEAN_RPG_TEMPLATES.find(entry => entry.definition.role === 'character').definition);
        def.state.soul.label = 'Rank';
        def.state.soul.names = names;
        assert.equal((await host.sdk.command('dm.define', { definition: def })).ok, true);
        return host;
    }
    const fresh = await story();
    await fresh.send('Onward.', 'The road.');
    assert.match(sent(fresh), /\| class: Novice \|.*class Novice to Mythic,/);
    assert.equal(joinGrammarOwn(leanRpg.soulNaming(fresh.head())), sent(fresh));
    const old = await story();
    for (const message of old.ctx.chat) if (message.extra?.storySuite) delete message.extra.storySuite.rules; // as a chat saved before the rule was
    old.store.rebuild();
    await old.send('Onward.', 'The road.');
    assert.equal(sent(old), joinGrammar(), 'the first reply has no mark: the earlier line');
    await old.send('Again.', 'The road.');
    assert.equal(sent(old), joinGrammar());
    const plain = await world();
    await plain.send('Onward.', 'The road.');
    assert.equal(sent(plain), joinGrammar(), 'the template\'s own words give the earlier text, mark or not');
});
