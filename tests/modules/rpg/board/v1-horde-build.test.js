// The horde's words and the reserve code builds from them (board/horde-build.js), and the pre-check that asks for the words (precheck-run.js, parse.js, opening.js):
// counts are cut to their ranges, never refused; a leader counts only when the message names it; the opening records the words, so no model is asked again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hordeFrom, wordsOf } from '../../../../modules/rpg/board/horde-build.js';
import { runPrecheck } from '../../../../modules/rpg/board/precheck-run.js';
import { parseHorde } from '../../../../modules/rpg/board/precheck.js';
import { openingSetup } from '../../../../modules/rpg/board/opening.js';

const slot = (n, name, count, level = 4, tier = 'minion') => ({ slot: n, name, count, level, tier });
const total = horde => horde.reserve.reduce((sum, group) => sum + group.count, 0);

test('wordsOf holds every count to its range and asks no horde for words that say none', () => {
    assert.deepEqual(wordsOf({ waves: 3, until: 'hold', hold: 30, leader: '  Ghoul Warlord ' }), { waves: 3, until: 'hold', hold: 20, leader: 'Ghoul Warlord' });
    assert.deepEqual(wordsOf({ waves: 99, until: 'HOLD' }), { waves: 8, until: 'hold', hold: 8 }, 'the default hold is 8');
    assert.deepEqual(wordsOf({ waves: 3, until: 'nonsense' }), { waves: 3, until: 'clear' });
    assert.equal(wordsOf({ waves: 1 }), null, 'one wave and no other end is an ordinary fight');
    assert.deepEqual(wordsOf({ waves: 1, until: 'hold' }), { waves: 1, until: 'hold', hold: 8 }, 'holding a line needs no reserve');
    assert.equal(wordsOf(null), null);
    assert.equal(wordsOf({ waves: 'lots' }), null);
});

test('hordeFrom copies the front wave by wave and cuts at the limits: 48 in reserve, 60 in all, 12 groups; a new leader comes last as a boss', () => {
    const full = [1, 2, 3, 4, 5, 6].map(n => slot(n, `G${n}`, 6));
    const big = hordeFrom({ waves: 8, until: 'clear' }, full);
    assert.equal(total(big), 24, 'a front of 36 leaves room for 24 (60 in all)');
    assert.deepEqual(big.reserve.map(group => group.name), ['G1', 'G2', 'G3', 'G4']);
    const led = hordeFrom({ waves: 8, until: 'leader', leader: 'The Warlord' }, full);
    assert.deepEqual(led.reserve.at(-1), { name: 'The Warlord', count: 1, level: 6, tier: 'boss', leader: true }, 'two levels above the front, a boss');
    assert.equal(total(led), 19, 'the leader keeps his place: three copies and him');
    const small = hordeFrom({ waves: 8, until: 'clear' }, [slot(1, 'Ghoul', 6), slot(2, 'Ghoul', 6)]);
    assert.equal(total(small), 48, 'the reserve itself is held to 48');
    assert.equal(small.reserve.length, 8);
    const many = hordeFrom({ waves: 8, until: 'clear' }, [slot(1, 'Rat', 1, 1, 'mob'), slot(2, 'Rat', 1, 1, 'mob')]);
    assert.equal(many.reserve.length, 12, 'and to 12 groups');
    assert.deepEqual(hordeFrom({ waves: 2, until: 'leader', leader: 'GHOUL', level: 9 }, [slot(2, 'Ghoul', 3)]), { v: 1, reserve: [{ name: 'Ghoul', count: 3, level: 4, tier: 'minion' }], leaderSlot: 2 }, 'a front group named as the leader is the leader');
    assert.deepEqual(hordeFrom({ waves: 2, until: 'clear' }, [slot(1, 'Rat', 2, 1, '')]).reserve[0].tier, 'standard', 'no tier on the block reads as standard');
    assert.equal(hordeFrom(null, [slot(1, 'Rat', 2)]), null);
});

test('parseHorde reads the words beside the groups, in prose or alone; none when the answer gives none', () => {
    assert.deepEqual(parseHorde('Here: {"groups":[{"name":"g","count":2,"level":1}],"horde":{"waves":3,"until":"clear"}} done'), { waves: 3, until: 'clear' });
    assert.equal(parseHorde('{"groups":[{"name":"g","count":2,"level":1}]}'), null);
    assert.equal(parseHorde([{ name: 'g' }]), null);
});

test('runPrecheck with the horde asked: the words of a v1 answer, the leader only when the message names it; without the flag the groups as before', async () => {
    const sheet = { characters: [{ who: 'Astra', level: 5, v1: true }], foes: [] };
    const answer = horde => async () => JSON.stringify({ groups: [{ name: 'ghouls', count: 6, level: 4, tier: 'minion' }], ...(horde ? { horde } : {}) });
    const message = 'I hold the gate against the ghouls pouring in until their warlord shows himself';
    const named = await runPrecheck({ callModel: answer({ waves: 3, until: 'leader', leader: 'Warlord' }), message, sheet, withHorde: true });
    assert.equal(named.groups.length, 1);
    assert.deepEqual(named.horde, { waves: 3, until: 'leader', leader: 'Warlord' });
    const unnamed = await runPrecheck({ callModel: answer({ waves: 3, until: 'leader', leader: 'Ghoul King' }), message, sheet, withHorde: true });
    assert.deepEqual(unnamed.horde, { waves: 3, until: 'leader' }, 'a leader the message never names is dropped');
    assert.equal((await runPrecheck({ callModel: answer(null), message, sheet, withHorde: true })).horde, null);
    assert.equal((await runPrecheck({ callModel: answer({ waves: 3 }), message, sheet: { characters: [{ who: 'Astra', level: 5 }], foes: [] }, withHorde: true })).horde, null, 'an old sheet asks no horde');
    assert.deepEqual(await runPrecheck({ callModel: async () => { throw new Error('down'); }, message, sheet, withHorde: true }), { groups: [], horde: null });
    const plain = await runPrecheck({ callModel: answer({ waves: 3 }), message, sheet });
    assert.ok(Array.isArray(plain), 'the old call still answers the groups');
});

test('the opening records the checked words with its groups, and none for an ordinary fight', () => {
    const base = { groups: [{ name: 'ghouls', count: 6, level: 4, tier: 'minion' }], key: 'k', rules: {}, anchor: 's1', practice: 10 };
    assert.deepEqual(openingSetup({ ...base, horde: { waves: 30, until: 'hold' } }).setup.horde, { waves: 8, until: 'hold', hold: 8 });
    assert.equal(Object.hasOwn(openingSetup(base).setup, 'horde'), false);
});
