/* Which blank look fields and partial-description gaps a fill call may write. A part of appearance-fill.js (same owner, moved without change). */
import { blank, eligible } from './shared-basics.js';
import { missingFeatures } from './features.js';
import { withSplitLook } from './split-look.js';

/** The blank look fields a fill may write for this record, or [] when none/ineligible (dead, archived, named forms in use). */
export function blankLookFields(raw = {}) {
    const npc = withSplitLook(raw);
    if (!eligible(npc)) return [];
    return [blank(npc.overallAppearance) && 'overallAppearance', blank(npc.appearance) && blank(npc.unclassifiedAppearance) && 'appearance'].filter(Boolean);
}

/** The hair / eyes / build a fill may append to this record's PARTIAL overallAppearance, or [] (blank, complete or ineligible). */
export function partialLookGaps(raw = {}) {
    const npc = withSplitLook(raw);
    return eligible(npc) ? missingFeatures(npc.overallAppearance) : [];
}

/** True when a fill call has anything to do for this record (a blank field or a partial description's gap). */
export const fillWanted = npc => blankLookFields(npc).length > 0 || partialLookGaps(npc).length > 0;
