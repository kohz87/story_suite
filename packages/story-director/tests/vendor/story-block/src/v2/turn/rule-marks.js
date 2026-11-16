// Story Suite v2: rule marks, a per-reply list of the rules a reply was captured under (`rules` on its record). A rule that changes what a
// story line does (a new write a line never made before) must not reach an old reply when it is run again (Re-read, edit, rebuild), so the
// first live capture marks a new reply with every current rule, and a module reads the list, read-only, as `ctx.carrier.rules` in its apply.
// A reply captured before the rule has no mark and keeps the old behaviour. The list is bookkeeping, not a replay input (replay.js).
// New rule: add a name and its line test to RULE_LINES below; nothing else in the host changes.
// Public face: re-exports its parts.

export { RULE_LINES } from './rule-marks-parts/rule-lines.js';
export { foeLine } from './rule-marks-parts/foe-line.js';
export { MAX_RULE_MARKS, allRuleNames, ruleMarksFor, ruleMarksOf } from './rule-marks-parts/mark-lists.js';
export { createMarkHistory, previousMarks } from './rule-marks-parts/mark-history.js';
