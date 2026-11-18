// A Flee is the whole party's (SOAK2CORE #5): a member who picked nothing pays no stance upkeep and earns no stance practice when the flee
// gets away; when it fails, or when the foes move first, they hold their stance as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playExchange } from '../../../../modules/rpg/combat/exchange.js';
import { usesOfV1 } from '../../../../modules/rpg/combat/rewards.js';
import { withSkills } from './derived-skills.helper.js';

const hero = label => withSkills({ label, id: label, build: 'Warrior', level: 1, hp: 20, maxHp: 20, mp: 5, maxMp: 5, sp: 10, maxSp: 10,
    stats: { str: 8, vit: 8, agi: 8, dex: 8, int: 5, wis: 5 }, stances: [] });
const RAIDER = { label: 'Raider', id: 'Raider', tier: 'standard', level: 1, hp: 10, maxHp: 10, roll: 0, damage: 1 };

// `flee`: the fleeing die (20 gets away, 1 fails); every other die 10.
function exchange({ flee, first = 'party', fleeIdle = true, party = ['Mara', 'Astra'] }) {
    const roll = kind => (kind === 'flee' ? flee : 10);
    return playExchange({ party: party.map(hero), foes: [{ ...RAIDER }] }, { Mara: { kind: 'flee' } },
        { order: { party, foes: ['Raider'], first }, roll, number: 1, rotation: 0, ...(fleeIdle ? { fleeIdle: true } : {}) });
}
const spOf = (out, label) => out.sheet.party.find(actor => actor.label === label).sp;
const stanceOf = (out, label) => out.lines.find(line => line[0] === 'stance' && line[1] === label);
const practised = out => usesOfV1({ party: out.sheet.party, rounds: [out.lines] }).map(use => use.who);

test('a flee that gets away: the member who picked nothing pays no stance and earns no practice', () => {
    const out = exchange({ flee: 20 });
    assert.equal(out.result, 'fled');
    assert.equal(spOf(out, 'Astra'), 10, 'Astra\'s Stamina is untouched');
    assert.equal(stanceOf(out, 'Astra'), undefined, 'no stance line for Astra');
    assert.equal(practised(out).includes('Astra'), false);
});

test('a flee that fails: the member who picked nothing takes up the stance before acting, and pays for it', () => {
    const out = exchange({ flee: 1 });
    assert.equal(out.result, null);
    assert.equal(spOf(out, 'Astra') < 10, true);
    const at = out.lines.findIndex(line => line[0] === 'stance' && line[1] === 'Astra'), fled = out.lines.findIndex(line => line[0] === 'flee');
    assert.equal(at > fled, true, 'after the failed flee');
    assert.equal(out.lines.findIndex(line => line[0] === 'foe-phase') > at, true, 'and before the foes strike');
});

test('the fleer after the idle member: the idle member still holds the stance only on their own turn, and acts; the flee then gets away', () => {
    const out = exchange({ flee: 20, party: ['Astra', 'Mara'] });
    assert.equal(out.result, 'fled');
    const at = out.lines.findIndex(line => line[0] === 'stance' && line[1] === 'Astra'), fled = out.lines.findIndex(line => line[0] === 'flee');
    assert.equal(at >= 0 && at < fled, true, 'Astra\'s turn came before the flee: she held her stance and paid for it');
    assert.equal(out.lines.some(line => line[0] === 'attack' && line[1] === 'Astra'), true, 'and acted automatically');
});

test('a fight opened before the fleeIdle mark plays as recorded: every stance up front', () => {
    const out = exchange({ flee: 20, fleeIdle: false });
    assert.deepEqual(stanceOf(out, 'Astra')?.[2], ['defence']);
    assert.equal(spOf(out, 'Astra') < 10, true);
});

test('the foes first: every stance is held up front, as before', () => {
    const out = exchange({ flee: 20, first: 'foes' });
    assert.deepEqual(stanceOf(out, 'Astra')?.[2], ['defence']);
    assert.equal(spOf(out, 'Astra') < 10, true);
});

test('playBoard hands the fight\'s fleeIdle mark to each exchange (board/v1-kind.js stamps it on a new fight)', async () => {
    const { playBoard } = await import('../../../../modules/rpg/combat/play.js');
    const start = { offset: 1, order: { party: ['Mara', 'Astra'], foes: ['Raider'], first: 'party' }, rotation: 0 };
    const run = fleeIdle => playBoard({ party: ['Mara', 'Astra'].map(hero), foes: [{ ...RAIDER }] }, { random: () => 20, start, ...(fleeIdle ? { fleeIdle: true } : {}) }, [{ Mara: { kind: 'flee' } }]);
    const marked = run(true), old = run(false), astra = record => record.rounds.flat().some(line => line[0] === 'stance' && line[1] === 'Astra');
    assert.equal(marked.result, 'fled');
    assert.equal(astra(marked), false, 'marked: Astra holds no stance in the fled exchange');
    assert.equal(astra(old), true, 'unmarked: as recorded before');
});
