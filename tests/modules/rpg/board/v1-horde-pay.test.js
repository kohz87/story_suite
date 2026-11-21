// What a horde pays and how it is told (owner, 21 Nov): each wave paid as its own fight (15 a foe × tier, 'each2', held to 100), kills only, no cap over the waves,
// nothing on a flee or a loss; the largest horde at the top XP rate passes the award's check; the note tells the arrivals and how a won horde ended; the log shows them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fallenWaves, hordeXp } from '../../../../modules/rpg/combat/horde-pay.js';
import { winXp } from '../../../../modules/rpg/combat/rewards.js';
import { paidOf, awardCommand } from '../../../../modules/rpg/board/v1-award.js';
import { fightResultV1 } from '../../../../modules/rpg/board/v1-settle.js';
import { settledNoteV1 } from '../../../../modules/rpg/combat/note.js';
import { lineOf } from '../../../../modules/rpg/combat/record.js';
import { logOfV1 } from '../../../../modules/rpg/board/fight-view-v1-log.js';
import { V1 } from '../../../../modules/rpg/combat/numbers.js';

const foe = (id, hp = 0, level = 2, tier = 'standard') => ({ id, label: id, hp, level, tier });
const hero = { id: 'astra', label: 'Astra', level: 1, skills: [] };
const record = (foes, result = 'win', extra = {}) => ({ result, foes, party: [hero], rounds: [], horde: { next: 1, wave: 1, leader: null }, ...extra });
const args = { modules: { astra: 'pack.chat/character' }, alive: new Set(['astra']) };

test('a horde pays each wave as a fight of its own, on its fallen foes only, with no cap over the waves', () => {
    const waves = [1, 2, 3].map(wave => Array.from({ length: 6 }, (_, n) => foe(`1.${wave}.${n + 1}`, 0, 9, 'elite')));
    const front = Array.from({ length: 6 }, (_, n) => foe(`1.${n + 1}`, 0, 9, 'elite'));
    const all = record([...front, ...waves.flat()]);
    assert.equal(fallenWaves(all).length, 4);
    assert.equal(hordeXp(all, 1, 'each2'), 400, 'four waves, each held to 100: 400, not 100');
    const standing = record([foe('1.1'), foe('1.2'), foe('1.1.1', 5), foe('1.1.2')]);
    assert.equal(hordeXp(standing, 1, 'each2'), winXp([{ count: 2, level: 2, tier: 'standard' }], 1, 'each2') + winXp([{ count: 1, level: 2, tier: 'standard' }], 1, 'each2'), 'a foe left standing pays nothing');
    assert.equal(paidOf(all, { rate: 100, practice: 3, xpRule: 'each2' }, args).xp[0].xp, 400);
    assert.equal(paidOf(all, { rate: 300, practice: 3, xpRule: 'each2' }, args).xp[0].xp, 1200);
    assert.equal(paidOf(record(all.foes, 'fled'), { rate: 100, practice: 3, xpRule: 'each2' }, args), null, 'a fled horde pays no XP');
    assert.equal(paidOf(record(all.foes, 'loss'), { rate: 100, practice: 3, xpRule: 'each2' }, args), null, 'nor a lost one');
    const plain = { ...all }; delete plain.horde;
    assert.equal(paidOf(plain, { rate: 100, practice: 3, xpRule: 'each2' }, args).xp[0].xp, 100, 'a record with no horde pays as before, held to 100');
});

