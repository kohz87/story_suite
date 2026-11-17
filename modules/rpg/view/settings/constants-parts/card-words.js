// The settings cards' search words, built from the page's words and the Standard fields.

import { fill } from '../../../strings.js';
import { SOUL_LABEL } from '../../../soul.js';
import { S } from './shared-words.js';
import { STANDARD_FIELDS } from './fields.js';

const words = (...parts) => parts.join(' ').toLowerCase();
export const CARD_WORDS = Object.freeze({
    formula: words(S.formula, S.formulaStandardHelp, S.formulaNote, S.formulaRows.map(row => `${row.type} ${row.what}`).join(' '), Object.values(S.formulaNums).join(' '), S.formulaFootStandard),
    levels: words(S.levels, S.levelCap, S.levelCapHelp, S.practice, S.practiceHelp, S.xpRate, S.xpRateHelp),
    rolls: words(S.rolls, S.checks, S.checksHelp, 'fight board choose exchanges'),
    difficulty: words(S.difficulty, S.gentle, S.standard, S.harsh, S.custom, STANDARD_FIELDS.map(field => `${fill(field.label, { label: SOUL_LABEL })} ${field.help}`).join(' '), S.replayNote),
    combat: words(S.combat, S.combatHelp, S.combatLabel, S.combatReset),
    join: words(S.join, S.joinHelp, S.joinAsk, S.joinAuto, S.joinOff),
    gear: words(S.gear, S.gearHelp, S.gearOn, S.off),
});
