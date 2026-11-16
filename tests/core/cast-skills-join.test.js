import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../packs/validate.js';
import { castSkillsOf } from '../../packs/cast-skills.js';
import { CAST_LIMITS, CAST_SKILL_STATS } from '../../packs/limits.js';
import { STATS } from '../../packages/story-block/src/v2/lean-rpg/names.js';
import { SKILL_SLOTS_MAX, skillSlots, signatureAt } from '../../core/runtime/skill-slots.js';
import { STANDARD_TEMPLATES_EIGHT as STANDARD_TEMPLATES } from '../../packages/story-block/src/v2/lean-rpg/templates.js';
import { partyLines } from '../../packages/story-block/src/v2/lean-rpg/view/changes-lines.js';
import { readParty } from '../../packages/story-block/src/v2/lean-rpg/view/party-data.js';
import { buildCharacterFile, parseCharacterFile } from '../../packages/story-block/src/v2/lean-rpg/charfile.js';
import { skip, reply, SKILLS, person, withCast, refused, world, fieldsOf, receipts, joinReceipt, told, update, mine } from './cast-skills.helpers.js';

test('skills: kept as written, with uses stamina and rank novice by default; nothing is added when the key is left out', () => {
    const ok = validatePack(withCast([person({ skills: SKILLS })]));
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.deepEqual(ok.pack.content.cast[0].skills, [
        { name: 'Tide Step', about: 'Light footwork on a rocking deck.', stat: 'agi', uses: 'stamina', rank: 'adept' },
        { name: 'Ferry Spark', about: 'A small lantern-flash of magic.', stat: 'int', uses: 'mana', rank: 'novice' },
        { name: 'Rope Haul', about: 'Hauls a line hand over hand.', stat: 'str', uses: 'stamina', rank: 'expert' },
    ]);
    assert.equal('skills' in validatePack(withCast([person()])).pack.content.cast[0], false);
});

test('skills are refused: not a list, empty, too many, a repeat, an unknown key, a bad stat, uses or rank, text too long, no about, markup', () => {
    const one = extra => person({ skills: [{ name: 'Spark', about: 'A burst.', stat: 'int', ...extra }] });
    refused([person({ skills: 'Spark' })], 'content.cast[0].skills');
    assert.match(refused([person({ skills: [] })], 'content.cast[0].skills').message, /1 to 8/);
    const many = Array.from({ length: 9 }, (_, n) => ({ name: `S${n}`, about: 'x', stat: 'str' }));
    assert.match(refused([person({ skills: many })], 'content.cast[0].skills').message, /1 to 8 skills/);
    const dup = refused([person({ skills: [{ name: 'Beacon Call', about: 'x', stat: 'cha' }, { name: 'Spark', about: 'x', stat: 'int' }, { name: 'beacon  call', about: 'y', stat: 'cha' }] })], 'content.cast[0].skills[2].name');
    assert.equal(dup.code, 'DUPLICATE');
    assert.match(dup.message, /repeats "beacon {1,2}call"; a person names each skill once/i);
    assert.equal(refused([one({ extra: 1 })], 'content.cast[0].skills[0].extra').code, 'UNKNOWN_FIELD');
    refused([one({ stat: 'con' })], 'content.cast[0].skills[0].stat');
    refused([person({ skills: [{ name: 'Spark', about: 'x' }] })], 'content.cast[0].skills[0].stat');
    refused([one({ uses: 'rage' })], 'content.cast[0].skills[0].uses');
    refused([one({ rank: 'legend' })], 'content.cast[0].skills[0].rank');
    refused([one({ name: 'N'.repeat(41) })], 'content.cast[0].skills[0].name');
    refused([one({ about: 'a'.repeat(121) })], 'content.cast[0].skills[0].about');
    refused([person({ skills: [{ name: 'Spark', stat: 'int' }] })], 'content.cast[0].skills[0].about');
    refused([one({ about: 'a <b> tag' })], 'content.cast[0].skills[0].about');
    refused([person({ skills: [7] })], 'content.cast[0].skills[0]');
    // the cast problem prefix, like every other cast problem
    assert.match(refused([one({ stat: 'wis' })], 'content.cast[0].skills[0].stat').message, /^Cast "Mara": /);
    assert.match(dup.message, /^Cast "Mara": /);
});

