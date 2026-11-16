// The relationships paragraph of the one-pass lines prompt (approved NSD2 wording, plus the G2 default clauses). Unwired: nothing imports it until N7 makes `staticText` return it.
import { APPROACH_KINDS } from '../../npc-meters-gate.js';

const PARAGRAPH = 'Relationships: when the scene changes how someone feels about {{user}}, write one line: ~ npc Name | trust: up | tension: down | impact: meaningful | why: what happened. Name each meter that moved (trust, affection, desire, tension) and say up or down; never write a number. impact is one word for the whole line: ordinary (a kind word, most moments) | meaningful (a real favour, a shared secret) | major (saved from danger, a betrayal) | extreme (a life-changing turning point, very rare). Leave impact out for ordinary. why is one short sentence naming the cause. Desire moves only for explicit attraction or intimacy. A continuation or aftermath of something already written is no change; write no line.';

/**
 * The paragraph for one set of features. `via`: the anti-lever feature is on (its sentence is appended as it is today); `rules`: the preset meters' own rules
 * ("id describe", Meter rules while presets are on). The caps setting, custom meters and the per-day limit add no text: code enforces them (G2).
 */
export function linesMeterText({ via = true, rules = [] } = {}) {
    const approach = via ? ` Add | via: ${APPROACH_KINDS.join(', ')} when the move is one of those approaches; the same approach to the same person again soon gives less, then backfires.` : '';
    const meterRules = rules.length ? ` Meter rules: ${rules.join('; ')}.` : '';
    return `${PARAGRAPH}${approach}${meterRules}`;
}
