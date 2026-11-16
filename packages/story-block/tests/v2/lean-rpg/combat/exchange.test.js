// Replay every C0 simulator trace through the whole-fight engine with scripted dice: exact lines, every HP/MP/SP move,
// final bars, result and dice use. Also pin the C4 boundaries: junk actions/dice, per-side order, flee and tempo natural 1.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playExchange } from '../../../../src/v2/lean-rpg/combat/exchange.js';
import { foeAttacks } from '../../../../src/v2/lean-rpg/combat/foe-turns.js';
import { playBoard } from '../../../../src/v2/lean-rpg/combat/play.js';
import { fightDice } from '../../../../src/v2/lean-rpg/combat/dice.js';
import { lineOf, lineTexts } from '../../../../src/v2/lean-rpg/combat/record.js';
import { dice } from '../../../../src/v2/interaction/dice.js';
import { seeded } from './dice.helper.js';
import { withSkills } from './derived-skills.helper.js';

const FIXTURE = JSON.parse(readFileSync(new URL('../v1/fixtures/sim-traces.json', import.meta.url), 'utf8'));
const CASES = JSON.parse(readFileSync(new URL('../../../../scripts/sim-trace-cases.json', import.meta.url), 'utf8')).cases;
const SPECS = new Map(CASES.map(entry => [entry.name, entry.party]));
const ATTACK_POOL = { Mage: 'mp', Healer: 'mp' };
const STANCE_POOL = { Mage: 'mp', Healer: 'mp' };
const lower = stats => Object.fromEntries(Object.entries(stats).map(([key, value]) => [key.toLowerCase(), value]));

function sheetOf(trace) {
    const spec = SPECS.get(trace.name);
    return {
        party: trace.sheet.party.map((hero, index) => withSkills({
            ...hero, stats: lower(hero.stats), hp: spec[index].hp ?? hero.hp, mp: spec[index].mp ?? hero.mp,
            sp: spec[index].sp ?? hero.sp,
        })),
        foes: trace.sheet.foes.map(foe => ({ ...foe })),
    };
}

function choicesOf(trace) {
    const choices = {};
    for (const event of trace.events) if (event[0] === 'flee') choices[event[1]] = { kind: 'flee' };
    return choices;
}

function expectedMoves(trace) {
    const spec = SPECS.get(trace.name), party = new Map(), foes = new Map();
    trace.sheet.party.forEach((hero, index) => party.set(hero.label, {
        label: hero.label, build: hero.build, hp: spec[index].hp ?? hero.hp, mp: spec[index].mp ?? hero.mp,
        sp: spec[index].sp ?? hero.sp, maxHp: hero.maxhp,
    }));
    trace.sheet.foes.forEach(foe => foes.set(foe.label, { label: foe.label, hp: foe.hp }));
    const moves = [];
    const change = (actor, bar, to) => {
        const from = actor[bar], next = Math.max(0, to);
        if (from === next) return;
        actor[bar] = next;
        moves.push({ id: actor.label, label: actor.label, bar, from, to: next, amount: next - from });
    };
    trace.events.forEach((event, index) => {
        const [kind, who, one, two, three, four, five, six, seven, eight, nine] = event;
        if (kind === 'stance' && one.length) change(party.get(who), STANCE_POOL[party.get(who).build] ?? 'sp', party.get(who)[STANCE_POOL[party.get(who).build] ?? 'sp'] - 1);
        if (kind === 'attack') {
            const how = one, target = two, hpAfter = nine, previous = trace.events[index - 1];
            const sharedArea = how === 'area' && previous?.[0] === 'attack' && previous[1] === who && previous[2] === 'area';
            const pool = ATTACK_POOL[party.get(who).build] ?? 'sp', cost = how === 'normal' || sharedArea ? 0 : how === 'area' ? 2 : 1;
            if (cost) change(party.get(who), pool, party.get(who)[pool] - cost);
            change(foes.get(target), 'hp', hpAfter);
        }
        if (kind === 'heal') {
            change(party.get(who), 'mp', party.get(who).mp - 2);
            change(party.get(one), 'hp', three);
        }
        if (kind === 'foe-attack') {
            const target = one, damage = eight, hpAfter = nine;
            if (damage > 0 || party.get(target).hp !== hpAfter) change(party.get(target), 'hp', hpAfter);
        }
    });
    return moves;
}

