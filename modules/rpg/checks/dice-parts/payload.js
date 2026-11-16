// Builds what the pre-call records with a reply's dice: rules, difficulty numbers, practice and bonus table.

import { LIMITS, PRACTICE, practiceOf } from '../../names.js';
import { bonusTable } from '../result.js';
import { rulesOf } from './shared-checks.js';

/** What the pre-call records with a reply's dice: the roll's rules mark, difficulty numbers and practice in force now, and the party's bonus table. */
export function dicePayload(party, values) {
    return { rules: rulesOf(), dc: { ...LIMITS.dc }, perUse: practiceOf(values?.rpgPracticePerUse) ?? PRACTICE.perUse, table: bonusTable(party) };
}
