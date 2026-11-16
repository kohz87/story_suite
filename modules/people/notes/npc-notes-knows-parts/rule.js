// The know rule mark: whether a line was kept under the tolerant how: read, and the receipt data that says so.
import { KNOW_FACT_MAX, KNOW_ABOUT_MAX } from './shared-limits.js';
import { KNOW_HOW, KNOW_RULE } from './shared-marks.js';
import { clean } from './shared-clean.js';
import { readHow } from './how.js';
import { readKnows } from './read.js';

const ruleKey = (about, fact) => `${clean(about, KNOW_ABOUT_MAX)}|${clean(fact, KNOW_FACT_MAX)}`.toLowerCase();

/**
 * KNOW_RULE for a new line whose how: needs the tolerant read; for a Re-read (`standing` set) only when the reply's stored entry (its own
 * rule mark) or receipt shows the line was kept under the rule, else 0 (strict). A how: already exactly saw/heard is never marked (both reads agree).
 */
export function knowRuleFor(standing, key, reply, labels, receipts = []) {
    if (KNOW_HOW.includes(labels.how)) return 0;
    if (!standing) return KNOW_RULE;
    const id = ruleKey(labels.about, labels.fact);
    if (Array.isArray(receipts) && receipts.some(r => r?.type === 'capture.know' && r.data?.key === key && r.data?.knowRule === KNOW_RULE && r.data?.knowId === id)) return KNOW_RULE;
    const how = readHow(labels.how);
    return readKnows(standing.domains?.npc?.npcs?.[key]?.knows).some(e => e.r === reply && e.rule === KNOW_RULE && e.how === how && ruleKey(e.about, e.fact) === id) ? KNOW_RULE : 0;
}

export const markKnowResult = (result, labels, rule) => rule === KNOW_RULE
    ? { ...result, data: { ...result.data, knowRule: KNOW_RULE, knowId: ruleKey(labels.about, labels.fact) } } : result;
