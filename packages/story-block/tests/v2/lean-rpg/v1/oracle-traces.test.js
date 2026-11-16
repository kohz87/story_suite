// The oracle (oracle.js) replays every golden simulator trace: each roll total, outcome, damage, soak, bar move (HP, and the MP / SP costs),
// tempo chain, flee, order and the foe attack count must equal what the simulator recorded.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    barsOf, bonusesOf, damages, decisiveDmg, fleeWins, foeHit, foeOf, playerHit, simMasteryAt, soakOf, takeSoak, tempoWins,
} from './oracle.js';

const CASES = JSON.parse(readFileSync(new URL('../../../../scripts/sim-trace-cases.json', import.meta.url), 'utf8')).cases;
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/sim-traces.json', import.meta.url), 'utf8'));
const MAGIC = new Set(['Mage', 'Healer']);
const POOL = h => (MAGIC.has(h.build) ? 'mp' : 'sp');   // the pool a build's attack, area and stance skills draw on
const COST = { skill: 1, area: 2, heal: 2, stance: 1 };  // per use; heal is MP for every build
const SKILL_STAT = { Warrior: 'str', Skirmisher: 'agi', 'Skirmisher-Move': 'agi', 'Skirmisher-area': 'agi', Mage: 'int', Healer: 'int' };
const lower = stats => Object.fromEntries(Object.entries(stats).map(([k, v]) => [k.toLowerCase(), v]));

function stateOf(sheet, name) {   // the sheet holds the max MP / SP; a case can start a hero lower (its mp / sp in the case file)
    const spec = CASES.find(c => c.name === name).party;
    const heroes = new Map(sheet.party.map((p, i) => [p.label, { ...p, s: lower(p.stats), stance: null, mp: spec[i].mp ?? p.mp, sp: spec[i].sp ?? p.sp }]));
    const foes = new Map(sheet.foes.map(p => [p.label, { ...p }]));
    return { heroes, foes };
}

