import test from "node:test";
import assert from "node:assert/strict";
import { STANDARD } from "../../../modules/rpg/rules.js";
import { PARTY_MAX, JOINS, JOIN_SETTING, LEAN_RPG_FEATURE } from "../../../modules/rpg/names.js";
import { DM_OLD_ROOM } from "../../../modules/data-modules/schema.js";
import { JOIN_ADD, JOIN_NO, checkJoin, joinCard, joinDefinitions, joinDraft, joinGrammar, joinMode, joinOffers, partyCap, partyOf, readJoin, soulOf } from "../../../modules/rpg/join.js";
import { STANDARD_TEMPLATES } from "../../../modules/rpg/templates.js";
import { partyLines } from "../../../modules/rpg/view/changes-lines.js";
import { fakeState, characterDefinition, skillsDefinition } from "./view/helpers.js";
import { MARA, blocks, fields, grammar, lastReceipts, make, problems, rebuilt, reply, skip, statics, world } from "./join.helpers.js";

// ---- the line, read ------------------------------------------------------------------------------------------------------------------

test('the party line is read: name, about (240, whole characters), class I to IX or 1 to 9, best one of the seven stats; plain errors for the rest', () => {
    const line = { op: '+', name: 'Mara', text: '', labels: { about: 'a hedge-witch', class: 'iv', best: 'INT' } };
    assert.deepEqual(readJoin(line), { op: '+', name: 'Mara', about: 'a hedge-witch', soul: 4, best: 'int' });
    assert.deepEqual(readJoin({ op: '+', name: ' Mara  Vell ', labels: {} }), { op: '+', name: 'Mara Vell', about: '', soul: 1, best: '' }, 'class and best are optional');
    assert.equal(readJoin({ op: '+', name: 'Mara', labels: { class: '7' } }).soul, 7);
    assert.equal(readJoin({ op: '-', name: 'Mara' }).op, '-');
    assert.match(readJoin({ op: '+', name: 'Mara', labels: { class: 'X' } }).error, /class must be a Soul Class from I to IX/);
    assert.match(readJoin({ op: '+', name: 'Mara', labels: { best: 'wits' } }).error, /best must be one of str, vit, agi, dex, int, luk, cha/);
    assert.match(readJoin({ op: '!', name: 'Mara', labels: {} }).error, /not a party line/);
    assert.match(readJoin({ op: '+', name: '', labels: {} }).error, /needs a name/);
    assert.match(readJoin({ op: '+', name: 'M'.repeat(41), labels: {} }).error, /at most 40 characters/);
    const long = readJoin({ op: '+', name: 'Mara', labels: { about: `${'a'.repeat(239)}\u{1F600}${'b'.repeat(20)}` } }).about;
    assert.equal([...long].length, 240, 'the first 240 characters');
    assert.equal(long.endsWith('\u{1F600}'), true, 'cut between characters, never inside one');
    assert.deepEqual(['I', 'ix', '1', '9', '0', '10', 'x', ''].map(soulOf), [1, 9, 1, 9, 0, 0, 0, 0]);
});

test('the setting: Ask by default, then Automatically or Off; anything else is Ask', () => {
    assert.deepEqual(JOINS, ['ask', 'auto', 'off']);
    assert.deepEqual([undefined, 'ask', 'auto', 'off', 'sometimes', null].map(value => joinMode({ [JOIN_SETTING]: value })), ['ask', 'ask', 'auto', 'off', 'ask', 'ask']);
    assert.equal(joinMode(undefined), 'ask');
    assert.equal(PARTY_MAX, 8);
    assert.match(joinGrammar(), /^\+ party Mara \| about: .* \| class: I \| best: int .*- party Mara when they leave$/);
    assert.equal(joinGrammar().includes('\n'), false, 'one line, as every kind\'s');
});

