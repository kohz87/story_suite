// The exact odds of one roll over all 400 pairs of dice, and the table of them by difficulty, build and Soul Class.
import { foeBonus, pair } from '../../src/v2/lean-rpg/formula.js';
import { STANDARD_PRESETS } from '../../src/v2/lean-rpg/rules.js';
import { FORMULA } from '../../src/v2/lean-rpg/index.js';
import { judge } from '../../src/v2/lean-rpg/standard.js';
import { CLASSES, DIFFICULTIES, BUILDS } from './shared-grid.js';
import { rankAt, buildAt } from './builds.js';

// ---- single rolls -----------------------------------------------------------------------------------------------------

/** The exact odds of one roll: the party's d20 + `bonus` against the foe's d20 + `against`. → whole-percent { success, cost, fail, decisive } of 400 pairs. */
export function exactOdds(bonus, against, rules) {
    const count = { success: 0, cost: 0, fail: 0, decisive: 0 };
    for (let mine = 1; mine <= FORMULA.die; mine += 1) for (let theirs = 1; theirs <= FORMULA.die; theirs += 1) {
        const result = judge(mine, mine + bonus, theirs, theirs + against, rules);
        count[result.outcome] += 1;
        if (result.decisive) count.decisive += 1;
    }
    const percent = n => Math.round(n * 100 / (FORMULA.die * FORMULA.die));
    return { success: percent(count.success), cost: percent(count.cost), fail: percent(count.fail), decisive: percent(count.decisive) };
}

const bonusOf = (stats, soul, rules) => pair(stats.str, stats.dex) + rules.classWeight * soul + rankAt(soul);

export function rollTable() {
    const rows = [];
    for (const difficulty of DIFFICULTIES) {
        const rules = STANDARD_PRESETS[difficulty];
        for (const build of BUILDS) for (const soul of CLASSES) {
            const stats = buildAt(build, soul, rules), bonus = bonusOf(stats, soul, rules);
            const row = { difficulty, build, soul, bonus };
            for (const [name, shift] of [['same', 0], ['below', -1], ['above', 1]]) {
                const foeClass = Math.max(1, Math.min(9, soul + shift));
                row[name] = exactOdds(bonus, foeBonus(foeClass, rules), rules);
            }
            rows.push(row);
        }
    }
    return rows;
}
