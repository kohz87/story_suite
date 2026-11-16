// Whole fights run through the real roll engine with a seeded generator, and the table of them.
import { blocksFor, foeHealthBlocks } from '../../../modules/rpg/formula.js';
import { STANDARD_PRESETS } from '../../../modules/rpg/rules.js';
import { positionalDice } from '../../../modules/rpg/resolve.js';
import { prepareStandard, rollStandard } from '../../../modules/rpg/standard.js';
import { CLASSES, DIFFICULTIES, BUILDS, FIGHTS } from './shared-grid.js';
import { rankAt, buildAt } from './builds.js';

// ---- fights -----------------------------------------------------------------------------------------------------------

function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const sheetOf = (stats, soul, foeClass, heroHealth, foeHealth) => ({
    problems: [],
    characters: [{ module: 'h', who: 'Hero', key: 'hero', health: heroHealth, mana: 4, stamina: 4, stats, soul, alive: true, hidden: [],
        skills: [{ slot: 1, name: 'Strike', about: '', rank: rankAt(soul), practice: 0, stat: 'str', uses: 'stamina', hidden: [] }] }],
    foes: [{ slot: 1, module: 'f', name: 'Foe', count: 1, class: foeClass, hurt: foeHealth, filled: true, hidden: [] }],
});

/** One fight to the end (a reply at a time, the way the story would): { rounds, replies, won }. */
export function fight(build, soul, rules, random) {
    const stats = buildAt(build, soul, rules);
    const size = blocksFor(stats).health;
    let heroHealth = size, foeHealth = foeHealthBlocks(soul), carried = null, rounds = 0, replies = 0;
    const plan = { formula: 'standard', pace: 'all', acts: [{ who: 'Hero', skill: 'Strike', target: 'Foe' }], foes: [{ slot: 1, target: 'Hero' }], checks: [] };
    const loose = { ...rules, roundCap: 8 };
    while (heroHealth > 0 && foeHealth > 0 && replies < 60) {
        const prepared = prepareStandard(plan, sheetOf(stats, soul, soul, heroHealth, foeHealth), loose);
        const rolled = rollStandard(plan, prepared, positionalDice(Math.floor(random() * 4294967296) >>> 0), loose, { carried });
        rounds += rolled.rounds.length; replies += 1;
        carried = rolled.order.map(({ id, name, total, agi, party }) => ({ id, name, total, agi, party }));
        for (const hurt of rolled.hurts) { if (hurt.kind === 'char') heroHealth = hurt.to; else foeHealth = hurt.to; }
    }
    return { rounds, replies, won: foeHealth === 0 };
}

export function fightTable() {
    const rows = [];
    for (const difficulty of DIFFICULTIES) for (const build of BUILDS) for (const soul of CLASSES) {
        const rules = STANDARD_PRESETS[difficulty], random = seeded(soul * 1000 + build.length * 17 + difficulty.length);
        let rounds = 0, wins = 0, replies = 0;
        for (let n = 0; n < FIGHTS; n += 1) { const result = fight(build, soul, rules, random); rounds += result.rounds; replies += result.replies; wins += result.won ? 1 : 0; }
        rows.push({ difficulty, build, soul, exchanges: Math.round(rounds * 10 / FIGHTS) / 10, replies: Math.round(replies * 10 / FIGHTS) / 10, heroWins: Math.round(wins * 100 / FIGHTS) });
    }
    return rows;
}
