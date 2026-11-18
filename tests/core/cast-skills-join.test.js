// Signature skills at a join: the skill slots a level opens, the character file limit, the join receipt tiles, and a join built from a person's NPC State record (RPG off, no abilities, the reader's pencil).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../../modules/rpg/names.js';
import { skillSlots, signatureAt } from '../../core/runtime/skill-slots.js';
import { partyLines } from '../../modules/rpg/view/changes-lines.js';
import { buildCharacterFile, parseCharacterFile } from '../../modules/rpg/charfile.js';
import { skip, reply, fieldsOf, receipts } from './cast-skills.helpers.js';
import { pullWorld } from './skills-pull.helpers.js';

// ---- levels open the slots --------------------------------------------------------------------------------------------------------------

test('skill slots by level: 5, a sixth at Lv 20, a seventh at 40, an eighth at 60, no more', () => {
    assert.deepEqual([1, 19, 20, 39, 40, 59, 60, 99].map(skillSlots), [5, 5, 6, 6, 7, 7, 8, 8]);
    assert.equal(signatureAt(5, 1) && signatureAt(5, 3) && !signatureAt(5, 2), true);
    assert.equal(signatureAt(0, 1) || signatureAt(undefined, 1) || signatureAt(1, 9), false);
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


test('the join receipt becomes one tile per skill (signature, rank, stat and resource) and the summary counts them', () => {
    const record = { receipts: [{ id: 'r1', data: { join: { op: 'added', name: 'Harrak' }, sigSkills: [{ name: 'Long Watch Cleave', stat: 'str', uses: 'stamina', rank: 2 }, { name: 'Beacon Call', stat: 'cha', uses: 'mana', rank: 1 }] } }] };
    const lines = partyLines(record);
    assert.equal(lines.length, 3);
    assert.equal(lines[0].summary, 'Harrak joined, +2 skills');
    assert.deepEqual(lines.slice(1).map(line => [line.text, line.flag, line.note, line.icon, line.tone]), [
        ['Long Watch Cleave', 'signature · Adept', 'STR · Stamina', 'fa-book-open', 'good'], ['Beacon Call', 'signature · Apprentice', 'CHA · Mana', 'fa-book-open', 'good']]);
    assert.equal(partyLines({ receipts: [{ id: 'r2', data: { join: { op: 'added', name: 'Pip' } } }] }).length, 1, 'no skills, no tiles');
    assert.equal(partyLines(record, [{ receipts: ['r1'] }]).length, 0, 'a block the replay skipped is not told');
});

test('RPG off: nothing is seeded and the join is as it was', { skip }, async t => {
    const host = await pullWorld(t, { rpg: false });
    await host.send('Mara walks in.', reply('+ party Mara'));
    assert.equal(fieldsOf(host, 'mara-skills'), undefined);
});

test('a person whose record has no abilities, or who has no record, joins exactly as before', { skip }, async t => {
    const host = await pullWorld(t, { records: [{ id: 'npc_mara', name: 'Mara', aliases: [], abilities: [], keepsakes: [] }] });
    await host.send('Two arrive.', reply('+ party Mara', '+ party Pip'));
    assert.equal(fieldsOf(host, 'mara-skills').skill1, '');
    assert.equal(fieldsOf(host, 'mara-skills').sig, 0);
    assert.deepEqual(receipts(host).filter(entry => entry.type === 'capture.party').map(entry => [entry.summary, 'sigSkills' in entry.data]), [['Mara joined the party.', false], ['Pip joined the party.', false]]);
});

// ---- what the story and the reader may do ------------------------------------------------------------------------------------------------

test('the reader\'s pencil still fixes a signature skill\'s wording, and it stays signature', { skip }, async t => {
    const host = await pullWorld(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    const out = await host.sdk.command('dm.set', { module: 'pack.chat/mara-skills', fields: { skill2: 'Ferry Flash', about2: 'Sharper wording.' } });
    assert.equal(out.ok, true, JSON.stringify(out));
    const fields = fieldsOf(host, 'mara-skills');
    assert.deepEqual([fields.skill2, fields.about2, fields.sig], ['Ferry Flash', 'Sharper wording.', 7]);
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/mara-skills', fields: { sig: 0 } })).ok, false, 'the mark cannot be typed');
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/mara-skills', fields: { rank1: 3 } })).ok, false, 'nor a rank');
});