test('what a joining companion is made of: stats 5, the best one 9 and a point for every third level, no points left, Soul Class as given (capped by the party), an empty Skills block', () => {
    const draft = joinDraft({ name: 'Mara', about: 'a hedge-witch', soul: 4, best: 'int' }, STANDARD);
    assert.deepEqual([draft.kind, draft.name, draft.about, draft.level, draft.stats.int, draft.stats.str], ['companion', 'Mara', 'a hedge-witch', 35, 15, 5]);
    assert.equal(joinDraft({ name: 'Mara', best: 'wits' }, STANDARD).stats.int, 5, 'a best that is no stat raises nothing');
    const made = joinDefinitions({ name: 'Mara', about: 'a hedge-witch', soul: 4, best: 'int' }, { used: ['pack.chat/wessel'], soul: 3, rules: STANDARD });
    const state = made.character.state;
    assert.deepEqual([made.character.slug, made.character.role, state.int.default, state.vit.default, state.points.default, state.level.default, state.health.default, state.mana.default, state.stamina.default, state.left.default], ['mara', 'character', 13, 5, 0, 25, 10, 12, 10, false]);
    assert.equal(made.skills.role, 'skills');
    assert.equal(made.skills.state.who.default, 'Mara');
    for (let n = 1; n <= 5; n += 1) assert.equal(made.skills.state[`skill${n}`].default, '', `skill ${n} is empty`);
    assert.equal(joinDefinitions({ name: 'Mara', about: '', soul: 1, best: '' }, { used: ['pack.chat/mara'], rules: STANDARD }).character.slug, 'mara-2', 'a free slug');
});

test('checkJoin: the name is taken, the party is full (8 active; an old reply counts those who left), there is no room for two blocks, someone who left comes back, class is capped', () => {
    const character = (slug, who, fields = {}) => ({ definition: { ...characterDefinition(slug, who), role: 'character' }, fields: { who, ...fields } });
    const state = fakeState([character('wessel', 'Wessel', { soul: 3 }), character('ren', 'Ren', { soul: 2 })]);
    const request = (name, soul = 1) => ({ op: '+', name, about: '', soul, best: '' });
    assert.deepEqual(checkJoin(state, request('Mara', 9)), { ok: true, soul: 3 }, 'never above the party\'s highest');
    assert.deepEqual(checkJoin(state, request('Mara', 2)), { ok: true, soul: 2 });
    assert.deepEqual(checkJoin(state, request('Mara')), { ok: true, soul: 1 });
    assert.match(checkJoin(state, request('  ren ')).why, /^Ren is already in the party\.$/, 'a name matches the way names always do');
    assert.deepEqual([partyOf(state).map(person => person.name), partyCap(partyOf(state)), partyCap([])], [['Wessel', 'Ren'], 3, 1]);
    const left = fakeState([character('wessel', 'Wessel', { soul: 3 }), character('ren', 'Ren', { soul: 2, left: true })]);
    assert.equal(checkJoin(left, request('Ren')).returning?.name, 'Ren');
    assert.equal(partyCap(partyOf(left)), 3);
    assert.equal(partyCap(partyOf(fakeState([character('ren', 'Ren', { soul: 5, left: true }), character('wessel', 'Wessel', { soul: 2 })]))), 2, 'who left does not set the cap');
    const eight = fakeState(Array.from({ length: 8 }, (_, n) => character(`c${n}`, `C${n}`)));
    assert.match(checkJoin(eight, request('Mara')).why, /^the party is full \(8 active\); someone must leave first$/);
    assert.match(checkJoin(eight, request('Mara'), DM_OLD_ROOM).why, /^the party is full \(8 characters, counting those who left\)$/, 'a reply from before the mark counts those who left');
    // The party limit counts members who are in it: eight sheets with one who left is seven active, so one more joins; the one who left comes back only when there is a spot.
    const seven = fakeState([...Array.from({ length: 7 }, (_, n) => character(`c${n}`, `C${n}`)), character('gone', 'Gone', { left: true })]);
    assert.equal(checkJoin(seven, request('Mara')).ok, true);
    assert.equal(checkJoin(seven, request('Mara'), DM_OLD_ROOM).ok, false, 'the old count: eight sheets');
    assert.equal(checkJoin(seven, request('Gone')).returning?.name, 'Gone');
    const full = fakeState([...Array.from({ length: 8 }, (_, n) => character(`c${n}`, `C${n}`)), character('gone', 'Gone', { left: true })]);
    assert.match(checkJoin(full, request('Gone')).why, /^the party is full \(8 active\); someone must leave first$/, 'a return with 8 active is refused');
    assert.equal(checkJoin(full, request('Gone'), DM_OLD_ROOM).returning?.name, 'Gone', 'an old reply still lets them back');
    const crowded = fakeState([...Array.from({ length: 4 }, (_, n) => character(`c${n}`, `C${n}`)), ...Array.from({ length: 4 }, (_, n) => ({ definition: { ...skillsDefinition(`s${n}`, `C${n}`), role: 'skills' }, fields: {} }))]);
    assert.match(checkJoin(crowded, request('Mara'), DM_OLD_ROOM).why, /^the story has no room for two more blocks \(at most 8\)/);
    assert.equal(checkJoin(crowded, request('Mara')).ok, true, 'the room is 20 own blocks now');
    const wide = fakeState([...Array.from({ length: 9 }, (_, n) => character(`c${n}`, `C${n}`)), ...Array.from({ length: 9 }, (_, n) => ({ definition: { ...skillsDefinition(`s${n}`, `C${n}`), role: 'skills' }, fields: {} }))]);
    assert.match(checkJoin(wide, request('Mara')).why, /^the party is full/, 'nine active: the party limit comes first');
    const filled = fakeState([...Array.from({ length: 4 }, (_, n) => character(`c${n}`, `C${n}`)), ...Array.from({ length: 16 }, (_, n) => ({ definition: { ...skillsDefinition(`s${n}`, `C${n}`), role: 'skills' }, fields: {} }))]);
    assert.match(checkJoin(filled, request('Mara')).why, /^the story has no room for two more blocks \(at most 20\)/);
});