test('the pack checker\'s lists are the RPG\'s: the seven stats and the most slots a character can hold', () => {
    assert.deepEqual([...CAST_SKILL_STATS], [...STATS]);
    assert.equal(CAST_LIMITS.skills, SKILL_SLOTS_MAX);
    assert.equal(CAST_LIMITS.skillName, 40);
    assert.equal(CAST_LIMITS.skillAbout, 120);
});

test('castSkillsOf finds the person by name or alias and gives ranks as numbers', () => {
    const built = validatePack(withCast([person({ skills: SKILLS })])).pack;
    assert.deepEqual(castSkillsOf([built], 'the ferrywoman').skills.map(skill => [skill.name, skill.rank, skill.uses]), [['Tide Step', 1, 'stamina'], ['Ferry Spark', 0, 'mana'], ['Rope Haul', 2, 'stamina']]);
    assert.equal(castSkillsOf([built], 'Nobody'), null);
});

// ---- levels open the slots --------------------------------------------------------------------------------------------------------------

test('skill slots by level: 5, a sixth at Lv 20, a seventh at 40, an eighth at 60, no more', () => {
    assert.deepEqual([1, 19, 20, 39, 40, 59, 60, 99].map(skillSlots), [5, 5, 6, 6, 7, 7, 8, 8]);
    assert.equal(signatureAt(5, 1) && signatureAt(5, 3) && !signatureAt(5, 2), true);
    assert.equal(signatureAt(0, 1) || signatureAt(undefined, 1) || signatureAt(1, 9), false);
});

test('the Skills template has eight slots, the signature mark (hidden, not typed) and 16 kinds', () => {
    const { state, kinds, rules } = STANDARD_TEMPLATES.find(entry => entry.name === 'Skills').definition;
    assert.equal(Object.keys(state).length, 50);
    assert.equal(Object.keys(kinds).length, 16);
    assert.equal(rules.length, 8);
    assert.deepEqual([state.sig.edit, state.sig.prompt, state.sig.min, state.sig.max, state.sig.default], [false, false, 0, 255, 0]);
});

test('a character file holds up to eleven skills (eight combat, three utility) and refuses twelve', () => {
    const skill = n => ({ name: `S${n}`, about: 'x', stat: 'str', uses: 'stamina', rank: 0, ...(n >= 8 ? { type: 'utility' } : {}) });
    const stats = Object.fromEntries(STATS.map(stat => [stat, 10]));
    const file = buildCharacterFile({ level: 60, points: 0, stats, skills: Array.from({ length: 12 }, (_, n) => skill(n)) });
    assert.equal(file.skills.length, 11, 'a twelfth is not written');
    assert.equal(parseCharacterFile(JSON.stringify(file)).ok, true);
    assert.equal(parseCharacterFile(JSON.stringify({ ...file, skills: Array.from({ length: 12 }, (_, n) => skill(n)) })).ok, false);
    assert.equal(parseCharacterFile(JSON.stringify({ ...file, skills: Array.from({ length: 9 }, (_, n) => ({ ...skill(n), type: 'combat' })) })).ok, false);
    assert.equal(parseCharacterFile(JSON.stringify({ ...file, skills: Array.from({ length: 4 }, (_, n) => ({ ...skill(n), type: 'utility' })) })).ok, false);
});


test('a join fills the first free slots as written, marks them signature, and tells them in its one receipt', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara | about: a ferrywoman'));
    const fields = fieldsOf(host, 'mara-skills');
    assert.deepEqual(mine(fields), [[1, 'Tide Step', 'agi', 'stamina', 1, 0], [2, 'Ferry Spark', 'int', 'mana', 0, 0], [3, 'Rope Haul', 'str', 'stamina', 2, 0]]);
    assert.equal(fields.about1, 'Light footwork on a rocking deck.');
    assert.equal(fields.sig, 7);
    assert.equal(fields.skill4, '', 'free slots stay for the narrator');
    const joined = joinReceipt(host);
    assert.equal(joined.summary, 'Mara joined the party. Signature skills: 3.');
    assert.deepEqual(joined.data.sigSkills, [{ name: 'Tide Step', about: 'Light footwork on a rocking deck.', stat: 'agi', uses: 'stamina', rank: 1 }, { name: 'Ferry Spark', about: 'A small lantern-flash of magic.', stat: 'int', uses: 'mana', rank: 0 }, { name: 'Rope Haul', about: 'Hauls a line hand over hand.', stat: 'str', uses: 'stamina', rank: 2 }]);
    assert.deepEqual(receipts(host).map(entry => entry.type).filter(type => type !== 'dm.settle'), ['capture.party'], 'no receipt of its own');
    assert.deepEqual(told(host).filter(message => !/ROLLS/.test(message)), []);
    const party = readParty(host.head(), {});
    const skills = party.find(person => person.name === 'Mara').skills;
    assert.deepEqual(skills.map(skill => [skill.name, skill.signature === true]), [['Tide Step', true], ['Ferry Spark', true], ['Rope Haul', true]]);
});

