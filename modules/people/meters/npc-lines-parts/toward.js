// The `toward:` label of a `~ npc` line (lines mode, a reply carrying the `npcToward` rule mark): who the reader is to them now, one sentence in their eyes,
// stored as `relationshipSummary` (the dossier's "Who you are to them"). The narrator's sentence is only clipped, not calibrated: the write marks it
// (`relationshipSummarySource: 'line'`, core/relationship-summary-source.js) so nothing rewords it later. A field the reader edited, or a person who has died, is ./guard.js's.
import { DURABLE_PROFILE_LIMITS } from '../../core/core-relationship.js';
import { clean } from '../npc-meters-config.js';
import { unknownWord } from './facts.js';

/** → { set: { relationshipSummary? }, problems }. */
export function towardField(fields) {
    if (fields.toward === undefined) return { set: {}, problems: [] };
    const text = clean(fields.toward, DURABLE_PROFILE_LIMITS.relationshipSummary);
    if (!text || unknownWord(text) || /^(?:clear|keep)\.?$/i.test(text)) return { set: {}, problems: [`toward: "${clean(fields.toward, 40)}" says nothing; not used.`] };
    return { set: { relationshipSummary: text }, problems: [] };
}