// ---- Off, and the grammar ----------------------------------------------------------------------------------------------------------

test('the grammar: the + party line is there while the RPG is on, a character exists and the setting is not Off; never otherwise', { skip }, async t => {
    const asked = await world({ mode: 'ask' });
    const auto = await world({ mode: 'auto' });
    const off = await world({ mode: 'off' });
    const rpgOff = await world({ feature: false });
    const empty = await world({ wessel: false });
    t.after(() => [asked, auto, off, rpgOff, empty].forEach(host => host.close()));
    assert.deepEqual(grammar(asked), [joinGrammar()]);
    assert.deepEqual(grammar(auto), [joinGrammar()]);
    assert.deepEqual(grammar(off), [], 'Off: no party lines in the grammar');
    assert.deepEqual(grammar(rpgOff), [], 'the RPG off: not told');
    assert.deepEqual(grammar(empty), [], 'no character yet: nothing to join');
    assert.equal(statics(off).includes('+ party'), false);
    // Off: a line of it is not used and nothing is made.
    await off.send('Mara.', reply(MARA));
    assert.deepEqual(blocks(off), ['pack.chat/wessel', 'pack.chat/wessel-skills']);
    // The RPG off: the same, with the quiet "feature off" note.
    await rpgOff.send('Mara.', reply(MARA));
    assert.deepEqual(blocks(rpgOff), ['pack.chat/wessel', 'pack.chat/wessel-skills']);
    const quiet = rpgOff.turn.problems().find(item => /party/.test(item.line ?? item.message ?? ''));
    assert.equal(quiet?.quiet === true || /feature off/.test(quiet?.message ?? ''), true);
    assert.equal(rpgOff.sdk.query('rpg.joins', {}), null, 'and the query answers nothing');
});

// ---- Ask: the card ------------------------------------------------------------------------------------------------------------------

