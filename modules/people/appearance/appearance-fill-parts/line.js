/* The prompt's tail line for a fill call. A part of appearance-fill.js (same owner, moved without change). */
import { blank } from './shared-basics.js';
import { withSplitLook } from './split-look.js';
import { storedAge } from './age.js';
import { blankLookFields, partialLookGaps } from './wanted.js';
import { appearanceText } from '../appearance-text.js';
import { currentPresentationText } from '../appearance-model.js';

const storedFacts = npc => [storedAge(npc) !== null && `apparent age ${String(npc.apparentAge).trim()}`, String(npc?.species || '').trim() && `kind ${String(npc.species).trim()}`, String(npc?.gender || '').trim() && `gender ${String(npc.gender).trim()}`].filter(Boolean);
/** The prompt's tail line for a fill call, or '' (static rules stay untouched; the line exists only on this call). */
export function fillLooksLine(raw = {}) {
    const npc = withSplitLook(raw);
    const fields = blankLookFields(npc);
    const gaps = partialLookGaps(npc);
    if (!fields.length && !gaps.length) return '';
    const facts = storedFacts(npc);
    const parts = [];
    if (fields.length) parts.push(`${fields.join(', ')} ${fields.length > 1 ? 'are' : 'is'} blank because the story never described this person. Only for ${fields.length > 1 ? 'those fields' : 'that field'}, write a short plausible look that fits what the story and dossier say (kind and its own features, age, role, region, setting); no quoted evidence needed.`);
    if (gaps.length) {
        // The dossier shows one combined look ("<overall>; <clothes>"): quote the exact text appendedLooks checks, and the clothes apart.
        const clothes = appearanceText(currentPresentationText(npc));
        parts.push(`overallAppearance is exactly ${JSON.stringify(appearanceText(npc.overallAppearance))} and does not yet describe this person's ${gaps.join(', ')}. Return overallAppearance as that quoted text, unchanged, followed by a short addition for ${gaps.join(', ')} only, fitted to what the story and dossier say (kind and its own features, age, role, region, setting).${clothes ? ` The current-presentation text ${JSON.stringify(clothes)} is appearance, never part of overallAppearance.` : ''} Add nothing already described, and never a second colour or style for anything already stated.`);
    }
    return `\nFILL LOOKS: ${parts.join(' ')} Never contradict or repeat anything stated; invent nothing else.${facts.length ? ` Stored facts to keep exactly (never another age or kind): ${facts.join('; ')}.` : ''} Use plain descriptive wording: a height as a height (the stored or story one), never a comparison to a child or another person. overallAppearance is the body (kind, age look, build, eyes, hair, marks); appearance is clothes and their state in the fewest words.`;
}