test('all 34 C0 simulator traces replay exactly through the whole-fight engine', async t => {
    for (const trace of FIXTURE.cases) {
        await t.test(trace.name, () => {
            let draws = 0;
            const result = playBoard(sheetOf(trace), { random: () => trace.dice[draws++], maxExchanges: trace.end.exchanges }, [choicesOf(trace)]);
            assert.deepEqual(result.lines, trace.events, `${trace.name}: every line`);
            assert.deepEqual(result.moves, expectedMoves(trace), `${trace.name}: every bar move`);
            assert.equal(draws, trace.dice.length, `${trace.name}: dice used`);
            assert.equal(result.result, trace.end.result, `${trace.name}: result`);
            assert.deepEqual(result.party.map(hero => ({ label: hero.label, hp: hero.hp, mp: hero.mp, sp: hero.sp })), trace.end.party);
            assert.deepEqual(result.foes.map(foe => ({ label: foe.label, hp: foe.hp })), trace.end.foes);
        });
    }
});

const ACE = withSkills({
    label: 'Ace', build: 'Skirmisher-plain', level: 99, mastery: 7, hp: 100, maxHp: 100, mp: 10, sp: 10,
    stats: { str: 30, vit: 30, agi: 30, dex: 30, int: 5, wis: 5 }, stances: [],
});
const POST = { label: 'post', tier: 'mob', level: 1, hp: 1000, maxHp: 1000, damage: 1, roll: 1 };

function exchangeWith(dice, choice = {}) {
    let at = 0;
    return playExchange({ party: [{ ...ACE, stats: { ...ACE.stats }, stances: [] }], foes: [{ ...POST }] }, { Ace: choice }, {
        order: { party: ['Ace'], foes: ['post'], first: 'party' }, roll: () => dice[at++], number: 1, rotation: 0,
    });
}

test('a natural 1 does not stop a winning tempo roll, matching the simulator baseline', () => {
    const result = exchangeWith([20, 1, 1, 1, 1, 5, 5]);
    const tempo = result.lines.find(line => line[0] === 'tempo');
    assert.deepEqual(tempo, ['tempo', 'Ace', 'post', 1, 40, 1, 2, true]);
});

test('a natural 1 can still flee, matching the simulator baseline', () => {
    const result = exchangeWith([1, 1], { kind: 'flee' });
    assert.deepEqual(result.lines.find(line => line[0] === 'flee'), ['flee', 'Ace', 'post', 1, 40, 1, 2, true]);
    assert.equal(result.result, 'fled');
});

test('junk setup, dice and actions are refused instead of becoming a hit', () => {
    assert.throws(() => playBoard({ party: [ACE], foes: [POST] }, {}), /dice source/);
    assert.throws(() => exchangeWith([0]), /d20/);
    assert.throws(() => exchangeWith([20, 1], { kind: 'dance' }), /Unknown exchange action/);
});

test('foe turns use the lone rule and the twice-the-party cap; targeting is rotated by the exchange', () => {
    const hero = hp => ({ label: `h${hp}`, hp, maxHp: hp });
    const elite = { label: 'elite', tier: 'elite', hp: 10, roll: 10 };
    const standard = index => ({ label: `s${index}`, tier: 'standard', hp: 10, roll: 10 });
    assert.deepEqual(foeAttacks([hero(5), hero(5)], [elite]).map(foe => foe.label), ['elite', 'elite']);
    assert.equal(foeAttacks([hero(5)], [1, 2, 3, 4].map(standard)).length, 2);
    assert.equal(foeAttacks([hero(5), hero(5), hero(5)], [1, 2, 3, 4, 5, 6].map(standard)).length, 6);
});

test('the record line reader turns each trace row into plain text', () => {
    assert.equal(lineOf(['exchange', 2]), 'Exchange 2.');
    assert.match(lineOf(['foe-attack', 'wolf', 'Kira', 8, 14, 10, 11, 'hit', 10, 2, 5], 7), /wolf attacks Kira: hit, 2 damage after 10% soak; Kira HP 7 → 5\./);
    assert.match(lineOf(['foe-attack', 'wolf', 'Kira', 8, 14, 10, 11, 'hit', 10, 2, 5]), /Kira HP 5\./);
});

const move = (label, from, to) => ({ id: label, label, bar: 'hp', from, to, amount: to - from });

test('the record text carries the real HP before an overkill hit, a capped heal and a downing foe hit', () => {
    const lines = [
        ['attack', 'Ace', 'skill', 'wolf', 15, 30, 5, 9, 'hit', 10, 0],
        ['heal', 'Mira', 'Kira', 5, 10],
        ['foe-attack', 'wolf', 'Kira', 12, 20, 3, 5, 'hit', 10, 8, 0],
        ['attack', 'Ace', 'normal', 'wolf', 2, 9, 5, 12, 'miss', 0, 3],
    ];
    const texts = lineTexts(lines, [move('wolf', 3, 0), move('Kira', 9, 10), move('Kira', 10, 3), move('Kira', 3, 0)].slice(0, 2).concat([move('Kira', 10, 0)]));
    assert.match(texts[0], /wolf HP 3 → 0\./);
    assert.match(texts[1], /Kira HP 9 → 10\./);
    assert.match(texts[2], /Kira HP 10 → 0\./);
    assert.match(texts[3], /wolf HP 3\./);
});

