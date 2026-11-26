// Where a dossier's relationshipSummary came from. `relationshipSummarySource: 'line'` marks a sentence the story wrote with `~ npc Name | toward:`
// (the people.fields write sets both): it is kept and told to the narrator as written, never compacted, calibrated or checked against the meters.
// Every other writer of the summary drops the mark, so its own text is judged as before.
import { compactDurableText, DURABLE_PROFILE_LIMITS } from './core-relationship.js';
import { normalizeName } from './core-text.js';

const LINE = 'line';
// (a prompt shows a long summary cut short, the shortest cut being 260 characters: a copy of that cut is still a copy)
const CUT_COPY_MIN = 200;
const MAX = DURABLE_PROFILE_LIMITS.relationshipSummary;

/** The story's own sentence exactly as stored, or '' when the summary is not marked as one. */
export function lineSummary(npc) {
    if (npc?.relationshipSummarySource !== LINE || typeof npc.relationshipSummary !== 'string') return '';
    return [...npc.relationshipSummary.trim()].slice(0, MAX).join('');
}

/** Whether `proposed` only repeats the story's sentence `npc` holds (a scan or Refresh copying it back), which must not reword it. False for an unmarked summary. */
export function copiesLineSummary(proposed, npc) {
    const kept = lineSummary(npc);
    if (!kept) return false;
    const plain = text => normalizeName(compactDurableText(text, MAX, 6));
    const cut = String(proposed ?? '').trim().replace(/(?:…|\.\.\.)$/, '').trim();
    return plain(proposed) === plain(kept) || (cut.length >= CUT_COPY_MIN && kept.startsWith(cut));
}

/** Sets or drops the mark on `target` so it is the one of `source` (the record its summary was taken from; none: dropped). */
export function takeSummarySource(target, source = null) {
    if (lineSummary(source)) target.relationshipSummarySource = LINE;
    else delete target.relationshipSummarySource;
}