test('Ask: the line makes nothing; the reply\'s card offers Add to party, Edit first and No', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Mara walks in.', reply(MARA));
    assert.deepEqual(blocks(host), ['pack.chat/wessel', 'pack.chat/wessel-skills'], 'nothing is made by the line');
    const receipt = lastReceipts(host).find(entry => entry.type === 'capture.party');
    assert.deepEqual(receipt.data.join, { op: 'offer', name: 'Mara', about: 'a hedge-witch from Kvildal', soul: 4, best: 'int', four: true }, 'a reply under the partyFour mark says so');
    assert.equal(receipt.guarded, undefined, 'no block: nothing to replay');
    const offers = host.sdk.query('rpg.joins', {});
    assert.deepEqual(offers, [{ name: 'Mara', about: 'a hedge-witch from Kvildal', soul: 4, best: 'int', four: true }]);
    const card = host.registry.cardEntries().find(entry => entry.id === 'story-block/rpg-join').fn(host.head(), null, { index: host.ctx.chat.length - 1, head: true, query: (name, args) => host.sdk.query(name, args) });
    assert.equal(card.title, 'Mara joins the party');
    assert.equal(card.text, 'a hedge-witch from Kvildal');
    assert.deepEqual(card.actions.map(action => [action.label, action.command ?? action.open]), [['Add to party', 'dm.join'], ['Edit first', 'story-block/new-character'], ['No', 'rpg.joinNo']]);
    assert.deepEqual(card.actions[1].payload, { name: 'Mara', about: 'a hedge-witch from Kvildal', soul: 4, best: 'int' });
    assert.equal(joinCard([]), null);
    assert.deepEqual([JOIN_ADD, JOIN_NO], ['dm.join', 'rpg.joinNo']);
    await rebuilt(host, 'an offer');
});

test('Ask: Add to party makes the companion as Automatically does; the card goes; a swipe takes the offer away', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Mara walks in.', reply(MARA));
    const added = await host.sdk.command(JOIN_ADD, host.sdk.query('rpg.joins', {})[0]);
    assert.equal(added.ok, true, added.message);
    assert.deepEqual(blocks(host), ['pack.chat/mara', 'pack.chat/mara-skills', 'pack.chat/wessel', 'pack.chat/wessel-skills']);
    assert.deepEqual([fields(host, 'mara').level, fields(host, 'mara').int, fields(host, 'mara').points], [25, 13, 0]);
    assert.deepEqual(host.sdk.query('rpg.joins', {}), [], 'answered: the card goes');
    assert.deepEqual(partyLines(host.ctx.chat.at(-1).extra.storySuite).map(line => line.text), ['Mara joined the party']);
    const again = await host.sdk.command(JOIN_ADD, { name: 'Mara', about: '', soul: 1, best: '' });
    assert.equal(again.ok, false);
    assert.match(again.message, /Mara is already in the party/);
    await rebuilt(host, 'after Add to party');
    await host.swipe('Nobody comes.');
    assert.deepEqual(blocks(host), ['pack.chat/wessel', 'pack.chat/wessel-skills'], 'the swipe takes the click\'s blocks with the reply');
    assert.deepEqual(host.sdk.query('rpg.joins', {}), [], 'and the offer');
    await rebuilt(host, 'after the swipe');
});

test('Ask: No dismisses the card and makes nothing; a second offer for the same name shows once; Add refuses a bad payload', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await host.send('Two come.', reply(MARA, '+ party Mara | about: again', '+ party Ilse | class: II'));
    assert.deepEqual(host.sdk.query('rpg.joins', {}).map(offer => offer.name), ['Mara', 'Ilse']);
    const no = await host.sdk.command(JOIN_NO, { name: 'mara' });
    assert.equal(no.ok, true);
    assert.deepEqual(host.sdk.query('rpg.joins', {}).map(offer => offer.name), ['Ilse'], 'the first answered, the next one shows');
    assert.deepEqual(blocks(host), ['pack.chat/wessel', 'pack.chat/wessel-skills']);
    assert.equal((await host.sdk.command(JOIN_NO, { name: '' })).ok, false);
    assert.equal((await host.sdk.command(JOIN_ADD, { name: 'X', soul: 12 })).ok, false, 'a class out of range is refused');
    await rebuilt(host, 'after No');
    // Only the newest reply carries offers.
    await host.send('On.', 'Nothing more.');
    assert.deepEqual(host.sdk.query('rpg.joins', {}), []);
    // The reader's commands are the reader's: not a story line, and gated by the feature.
    host.features.set(LEAN_RPG_FEATURE, false);
    assert.equal((await host.sdk.command(JOIN_ADD, { name: 'Zed' })).ok, false);
    assert.equal((await host.sdk.command(JOIN_NO, { name: 'Zed' })).ok, false);
    assert.deepEqual(joinOffers([], 0), []);
});

