// Builds what the pre-call records with a reply's dice: rules, difficulty numbers, practice and bonus table.

import { LIMITS, PRACTICE, practiceOf } from '../../names.js';
import { packRulesOf, rulesFromSettings } from '../../rules.js';
import { bonusTable } from '../result.js';
import { rulesOf } from './shared-checks.js';

/** What the pre-call records with a reply's dice: the rules, difficulty numbers and practice in force now, and the party's bonus table. */
export function dicePayload(party, values, packRecords = null) {
    let pack = null;
    try { pack = packRulesOf(packRecords); } catch { /* no pack rules */ }
    const rules = rulesOf(rulesFromSettings(values, pack));
    return { rules, dc: { ...LIMITS.dc }, perUse: practiceOf(values?.rpgPracticePerUse) ?? PRACTICE.perUse, table: bonusTable(party, rules) };
}
