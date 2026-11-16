// Every C0 simulator trace replayed through the C2 pure modules: initiative, player and foe rolls, attacks, tempo,
// heals, flee, decisive damage, soak and every exact HP move. The trace fixture is the expected result at each event.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { damageOf, healOf, soakOf, takeHit } from '../../../../src/v2/lean-rpg/combat/damage.js';
import { foeStats } from '../../../../src/v2/lean-rpg/combat/foes.js';
import { V1 } from '../../../../src/v2/lean-rpg/combat/numbers.js';
import { initiative } from '../../../../src/v2/lean-rpg/combat/order.js';
import { foeRoll, playerRoll, rollOutcome } from '../../../../src/v2/lean-rpg/combat/rolls.js';
import { tempoChain } from '../../../../src/v2/lean-rpg/combat/tempo.js';
import { bonusesOf } from '../v1/oracle.js';

const FIXTURE = JSON.parse(readFileSync(new URL('../v1/fixtures/sim-traces.json', import.meta.url), 'utf8'));
const MAGIC = new Set(['Mage', 'Healer']);
const SKILL_STAT = {
    Warrior: 'str', Skirmisher: 'agi', 'Skirmisher-Move': 'agi', 'Skirmisher-area': 'agi', Mage: 'int', Healer: 'int',
};
const normalize = outcome => (String(outcome).startsWith('miss') ? 'miss' : outcome);
const lower = stats => Object.fromEntries(Object.entries(stats).map(([key, value]) => [key.toLowerCase(), value]));

function stateOf(sheet) {
    const heroes = new Map(sheet.party.map(hero => [hero.label, { ...hero, stats: lower(hero.stats), stance: null }]));
    const foes = new Map(sheet.foes.map(foe => [foe.label, { ...foe }]));
    return { heroes, foes };
}