test('the join receipt becomes one tile per skill (signature, rank, stat and resource) and the summary counts them', () => {
    const record = { receipts: [{ id: 'r1', data: { join: { op: 'added', name: 'Harrak' }, sigSkills: [{ name: 'Long Watch Cleave', stat: 'str', uses: 'stamina', rank: 2 }, { name: 'Beacon Call', stat: 'cha', uses: 'mana', rank: 1 }] } }] };
    const lines = partyLines(record);
    assert.equal(lines.length, 3);
    assert.equal(lines[0].summary, 'Harrak joined, +2 skills');
    assert.deepEqual(lines.slice(1).map(line => [line.text, line.flag, line.note, line.icon, line.tone]), [
        ['Long Watch Cleave', 'signature · Expert', 'STR · Stamina', 'fa-book-open', 'good'], ['Beacon Call', 'signature · Adept', 'CHA · Mana', 'fa-book-open', 'good']]);
    assert.equal(partyLines({ receipts: [{ id: 'r2', data: { join: { op: 'added', name: 'Pip' } } }] }).length, 1, 'no skills, no tiles');
    assert.equal(partyLines(record, [{ receipts: ['r1'] }]).length, 0, 'a block the replay skipped is not told');
});

test('RPG off: nothing is seeded and the join is as it was', { skip }, async t => {
    const host = await world(t, { rpg: false });
    await host.send('Mara walks in.', reply('+ party Mara'));
    assert.equal(fieldsOf(host, 'mara-skills'), undefined);
});

test('a person without skills in the pack, or not in the cast, joins exactly as before', { skip }, async t => {
    const host = await world(t, { list: [person()] });
    await host.send('Two arrive.', reply('+ party Mara', '+ party Pip'));
    assert.deepEqual(mine(fieldsOf(host, 'mara-skills')), []);
    assert.equal(fieldsOf(host, 'mara-skills').sig, 0);
    assert.deepEqual(receipts(host).filter(entry => entry.type === 'capture.party').map(entry => [entry.summary, 'sigSkills' in entry.data]), [['Mara joined the party.', false], ['Pip joined the party.', false]]);
});

// ---- what the story and the reader may do ------------------------------------------------------------------------------------------------

test('the story cannot rename or replace a signature skill: its learn line is refused with a Problems line; a new skill takes a free slot; practice works', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    await host.send('Teach.', reply('~ dm mara-skills — taught | kind: learn-1 | name: tide STEP | about: Changed. | stat: str | uses: mana'));
    assert.deepEqual(mine(fieldsOf(host, 'mara-skills')).map(row => row[1]), ['Tide Step', 'Ferry Spark', 'Rope Haul']);
    assert.equal(fieldsOf(host, 'mara-skills').about1, 'Light footwork on a rocking deck.');
    assert.ok(told(host).some(message => message.includes('Mara\'s Tide Step is a signature skill: it keeps its name and slot')), told(host).join(' | '));
    await host.send('Teach.', reply('~ dm mara-skills — taught | kind: learn-1 | name: Net Throw | about: Casts a net. | stat: dex | uses: stamina'));
    const fields = fieldsOf(host, 'mara-skills');
    assert.equal(fields.skill1, 'Tide Step', 'a different name never replaces slot 1');
    assert.deepEqual([fields.skill4, fields.sig], ['Net Throw', 7], 'it takes the first free slot and is not signature');
    await host.send('Train.', reply('+ dm mara-skills — practised Rope Haul on the quay | kind: practice-1 | amount: 12'));
    assert.equal(fieldsOf(host, 'mara-skills').practice3, 12);
});

test('the reader\'s pencil still fixes a signature skill\'s wording, and it stays signature', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    const out = await host.sdk.command('dm.set', { module: 'pack.chat/mara-skills', fields: { skill2: 'Ferry Flash', about2: 'Sharper wording.' } });
    assert.equal(out.ok, true, JSON.stringify(out));
    const fields = fieldsOf(host, 'mara-skills');
    assert.deepEqual([fields.skill2, fields.about2, fields.sig], ['Ferry Flash', 'Sharper wording.', 7]);
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/mara-skills', fields: { sig: 0 } })).ok, false, 'the mark cannot be typed');
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/mara-skills', fields: { rank1: 3 } })).ok, false, 'nor a rank');
});

