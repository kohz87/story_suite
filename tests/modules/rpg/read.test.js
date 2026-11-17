// Reading the sheet (src/v2/lean-rpg/read.js): blocks by role, the field keys, and how a name is matched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, matchCharacter, matchFoe, matchName, matchSkill, readSheet } from '../../../modules/rpg/index.js';
import { PARTY, character, foeBlock, sheetDomain, skillBlock } from './helpers.js';

const read = blocks => readSheet({ domains: { dataModules: sheetDomain(blocks) } });

test('a block with no role, or a role the RPG does not read as a sheet, is left alone; so is a state with no data modules', () => {
    const blocks = { plain: { role: undefined, fields: character('Plain') }, rules: { role: 'rules', fields: { who: 'x' } } };
    assert.deepEqual(read(blocks).characters, []);
    for (const state of [null, {}, { domains: {} }, { domains: { dataModules: {} } }, { domains: { dataModules: { active: 'no' } } }]) assert.deepEqual(readSheet(state).characters, []);
});

test('fold: lower case, spaces and hyphens gone', () => {
    assert.equal(fold('Iron-Breath'), 'ironbreath');
    assert.equal(fold(' iron  breath '), 'ironbreath');
    assert.equal(fold('ＩＲＯＮ'), 'iron');
});

test('a skill phrase matches a name inside it; the longest wins; two of one length are ambiguous and match nothing', () => {
    const owner = { skills: ['Fire', 'Fireball', 'Iron Breath', 'Ice', 'Ash'].map((name, n) => ({ slot: n + 1, name, rank: 0, practice: 0 })) };
    const named = phrase => matchSkill(owner, phrase)?.name ?? null;
    assert.equal(named('iron breath drill'), 'Iron Breath');
    assert.equal(named('Iron-Breath'), 'Iron Breath');
    assert.equal(named('fireball'), 'Fireball', 'Fire and Fireball both occur in it: the longer wins');
    assert.equal(named('a little fire'), 'Fire');
    assert.equal(named('iron breth'), null);
    assert.equal(named(''), null);
    const tied = { skills: [{ name: 'Ice' }, { name: 'Ash' }] };
    assert.equal(matchSkill(tied, 'ice and ash'), null, 'two names of one length occur in it');
});