for (const trace of FIXTURE.cases) {
    test(`C2 modules replay every event and HP move: ${trace.name}`, () => {
        const { heroes, foes } = stateOf(trace.sheet);
        const inits = new Map();
        let partyOrder = [], foeOrder = [], rotation = 0;
        let chain = { who: null, n: 0 };

        trace.events.forEach((event, index) => {
            const [kind, ...args] = event, at = `${trace.name} #${index} ${kind}`;
            if (kind === 'init') {
                const [who, die, total] = args, hero = heroes.get(who), foe = foes.get(who);
                const bonus = hero ? playerRoll('order', hero.stats, hero.lv) : foeRoll(foe, 'order');
                assert.equal(total, die + bonus, at);
                inits.set(who, total);
            } else if (kind === 'order') {
                const [party, foeList, first] = args;
                const settled = initiative(
                    [...heroes.values()].map(hero => ({ id: hero.label, total: inits.get(hero.label), agi: hero.stats.agi })),
                    [...foes.keys()].map(label => ({ id: label, total: inits.get(label) })),
                );
                assert.deepEqual(settled.party, party, at);
                assert.deepEqual(settled.foes, foeList, at);
                assert.equal(settled.first, first, at);
                partyOrder = settled.party;
                foeOrder = settled.foes;
            } else if (kind === 'stance') {
                heroes.get(args[0]).stance = args[1][0] ?? null;
                chain = { who: null, n: 0 };
            } else if (kind === 'attack') {
                const [who, how, foeLabel, die, total, foeDie, defence, outcome, damage, hpAfter] = args;
                const hero = heroes.get(who), foe = foes.get(foeLabel);
                const bonus = playerRoll(MAGIC.has(hero.build) ? 'magic' : 'physical', hero.stats, hero.lv);
                assert.equal(total, die + bonus, at);
                if (die === V1.roll.naturalMiss) {
                    assert.equal(outcome, 'miss-nat1', at);
                    assert.equal(foeDie, null, at);
                    return;
                }
                const against = foeDie + foeRoll(foe);
                assert.equal(defence, against, at);
                const got = rollOutcome(die, bonus, against);
                assert.equal(got, normalize(outcome), at);
                const base = how === 'normal' ? damageOf(MAGIC.has(hero.build) ? 'magic' : 'physical', hero.stats)
                    : how === 'area' ? damageOf('area', hero.stats, hero.mastery, SKILL_STAT[hero.build])
                        : damageOf('skill', hero.stats, hero.mastery, SKILL_STAT[hero.build]);
                const expected = got === 'decisive' ? takeHit(base, 0, true) : got === 'hit' ? base : 0;
                assert.equal(damage, expected, at);
                foe.hp = Math.max(0, foe.hp - expected);
                assert.equal(hpAfter, foe.hp, at);
            } else if (kind === 'tempo') {
                const [who, foeLabel, die, mine, foeDie, theirs, won] = args;
                const hero = heroes.get(who), foe = foes.get(foeLabel), bonus = playerRoll('tempo', hero.stats, hero.lv, hero);
                assert.equal(mine, die + bonus, at);
                assert.equal(theirs, foeDie + foeRoll(foe), at);
                const used = chain.who === who ? chain.n : 0;
                const link = tempoChain({ agility: hero.stats.agi, stance: hero.stance, margin: mine - theirs, used });
                assert.equal(link.won, won, at);
                assert.equal(link.cap, bonusesOf(hero.stats, hero.lv, hero.mastery, hero.stance).tempoCap, at);
                if (won) {
                    assert.equal(link.extra, true, at);
                    chain = { who, n: link.chain };
                } else chain = { who: null, n: 0 };
            } else if (kind === 'heal') {
                const [who, target, amount, hpAfter] = args;
                const hero = heroes.get(who), ally = heroes.get(target);
                assert.equal(amount, healOf(hero.stats, hero.mastery), at);
                ally.hp = Math.min(ally.maxhp, ally.hp + amount);
                assert.equal(hpAfter, ally.hp, at);
            } else if (kind === 'flee') {
                const [who, , die, mine, foeDie, theirs, succeeded] = args;
                const hero = heroes.get(who);
                const strongest = Math.max(...[...foes.values()].filter(foe => foe.hp > 0).map(foeRoll));
                assert.equal(mine, die + playerRoll('flee', hero.stats, hero.lv), at);
                assert.equal(theirs, foeDie + strongest, at);
                assert.equal(rollOutcome(die, playerRoll('flee', hero.stats, hero.lv), theirs, 'flee') === 'success', succeeded, at);
            } else if (kind === 'foe-attack') {
                const [foeLabel, target, die, attack, evasionDie, evasion, outcome, soak, damage, hpAfter] = args;
                const foe = foes.get(foeLabel), hero = heroes.get(target), stats = foeStats({ level: foe.lv, tier: foe.tier });
                const standing = partyOrder.filter(label => heroes.get(label).hp > 0);
                assert.equal(target, standing[rotation % standing.length], `${at}: target rotation`);
                rotation += 1;
                assert.equal(attack, die + foeRoll(foe), at);
                const evasionTotal = evasionDie + playerRoll('evasion', hero.stats, hero.lv, hero);
                assert.equal(evasion, evasionTotal, at);
                const got = rollOutcome(die, foeRoll(foe), evasionTotal, 'foe');
                assert.equal(got, normalize(outcome), at);
                if (got === 'evaded') {
                    assert.deepEqual([soak, damage], [0, 0], at);
                    assert.equal(hpAfter, hero.hp, at);
                    return;
                }
                const soakPercent = soakOf(hero.stats.vit, hero.stance === 'defence' ? hero.mastery : 0, 0);
                assert.equal(soak, soakPercent, at);
                const dealt = got === 'evaded' ? 0 : takeHit(stats.damage, soakPercent, got === 'decisive');
                assert.equal(damage, dealt, at);
                hero.hp = Math.max(0, hero.hp - dealt);
                assert.equal(hpAfter, hero.hp, at);
            }
        });

        for (const hero of trace.end.party) assert.equal(heroes.get(hero.label).hp, hero.hp, `${trace.name} ${hero.label} HP`);
        for (const foe of trace.end.foes) assert.equal(foes.get(foe.label).hp, foe.hp, `${trace.name} ${foe.label} HP`);
        assert.ok(foeOrder.length === foes.size, `${trace.name}: every foe is in initiative`);
    });
}