function replay(trace) {
    const { heroes, foes } = stateOf(trace.sheet, trace.name);
    let streak = { who: null, n: 0 };
    const inits = new Map();
    let partyOrder = [];
    let foeOrder = [];
    let rot = 0; // the foe attack rotation counter runs on across phases, like the simulator's
    const bonus = (h, key) => bonusesOf(h.s, h.lv, h.mastery, h.stance)[key];
    const label = (e, i) => `${trace.name} #${i} ${e[0]}`;
    trace.events.forEach((e, i) => {
        const [kind, ...a] = e;
        const at = label(e, i);
        if (kind === 'init') {
            const [who, d, total] = a;
            const h = heroes.get(who);
            const expected = h ? d + bonus(h, 'order') : d + foeOf(foes.get(who).tier, foes.get(who).lv).order;
            assert.equal(total, expected, at);
            inits.set(who, total);
        } else if (kind === 'order') {
            const [party, foeList, first] = a;
            const byInit = [...heroes.values()].sort((x, y) => inits.get(y.label) - inits.get(x.label) || y.s.agi - x.s.agi);
            assert.deepEqual(party, byInit.map(h => h.label), at);
            const byFoeInit = [...foes.keys()].sort((x, y) => inits.get(y) - inits.get(x));
            assert.deepEqual(foeList, byFoeInit, at);
            foeOrder = foeList;
            partyOrder = party;
            assert.equal(foeList.length, foes.size, at);
            const best = Math.max(...heroes.keys().map(k => inits.get(k)));
            const foeBest = Math.max(...foes.keys().map(k => inits.get(k)));
            assert.equal(first, best >= foeBest ? 'party' : 'foes', at);
        } else if (kind === 'stance') {
            const h = heroes.get(a[0]);
            h.stance = a[1][0] ?? null;
            if (h.stance) h[POOL(h)] -= COST.stance;   // one stance on: 1 per exchange
            assert.ok(h[POOL(h)] >= 0, at);
            streak = { who: null, n: 0 };
        } else if (kind === 'attack') {
            const [who, how, foeLabel, d, total, fd, fdef, outcome, dmg, hpAfter] = a;
            const h = heroes.get(who);
            const foe = foes.get(foeLabel);
            const pool = POOL(h);   // area costs 2 once per action (it logs one attack per foe), a skill 1; the normal attack is the fallback at 0
            const prev = trace.events[i - 1];
            const sameArea = how === 'area' && prev[0] === 'attack' && prev[1] === who && prev[2] === 'area';
            if (sameArea) { /* paid with the first target */ }
            else if (how === 'area') assert.ok(h[pool] >= COST.area, `${at}: area without the cost`);
            else if (how === 'skill') assert.ok(h[pool] >= COST.skill, `${at}: skill without the cost`);
            else assert.equal(h[pool], 0, `${at}: normal attack while a skill is affordable`);
            h[pool] -= sameArea ? 0 : how === 'area' ? COST.area : how === 'skill' ? COST.skill : 0;
            const b = MAGIC.has(h.build) ? bonus(h, 'magic') : bonus(h, 'physical');
            assert.equal(total, d + b, at);
            if (how !== 'area') {   // focus: every single-target action goes to the lowest-HP standing foe, first in order on a tie
                const lowest = Math.min(...foeOrder.filter(l => foes.get(l).hp > 0).map(l => foes.get(l).hp));
                assert.equal(foe.hp, lowest, `${at}: not the lowest-HP foe`);
                assert.equal(foeLabel, foeOrder.find(l => foes.get(l).hp === lowest), `${at}: tie not broken by order`);
            }
            if (d === 1) { assert.equal(outcome, 'miss-nat1', at); assert.equal(fd, null, at); return; }
            assert.equal(fdef, fd + foeOf(foe.tier, foe.lv).roll, at);
            assert.equal(outcome, playerHit(d, b, fdef), at);
            const dm = damages(h.s, h.mastery);
            const base = how === 'normal' ? (MAGIC.has(h.build) ? dm.normalMagic : dm.normalPhysical)
                : how === 'area' ? dm.area(SKILL_STAT[h.build]) : dm.skill(SKILL_STAT[h.build]);
            const expected = outcome === 'decisive' ? decisiveDmg(base) : outcome === 'hit' ? base : 0;
            assert.equal(dmg, expected, at);
            foe.hp = Math.max(0, foe.hp - expected);
            assert.equal(hpAfter, foe.hp, at);
        } else if (kind === 'tempo') {
            const [who, foeLabel, d, mine, fd, theirs, won] = a;
            const h = heroes.get(who);
            const foe = foes.get(foeLabel);
            assert.equal(mine, d + bonus(h, 'tempo'), at);
            assert.equal(theirs, fd + foeOf(foe.tier, foe.lv).roll, at);
            assert.equal(won, tempoWins(d, bonus(h, 'tempo'), theirs), at);
            streak = streak.who === who ? streak : { who, n: 0 };
            if (won) streak.n += 1;
            assert.ok(streak.n <= bonus(h, 'tempoCap'), `${at}: chain over the cap`);
        } else if (kind === 'heal') {
            const [who, target, amount, hpAfter] = a;
            const h = heroes.get(who);
            const t = heroes.get(target);
            assert.ok(h.mp >= COST.heal, `${at}: heal without 2 MP`);
            h.mp -= COST.heal;
            assert.equal(amount, damages(h.s, h.mastery).heal, at);
            t.hp = Math.min(t.maxhp, t.hp + amount);
            assert.equal(hpAfter, t.hp, at);
        } else if (kind === 'flee') {
            const [who, , d, mine, fd, theirs, ok] = a;
            const h = heroes.get(who);
            const strongest = Math.max(...[...foes.values()].filter(x => x.hp > 0).map(x => foeOf(x.tier, x.lv).roll));
            assert.equal(mine, d + bonus(h, 'flee'), at);
            assert.equal(theirs, fd + strongest, at);
            assert.equal(ok, fleeWins(d, bonus(h, 'flee'), theirs), at);
        } else if (kind === 'foe-phase') {
            const standing = [...heroes.values()].filter(h => h.hp > 0).length;
            const alive = [...foes.values()].filter(x => x.hp > 0);
            const lone = alive.length === 1 && ['elite', 'boss', 'apex'].includes(alive[0].tier);
            const count = Math.min(2 * standing, lone ? standing : alive.length);
            assert.equal(a[0].length, count, at);
            streak = { who: null, n: 0 };
        } else if (kind === 'foe-attack') {
            const [foeLabel, target, d, atk, ed, ev, outcome, soak, dmg, hpAfter] = a;
            const foe = foes.get(foeLabel);
            const h = heroes.get(target);
            const fo = foeOf(foe.tier, foe.lv);
            const standing = partyOrder.filter(l => heroes.get(l).hp > 0);
            assert.equal(target, standing[rot % standing.length], `${at}: targets rotate through the heroes in order`);
            rot += 1;
            assert.equal(atk, d + fo.roll, at);
            assert.equal(ev, ed + bonus(h, 'evasion'), at);
            assert.equal(outcome, foeHit(d, fo.roll, ev), at);
            if (outcome === 'evaded') { assert.deepEqual([soak, dmg], [0, 0], at); assert.equal(hpAfter, h.hp, at); return; }
            const s = soakOf(h.s.vit, h.stance === 'defence' ? h.mastery : 0);
            assert.equal(soak, s, at);
            const raw = outcome === 'decisive' ? decisiveDmg(fo.dmg) : fo.dmg;
            assert.equal(dmg, takeSoak(raw, s), at);
            h.hp = Math.max(0, h.hp - dmg);
            assert.equal(hpAfter, h.hp, at);
        }
    });
    return { heroes, foes };
}

test('the fixture is the v8.1 trace set: 34 uniquely named cases', () => {
    assert.equal(FIXTURE.rules, 'v8.1');
    assert.equal(FIXTURE.cases.length, 34);
    assert.equal(new Set(FIXTURE.cases.map(c => c.name)).size, 34);
    assert.match(FIXTURE.simSha256, /^[0-9a-f]{64}$/);
});

test('the oracle reproduces every sheet: bars, mastery, foe HP / damage / roll', () => {
    for (const c of FIXTURE.cases) {
        for (const p of c.sheet.party) {
            const s = lower(p.stats);
            assert.equal(p.mastery, simMasteryAt(p.lv), c.name);
            const bars = barsOf(s, p.lv);
            assert.deepEqual([p.maxhp, p.mp, p.sp], [bars.hp, bars.mp, bars.sp], `${c.name} ${p.label}`);
        }
        for (const x of c.sheet.foes) {
            const fo = foeOf(x.tier, x.lv);
            assert.deepEqual([x.maxhp, x.dmg, x.roll], [fo.hp, fo.dmg, fo.roll], `${c.name} ${x.label}`);
        }
    }
});

for (const c of FIXTURE.cases) {
    test(`oracle replays the trace: ${c.name}`, () => {
        const { heroes, foes } = replay(c);
        for (const p of c.end.party) {
            const h = heroes.get(p.label);
            assert.deepEqual([h.hp, h.mp, h.sp], [p.hp, p.mp, p.sp], `${c.name} ${p.label} HP / MP / SP`);
        }
        for (const x of c.end.foes) assert.equal(foes.get(x.label).hp, x.hp, `${c.name} ${x.label} HP`);
    });
}
