/* Writing the shared body features into a form described only by clothing or condition. A part of appearance-model.js (same owner, moved without change). */
import { appearanceText, clean, combineAppearance } from '../appearance-text.js';
import { CHANGEABLE_PRESENTATION, CONCEALED_MENTION, MIXED_CLAUSE_SPLIT, physicalPieces, physicalTraitKeys, presentationSegments } from '../appearance-physical.js';

// A scan that still sends the body as overallAppearance and only an outfit or condition for a named
// form means that body belongs to that form: write it in, so the self-contained form does not lose
// it. Only a form described entirely by clothing, gear or condition qualifies; one that names what
// the NPC is ("a silver dragon", "spirit form") or describes any body trait is left alone.
export function completeFormWithShared(overall, value) {
    const own = appearanceText(value);
    const shared = appearanceText(overall);
    if (!own || !shared) return own;
    const segments = presentationSegments(own);
    const describesBody = segments
        .filter(segment => !CONCEALED_MENTION.test(segment))
        .flatMap(physicalPieces)
        .some(piece => physicalTraitKeys(piece).length > 0);
    // Each part around "wearing / with / in …" must be clothing or condition, so "a silver dragon
    // wearing a golden collar" is a dragon, not an outfit.
    const outfitOnly = segments.length > 0 && segments
        .flatMap(segment => segment.split(MIXED_CLAUSE_SPLIT).map(part => clean(part, 400)).filter(Boolean))
        .every(part => CHANGEABLE_PRESENTATION.test(part));
    return describesBody || !outfitOnly ? own : combineAppearance(shared, own);
}