// ---- leaving ------------------------------------------------------------------------------------------------------------------------

test('- party Name marks the companion as Left (kept, never deleted), out of the rolls; a later + party brings them back', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await make(host, 'Mara', 2);
    await host.send('Mara leaves.', reply('- party Mara'));
    assert.equal(fields(host, 'mara').left, true);
    assert.deepEqual(blocks(host), ['pack.chat/mara', 'pack.chat/mara-skills', 'pack.chat/wessel', 'pack.chat/wessel-skills'], 'kept');
    assert.deepEqual(problems(host), []);
    assert.equal(lastReceipts(host).find(entry => entry.type === 'capture.party').summary, 'Mara left the party.');
    assert.deepEqual(partyLines(host.ctx.chat.at(-1).extra.storySuite).map(line => line.text), ['Mara left the party']);
    // Not on the sheet the dice are rolled for, and the narrator is told she left.
    const { readSheet } = await import('../../../modules/rpg/read.js');
    assert.deepEqual(readSheet(host.head()).characters.map(character => character.who), ['Wessel']);
    const { request } = await host.send('Who is here?', 'Only Wessel.');
    assert.match(request.chat.map(message => message.content).join('\n'), /Mara — .*left true/);
    await rebuilt(host, 'after leaving');
    // Left twice or never in the party: refused plainly.
    await host.send('Again.', reply('- party Mara', '- party Nobody'));
    assert.equal(problems(host).slice(-2).every(message => /is not in the party; nothing applied\./.test(message)), true);
    // A later + party of the same name brings them back, whatever Ask says: they are the same person.
    await host.send('Mara returns.', reply('+ party Mara | class: IX'));
    assert.equal(fields(host, 'mara').left, false);
    assert.equal(fields(host, 'mara').level, 15, 'the sheet is the one they left with');
    assert.deepEqual(blocks(host).length, 4, 'nothing new made');
    assert.equal(lastReceipts(host).find(entry => entry.type === 'capture.party').summary, 'Mara is back in the party.');
    assert.deepEqual(host.sdk.query('rpg.joins', {}), [], 'and no card');
    await rebuilt(host, 'after returning');
    // A swipe takes the leaving back.
    await host.send('Leaves again.', reply('- party Mara'));
    await host.swipe('Stays.');
    assert.equal(fields(host, 'mara').left, false);
    await rebuilt(host, 'after a swipe');
});

test('a sheet made before Left existed cannot be marked as left, and says so', { skip }, async t => {
    const host = await world({ mode: 'auto' });
    t.after(() => host.close());
    const old = STANDARD_TEMPLATES.find(entry => entry.definition.role === 'character');
    const definition = structuredClone(old.definition);
    delete definition.state.left;
    definition.slug = 'ren'; definition.name = 'Ren'; definition.state.who.default = 'Ren';
    assert.equal((await host.sdk.command('dm.define', { definition })).ok, true);
    await host.send('Ren leaves.', reply('- party Ren'));
    assert.match(problems(host).at(-1), /Ren's sheet was made before Left existed, so it cannot be marked as left/);
    assert.equal(partyOf(host.head()).find(person => person.name === 'Ren').left, false);
});

// ---- the story's own lines are the only way in ---------------------------------------------------------------------------------------

test('party lines are the story\'s: a reader\'s command cannot write one, and the other ops are refused', { skip }, async t => {
    const host = await world();
    t.after(() => host.close());
    const direct = await host.sdk.command('capture.party', { op: '+', name: 'Mara', labels: {} });
    assert.equal(direct.ok, false, 'capture commands are internal');
    await host.send('Odd.', reply('~ party Mara', '! party Mara'));
    assert.equal(problems(host).filter(message => /not a party line/.test(message)).length, 2);
    assert.deepEqual(blocks(host), ['pack.chat/wessel', 'pack.chat/wessel-skills']);
});
