// The pool and stat come from the hero's own skills, never from a build name: PROFILES is gone.

import test from 'node:test';
import assert from 'node:assert/strict';
import { playExchange } from '../../../../src/v2/lean-rpg/combat/exchange.js';
import { profileOf, skillsOf } from '../../../../src/v2/lean-rpg/combat/profile.js';
import { skillsFor } from './derived-skills.helper.js';

const stats = { str: 10, vit: 10, agi: 10, dex: 10, int: 10, wis: 10, cha: 5 };
const base = { label: 'A', id: 'A', level: 5, mastery: 2, hp: 50, maxHp: 50, mp: 10, sp: 10, stats };
const post = { label: 'post', id: 'post', tier: 'mob', level: 1, hp: 900, maxHp: 900, damage: 1, roll: 1 };
const play = (hero, choice = {}) => playExchange({ party: [hero], foes: [post] }, { A: choice }, {
    order: { party: ['A'], foes: ['post'], first: 'party' }, roll: () => 1, number: 1, rotation: 0,
});
const spent = (run, bar) => run.moves.filter(move => move.id === 'A' && move.bar === bar).reduce((sum, move) => sum - move.amount, 0);

test('a skill is read as a name, a type and a lower-case stat; a type name alone is a skill', () => {
    assert.deepEqual(skillsOf({ skills: [{ name: 'Bolt', type: 'Attack', stat: 'INT' }, 'heal', null, { name: 'Odd', type: 'nonsense', stat: 'wis' }] }), [
        { name: 'Bolt', type: 'attack', stat: 'int' }, { name: '', type: 'heal', stat: '' }, { name: 'Odd', type: 'attack', stat: 'wis' },
    ]);
});

test('the attack skill\'s stat decides the pool: INT draws MP, STR draws SP, whatever the build name says', () => {
    const magic = play({ ...base, build: 'Warrior', skills: [{ type: 'attack', stat: 'int' }] }), steel = play({ ...base, build: 'Mage', skills: [{ type: 'attack', stat: 'str' }] });
    assert.deepEqual([spent(magic, 'mp'), spent(magic, 'sp')], [1, 0]);
    assert.deepEqual([spent(steel, 'mp'), spent(steel, 'sp')], [0, 1]);
});

test('a stance is priced by its own skill\'s stat, a heal always draws MP, and a hero with no attack skill strikes with the free normal attack', () => {
    const sp = play({ ...base, skills: [{ type: 'attack', stat: 'str' }, { type: 'evasion', stat: 'agi' }] }), mp = play({ ...base, skills: [{ type: 'attack', stat: 'str' }, { type: 'evasion', stat: 'wis' }] });
    assert.deepEqual([spent(sp, 'sp'), spent(sp, 'mp')], [2, 0]);
    assert.deepEqual([spent(mp, 'sp'), spent(mp, 'mp')], [1, 1]);
    const bare = play({ ...base, skills: [] });
    assert.deepEqual(bare.moves.filter(move => move.id === 'A'), [], 'no skill, nothing spent');
    assert.ok(bare.lines.some(line => line[0] === 'attack' && line[2] === 'normal'));
    assert.deepEqual(play({ ...base, build: 'Healer', stances: ['defence'] }).lines.filter(line => line[0] === 'stance'), [['stance', 'A', []]], 'a build name or a stances list gives no stance');
});

test('an area choice needs an area skill; the derived builds carry the skills the simulator builds had', () => {
    assert.ok(!play({ ...base, skills: skillsFor('Warrior') }, { kind: 'area' }).lines.some(line => line[0] === 'attack' && line[2] === 'area'));
    const profile = profileOf({ skills: skillsFor('Skirmisher-area') });
    assert.deepEqual([profile.attack, profile.area, profile.heal, profile.stance], [{ stat: 'agi', magic: false }, { stat: 'agi', magic: false }, null, { type: 'evasion', stat: 'agi' }]);
    assert.deepEqual(profileOf({ skills: skillsFor('Healer') }).heal, { stat: 'wis' });
    assert.equal(profileOf({ skills: skillsFor('Mage') }).attack.magic, true);
});