test('the largest horde at the top XP rate passes the award\'s check (13 waves at 100, ×3)', () => {
    const foes = Array.from({ length: V1.horde.xpWaves }, (_, wave) => Array.from({ length: 6 }, (_, n) => foe(wave ? `1.${wave}.${n + 1}` : `1.${n + 1}`, 0, 40, 'apex'))).flat();
    const pay = paidOf(record(foes), { rate: 300, practice: 3, xpRule: 'each2' }, args);
    assert.equal(pay.xp[0].xp, 3900);
    const fail = (code, message) => { throw new Error(`${code}: ${message}`); };
    const passed = new Error('checked');
    const ctx = { fail, read: () => { throw passed; }, draft: () => { throw passed; }, call: () => {} };
    assert.equal(pay.horde, 1, 'a horde\'s award is marked');
    assert.throws(() => awardCommand(ctx, { xp: pay.xp, uses: [], perUse: 3, horde: 1 }), error => error === passed, 'the payload passes the check');
    assert.throws(() => awardCommand(ctx, { xp: [{ ...pay.xp[0], xp: 3901 }], uses: [], perUse: 3, horde: 1 }), /INVALID/);
    // (the horde's cap is the horde's only: an ordinary fight's award is held to 300, as before, and a damaged mark is refused)
    assert.throws(() => awardCommand(ctx, { xp: [{ ...pay.xp[0], xp: 300 }], uses: [], perUse: 3 }), error => error === passed, 'an ordinary fight\'s 300 passes');
    assert.throws(() => awardCommand(ctx, { xp: [{ ...pay.xp[0], xp: 301 }], uses: [], perUse: 3 }), /INVALID/, 'an ordinary fight over 300 is refused');
    assert.throws(() => awardCommand(ctx, { xp: [{ ...pay.xp[0], xp: 300 }], uses: [], perUse: 3, horde: true }), /INVALID/, 'a mark other than 1 is refused');
});

test('a won horde\'s legend check reads each fallen foe\'s own level, not only the front\'s (an arrival shares its slot\'s group)', () => {
    const won = { result: 'win', foes: [foe('1.1'), foe('1.2'), foe('1.1.1', 0, 20, 'boss')], party: [{ ...hero, level: 5 }], rounds: [], lines: [], order: { party: [], foes: [] }, exchanges: 2, horde: { next: 1, wave: 1, leader: null } };
    const sheet = { characters: [{ v1: true, key: 'astra', module: 'pack.chat/character', alive: true }] }, setup = { id: 'x:0', practice: 3, rules: {}, xpRule: 'each2' };
    assert.equal(fightResultV1(setup, won, { sheet, groups: [1] }).legend, 1, 'the level-20 arrival that fell counts');
    assert.equal(Object.hasOwn(fightResultV1(setup, { ...won, foes: [foe('1.1'), foe('1.2'), foe('1.1.1', 5, 20, 'boss')] }, { sheet, groups: [1] }), 'legend'), false, 'one left standing does not');
});

test('the note tells each arrival and how a won horde ended; the log draws one row per arrival', () => {
    const arrive = ['arrive', 1, 2, 'Ghoul', 6, 4, 'minion', 8];
    assert.equal(lineOf(arrive), 'Reinforcements: 6 Ghoul (level 4) take the field; 8 still coming.');
    const envelope = { stop: 'won', end: 'held', lines: [['exchange', 1], arrive], moves: [], rounds: [[['exchange', 1], arrive]], order: { party: [], foes: [] } };
    const note = settledNoteV1(envelope).split(' | ');
    assert.ok(note.includes('Exchange 1: More foes arrive: 6 Ghoul (level 4); 8 still coming.'));
    assert.ok(note.includes('The fight is won: the party held for its exchanges and the foes still standing break off. Code gives the party its XP.'));
    assert.ok(settledNoteV1({ ...envelope, end: 'leader' }).includes('the leader has fallen and the horde breaks'));
    assert.ok(settledNoteV1({ ...envelope, end: 'cleared' }).includes('The fight is won. Code gives the party its XP.'), 'a cleared horde is told as any won fight');
    assert.ok(settledNoteV1({ ...envelope, stop: 'fled', end: undefined }).includes('The party fled.'));
    const [round] = logOfV1({ exchanges: 1, rounds: [[['exchange', 1], arrive, ['arrive', 1, 3, 'Ghoul', 2, 4, 'minion', 0]]], party: [] });
    assert.deepEqual(round.rows.map(row => [row.who, row.what, row.outcome, row.math]), [
        ['6 Ghoul', 'Reinforcements', 'WAVE 2', 'level 4 · slot 2 · 8 still coming'], ['2 Ghoul', 'Reinforcements', 'WAVE 2', 'level 4 · slot 3 · the last of them']]);
    assert.equal(round.summary, '0 rolls · reinforcements');
});
