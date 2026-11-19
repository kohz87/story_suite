// Combat Rules v1 skills: the seven types, costs and fallback, stance ownership and on/off, the rank
// ladder against the oracle, and every MP / SP move in the C0 simulator traces.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canOwn, rankOf, skillCost, stanceOf } from '../../../../modules/rpg/combat/skills.js';
import { RANKS, V1 } from '../../../../modules/rpg/combat/numbers.js';
import { RANK_LADDER } from '../v1/oracle.js';

const CASES = JSON.parse(readFileSync(new URL('../../../../scripts/core/sim-trace-cases.json', import.meta.url), 'utf8')).cases;
const FIXTURE = JSON.parse(readFileSync(new URL('../v1/fixtures/sim-traces.json', import.meta.url), 'utf8'));
const MAGIC = new Set(['Mage', 'Healer']);
const OWNED_STANCE = {
    Warrior: 'defence', Skirmisher: 'speed', 'Skirmisher-Move': 'speed', 'Skirmisher-area': 'speed',
    Mage: 'speed', Healer: 'defence',
};
const skillFor = (build, type) => ({ type, stat: MAGIC.has(build) ? 'wis' : 'str' });
const resourcesOf = hero => ({ sp: hero.sp, mp: hero.mp });

test('the type table has the seven v1 types, with Defence, Speed and Focus as the stances', () => {
    const kinds = Object.fromEntries(Object.entries(V1.skill.types).map(([type, entry]) => [type, entry.kind]));
    assert.deepEqual(kinds, {
        attack: 'action', area: 'action', defence: 'stance', speed: 'stance',
        focus: 'stance', heal: 'action', utility: 'story',
    });
    assert.deepEqual(Object.keys(V1.skill.types), ['attack', 'area', 'defence', 'speed', 'focus', 'heal', 'utility']);
});

test('the earlier stance words read as the new types: evasion, movement, agility, swift are Speed; support, channel, auxiliary are Focus', () => {
    for (const word of ['speed', 'Speed', 'evasion', 'movement', 'agility', 'swift']) assert.equal(skillCost({ type: word, stat: 'agi' }).type, 'speed', word);
    for (const word of ['focus', 'Focus', 'support', 'channel', 'auxiliary']) assert.equal(skillCost({ type: word, stat: 'wis' }).type, 'focus', word);
});

test('costs: attack 1, area 2, heal 2 MP, every stance 1 per exchange; utility and normal attacks are free', () => {
    assert.deepEqual(skillCost({ type: 'attack', stat: 'str' }), {
        type: 'attack', kind: 'action', pool: 'sp', cost: 1, affordable: true, fallback: false,
    });
    assert.deepEqual(skillCost({ type: 'attack', stat: 'wis' }), {
        type: 'attack', kind: 'action', pool: 'mp', cost: 1, affordable: true, fallback: false,
    });
    assert.equal(skillCost({ type: 'Area attack', stat: 'agi' }).cost, 2);
    assert.equal(skillCost({ type: 'area', stat: 'agi' }).pool, 'sp');
    assert.deepEqual(skillCost({ type: 'heal', stat: 'str' }), {
        type: 'heal', kind: 'action', pool: 'mp', cost: 2, affordable: true, fallback: false,
    });
    for (const type of ['defence', 'Defence', 'speed', 'evasion', 'movement']) {
        const price = skillCost({ type, stat: 'str' });
        assert.equal(price.kind, 'stance', type);
        assert.equal(price.cost, 1, type);
        assert.equal(price.pool, 'sp', type);
    }
    // (a Focus stance is a magic stance: always Mana)
    for (const stat of ['int', 'wis', 'str']) assert.deepEqual(skillCost({ type: 'focus', stat }), { type: 'focus', kind: 'stance', pool: 'mp', cost: 1, affordable: true, fallback: false });
    assert.deepEqual(skillCost('utility'), {
        type: 'utility', kind: 'story', pool: null, cost: 0, affordable: true, fallback: false,
    });
    assert.deepEqual(skillCost('normal'), {
        type: 'normal', kind: 'action', pool: null, cost: 0, affordable: true, fallback: false,
    });
});

test('the 0 SP fallback is a free normal attack; a stance with no SP is off', () => {
    const attack = skillCost({ type: 'attack', stat: 'str' }, { sp: 0, mp: 10 });
    assert.deepEqual(attack, { type: 'normal', kind: 'action', pool: null, cost: 0, affordable: true, fallback: true });
    assert.equal(skillCost({ type: 'area', stat: 'agi' }, { sp: 1, mp: 10 }).fallback, true);
    assert.equal(stanceOf({ type: 'defence', stat: 'str' }, true, { sp: 0, mp: 10 }), null);
    assert.equal(stanceOf({ type: 'defence', stat: 'str' }, true, { sp: 1, mp: 10 }), 'defence');
    const heal = skillCost({ type: 'heal', stat: 'wis' }, { sp: 10, mp: 1 });
    assert.equal(heal.affordable, false);
    assert.equal(heal.fallback, false);
});

