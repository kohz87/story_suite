// The markdown report of the roll and fight tables.
import { STANDARD_PRESETS, STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';
import { CLASSES, DIFFICULTIES, FIGHTS } from './shared-grid.js';
import { rankAt } from './builds.js';

// ---- output -----------------------------------------------------------------------------------------------------------

const odds = o => `${o.success}/${o.cost}/${o.fail} d${o.decisive}`;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export function markdown(rolls, fights) {
    const out = [];
    out.push('# Standard formula simulation', '', `Presets: ${DIFFICULTIES.map(name => `${name} foeBase ${STANDARD_PRESETS[name].foeBase}`).join(', ')}; foeClassWeight ${STANDARD_FORMULA.foeClassWeight}; Soul Class worth ${STANDARD_FORMULA.classWeight}.`, '');
    out.push('Each cell: success / at a cost / fail in per cent, then d = decisive per cent of rolls. Rank by Soul Class: ' + CLASSES.map(soul => `${ROMAN[soul]} ${rankAt(soul)}`).join(', ') + '.', '');
    for (const difficulty of DIFFICULTIES) {
        out.push(`## ${difficulty[0].toUpperCase()}${difficulty.slice(1)}`, '', '| Build | Soul Class | Bonus | vs same class | vs one below | vs one above |', '|---|---|---|---|---|---|');
        for (const row of rolls.filter(item => item.difficulty === difficulty)) out.push(`| ${row.build} | ${ROMAN[row.soul]} | +${row.bonus} | ${odds(row.same)} | ${odds(row.below)} | ${odds(row.above)} |`);
        out.push('');
    }
    out.push('', `## A hero against one foe of the same class (${FIGHTS} fights each)`, '', 'Exchanges are rounds rolled until one side is down; a reply holds up to the decisive round.', '',
        '| Difficulty | Build | Soul Class | Exchanges | Replies | Hero wins % |', '|---|---|---|---|---|---|');
    for (const row of fights) out.push(`| ${row.difficulty} | ${row.build} | ${ROMAN[row.soul]} | ${row.exchanges} | ${row.replies} | ${row.heroWins} |`);
    return out.join('\n');
}