test('a real fight text reads its before values from the record moves', () => {
    const run = playBoard({ party: [ACE], foes: [{ ...POST, hp: 3, maxHp: 3 }] }, seeded({ seed: 7, maxExchanges: 1 }));
    const hit = run.lines.findIndex(line => line[0] === 'attack' && line[8] !== 'miss' && line[8] !== 'miss-nat1');
    if (hit < 0) return;
    assert.match(lineTexts(run.lines, run.moves)[hit], /post HP 3 → 0\./);
});

test('every die slot in one exchange has its own stream, and a seed replays the same dice', () => {
    const roll = fightDice(dice(123), 1), twin = fightDice(dice(123), 1), other = fightDice(dice(124), 1);
    const kinds = ['act', 'foe', 'check', 'flee'], slots = [0, 50, 90, 154, 204, 140, 1000, 1040, 1000000];
    for (const kind of kinds) for (const slot of slots) {
        const key = `${kind}:${slot}`, draws = [roll(kind, slot)(), roll(kind, slot)()];
        assert.deepEqual(draws, [twin(kind, slot)(), twin(kind, slot)()], `${key} replays`);
        assert.ok(draws.every(die => die >= 1 && die <= 20));
    }
    // the slots the board's own key scheme collided on (act 154 and foe 90) differ here, and so does every other (slot, kind) pair
    const sample = (kind, slot) => Array.from({ length: 24 }, (_, at) => fightDice(dice(at), 1)(kind, slot)());
    assert.notDeepEqual(sample('act', 154), sample('foe', 90));
    assert.notDeepEqual(sample('act', 204), sample('foe', 140));
    assert.notDeepEqual(Array.from({ length: 24 }, (_, at) => fightDice(dice(at), 1)('act', 0)()), Array.from({ length: 24 }, (_, at) => other('act', at)()));
});

test('the same seed through the real dice path plays the same record; another seed differs', () => {
    const heroes = [ACE, { ...ACE, label: 'Bea', id: 'Bea' }], foes = [{ ...POST, hp: 60, maxHp: 60 }, { ...POST, label: 'post2', hp: 60, maxHp: 60 }];
    const play = seed => playBoard({ party: heroes, foes }, seeded({ seed, maxExchanges: 3 }));
    assert.deepEqual(play(11), play(11));
    assert.notDeepEqual(play(11).lines, play(12).lines);
});

test('opening initiative dice are validated like the exchange dice', () => {
    for (const bad of [0, 21, NaN, 2.5]) assert.throws(() => playBoard({ party: [ACE], foes: [POST] }, { random: () => bad }), /d20/);
});

test('a heal goes to living wounded allies only; with no target it falls back to the auto attack and spends nothing', () => {
    const healer = withSkills({ label: 'Mira', id: 'Mira', build: 'Healer', hp: 30, maxHp: 30, mp: 10, maxMp: 10, sp: 5, maxSp: 5, stats: { str: 5, agi: 5, vit: 5, int: 10, wis: 10, dex: 5, luk: 5 }, level: 5, stances: [] });
    const downed = { label: 'Dag', id: 'Dag', hp: 0, maxHp: 30, mp: 0, sp: 0, stats: { str: 5, agi: 5, vit: 5 }, level: 5, stances: [] };
    const wounded = { ...downed, label: 'Wen', id: 'Wen', hp: 5 };
    const run = (party, choice) => playExchange({ party, foes: [{ ...POST }] }, { Mira: choice }, { order: { party: party.map(a => a.id), foes: ['post'], first: 'party' }, roll: () => 15, number: 1, rotation: 0 });
    const revive = run([healer, downed], { kind: 'heal', target: 'Dag' });
    assert.equal(revive.sheet.party[1].hp, 0, 'a downed ally is not revived');
    const plain = run([healer, downed], { kind: 'attack' });
    assert.deepEqual(revive.moves, plain.moves, 'no MP for a heal that cannot happen: only the attack is paid');
    assert.ok(!revive.lines.some(line => line[0] === 'heal'));
    assert.ok(revive.lines.some(line => line[0] === 'attack'), 'it attacked instead');
    const full = run([healer, { ...wounded, hp: 30 }], { kind: 'heal', target: 'Wen' });
    assert.ok(!full.lines.some(line => line[0] === 'heal'));
    const ok = run([healer, downed, wounded], { kind: 'heal', target: 'Dag' });
    assert.ok(ok.lines.some(line => line[0] === 'heal' && line[2] === 'Wen'), 'falls to the most wounded living ally');
});