test('one stance skill may be owned; a second stance, including Focus, cannot be added', () => {
    const defence = { name: 'Shield Wall', type: 'defence' };
    const evasion = { name: 'Shadow Step', type: 'speed' };
    const support = { name: 'Rally', type: 'focus' };
    assert.equal(canOwn([], defence), true);
    assert.equal(canOwn([defence], evasion), false);
    assert.equal(canOwn([defence], support), false);
    assert.equal(canOwn([defence], { name: 'Slash', type: 'attack' }), true);
    assert.equal(canOwn([defence], defence), true);
    assert.equal(canOwn([evasion], defence), false);
    assert.equal(canOwn([defence, evasion], { type: 'attack' }), true);
    assert.equal(canOwn([], null), false);
});

test('one stance runs at a time; off is null and an unaffordable stance stays off', () => {
    const defence = { type: 'defence', stat: 'str' }, evasion = { type: 'speed', stat: 'agi' };
    assert.equal(stanceOf(defence), 'defence');
    assert.equal(stanceOf(defence, false), null);
    assert.equal(stanceOf(defence, null), null);
    assert.equal(stanceOf([{ type: 'attack' }, defence]), 'defence');
    assert.equal(stanceOf([defence, evasion]), null);
    assert.equal(stanceOf({ type: 'attack' }), null);
    assert.equal(stanceOf({ type: 'focus', stat: 'wis' }), 'focus');
    assert.equal(stanceOf({ type: 'support', stat: 'wis' }), 'focus');
    assert.equal(stanceOf({ type: 'focus', stat: 'wis' }, true, { sp: 5, mp: 0 }), null, 'Focus is paid from Mana');
});

test('the rank table is the oracle ladder and both practice and level gates apply', () => {
    assert.deepEqual(RANKS.map(r => [r.name, r.mastery, r.practice, r.minLevel]), RANK_LADDER);
    const cases = [
        [0, 1, 'Novice'], [99, 99, 'Novice'], [100, 1, 'Apprentice'], [200, 9, 'Apprentice'],
        [200, 10, 'Adept'], [300, 24, 'Adept'], [300, 25, 'Expert'], [400, 44, 'Expert'],
        [400, 45, 'Master'], [500, 64, 'Master'], [500, 65, 'Grandmaster'], [600, 84, 'Grandmaster'],
        [600, 85, 'Legend'], [999, 99, 'Legend'], [600, 1, 'Apprentice'],
    ];
    for (const [practice, level, name] of cases) {
        assert.equal(rankOf(practice, level).name, name, `${practice} practice at L${level}`);
        assert.equal(rankOf({ practice, level }).name, name, 'object form');
    }
    for (const rank of RANKS) assert.deepEqual(rankOf(rank.practice, rank.minLevel), rank);
    assert.equal(rankOf(-5, 0).name, 'Novice');
    assert.equal(rankOf('x', 'x').name, 'Novice');
});

test('every C0 trace MP / SP move matches the skill costs and the 0 SP fallback', () => {
    const specs = new Map(CASES.map(c => [c.name, c.party]));
    let normals = 0, stances = 0, skills = 0, heals = 0;
    for (const trace of FIXTURE.cases) {
        const spec = specs.get(trace.name), heroes = new Map();
        trace.sheet.party.forEach((p, i) => heroes.set(p.label, {
            build: p.build, mp: spec[i].mp ?? p.mp, sp: spec[i].sp ?? p.sp,
        }));
        trace.events.forEach((event, i) => {
            const [kind, ...args] = event, at = `${trace.name} #${i} ${kind}`;
            if (kind === 'stance') {
                const hero = heroes.get(args[0]), active = args[1][0] ?? null;
                const owned = skillFor(hero.build, OWNED_STANCE[hero.build]), announced = stanceOf(owned, true, resourcesOf(hero));
                assert.equal(announced, active, at);
                if (announced !== null) {
                    const price = skillCost(owned, resourcesOf(hero));
                    assert.equal(price.affordable, true, at);
                    hero[price.pool] -= price.cost;
                    stances += 1;
                }
            } else if (kind === 'attack') {
                const [who, how] = args, hero = heroes.get(who), previous = trace.events[i - 1];
                const sharedArea = how === 'area' && previous?.[0] === 'attack' && previous[1] === who && previous[2] === 'area';
                if (how === 'normal') {
                    assert.equal(skillCost('normal').cost, 0, at);
                    normals += 1;
                } else if (!sharedArea) {
                    const type = how === 'skill' ? 'attack' : how;
                    const price = skillCost(skillFor(hero.build, type), resourcesOf(hero));
                    assert.equal(price.type, type, at);
                    assert.equal(price.affordable, true, at);
                    hero[price.pool] -= price.cost;
                    skills += 1;
                }
            } else if (kind === 'heal') {
                const hero = heroes.get(args[0]), price = skillCost({ type: 'heal', stat: 'wis' }, resourcesOf(hero));
                assert.equal(price.pool, 'mp', at);
                assert.equal(price.affordable, true, at);
                hero[price.pool] -= price.cost;
                heals += 1;
            }
        });
        for (const end of trace.end.party) {
            const hero = heroes.get(end.label);
            assert.deepEqual([hero.mp, hero.sp], [end.mp, end.sp], `${trace.name} ${end.label} MP / SP`);
        }
    }
    assert.equal(normals, 1, 'the 0 SP case is the only normal attack');
    assert.ok(stances > 0 && skills > 0 && heals > 0);
});