test('leave and return keep rank and practice, and fill nothing again', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    await host.send('Train.', reply('+ dm mara-skills — practised Tide Step | kind: practice-1 | amount: 20'));
    await host.send('She goes.', reply('- party Mara'));
    await host.send('Back.', reply('+ party Mara'));
    const fields = fieldsOf(host, 'mara-skills');
    assert.deepEqual(mine(fields), [[1, 'Tide Step', 'agi', 'stamina', 1, 20], [2, 'Ferry Spark', 'int', 'mana', 0, 0], [3, 'Rope Haul', 'str', 'stamina', 2, 0]]);
    assert.equal(fields.sig, 7);
    assert.equal(joinReceipt(host).summary, 'Mara is back in the party.');
    assert.equal('sigSkills' in joinReceipt(host).data, false);
});

// ---- a pack updated while the chat is running -----------------------------------------------------------------------------------------

test('members who joined before the pack had skills keep exactly what they have; an update never changes them', { skip }, async t => {
    const host = await world(t, { list: [person(), person({ id: 'tam', name: 'Tam', aliases: [] })] });
    await host.send('Mara walks in.', reply('+ party Mara'));
    await host.send('Mara learns.', reply('~ dm mara-skills — taught | kind: learn-1 | name: Tide Step | about: My own take. | stat: dex | uses: stamina'));
    const before = JSON.stringify(fieldsOf(host, 'mara-skills'));
    await update(host, [person({ skills: SKILLS }), person({ id: 'tam', name: 'Tam', aliases: [], skills: [{ name: 'Cold Hands', about: 'Numbs a wound.', stat: 'vit', rank: 'master' }] })]);
    assert.equal(JSON.stringify(fieldsOf(host, 'mara-skills')), before, 'no overwrite, no duplicate, no mark on her story-made skill');
    assert.equal(fieldsOf(host, 'mara-skills').sig, 0);
    await host.send('Quiet.', reply('+ coin 1'));
    assert.equal(JSON.stringify(fieldsOf(host, 'mara-skills')), before);
    // a member who has not joined yet gets theirs on joining, under the pack as it is then
    await host.send('Tam walks in.', reply('+ party Tam'));
    assert.deepEqual(mine(fieldsOf(host, 'tam-skills')), [[1, 'Cold Hands', 'vit', 'stamina', 3, 0]]);
    assert.equal(fieldsOf(host, 'tam-skills').sig, 1);
});

test('leave and rejoin after the update: the pack\'s skills go into free slots only, those she does not hold by name; rank and practice kept', { skip }, async t => {
    const host = await world(t, { list: [person()] });
    await host.send('Mara walks in.', reply('+ party Mara'));
    await host.send('Mara learns.', reply('~ dm mara-skills — taught | kind: learn-1 | name: Rope Haul | about: Her own haul. | stat: str | uses: stamina'));
    await host.send('Mara trains.', reply('+ dm mara-skills — practised Rope Haul | kind: practice-1 | amount: 20'));
    await host.send('She goes.', reply('- party Mara'));
    await update(host, [person({ skills: SKILLS })]);
    await host.send('Back.', reply('+ party Mara'));
    const fields = fieldsOf(host, 'mara-skills');
    assert.deepEqual(mine(fields), [[1, 'Rope Haul', 'str', 'stamina', 0, 20], [2, 'Tide Step', 'agi', 'stamina', 1, 0], [3, 'Ferry Spark', 'int', 'mana', 0, 0]], 'Rope Haul is hers already: not duplicated, rank and practice kept');
    assert.equal(fields.sig, 6, 'only the two seeded slots are marked, not her own slot 1');
    assert.equal(joinReceipt(host).summary, 'Mara is back in the party. Signature skills: 2.');
    assert.deepEqual(joinReceipt(host).data.sigSkills.map(skill => skill.name), ['Tide Step', 'Ferry Spark']);
    await host.send('She goes.', reply('- party Mara'));
    await host.send('Back.', reply('+ party Mara'));
    assert.deepEqual(mine(fieldsOf(host, 'mara-skills')).map(row => row[1]), ['Rope Haul', 'Tide Step', 'Ferry Spark'], 'a second return fills nothing');
});
