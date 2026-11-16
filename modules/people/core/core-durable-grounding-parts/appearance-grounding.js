/* NPC State Delta appearance grounding: corrections, declared changes and trait-change events backed by story text. */

import { cleanText, normalizeName } from '../core-text.js';
import { compactDurableText, DURABLE_PROFILE_LIMITS, durableRefinementTokens, durableSeedGrounded } from '../core-relationship.js';
import { developmentBindingLabels, developmentContextSegments } from '../core-durable-episodes.js';
import { durableRefinementSupportText } from './support-text.js';
import { durableRefinementCandidateGrounded } from './candidate-grounded.js';

const APPEARANCE_CORRECTION_CUE_RE = /\b(?:actually|in fact|contrary to|mistaken|misread|misjudged|was not|were not|is not|are not|wasn t|weren t|isn t|aren t|never was|never were|revealed?|uncovered?|exposed?|disguised|concealed|hidden|obscured|freed from|beneath|underneath)\b/i;

export function groundedAppearanceCorrection(existing, incoming, context = '', evidenceItems = [], binding = null) {
    const current = compactDurableText(existing, DURABLE_PROFILE_LIMITS.appearance, 10);
    const candidate = compactDurableText(incoming, DURABLE_PROFILE_LIMITS.appearance, 10);
    if (!current || !candidate || normalizeName(current) === normalizeName(candidate)) return false;
    const support = durableRefinementSupportText(context, evidenceItems, binding);
    if (!support || !APPEARANCE_CORRECTION_CUE_RE.test(normalizeName(support))) return false;
    return durableRefinementCandidateGrounded('appearance', current, candidate, context, evidenceItems, binding);
}

export function groundedAppearanceChange(existing, incoming, reason, context = '', evidenceItems = [], binding = null) {
    const why = cleanText(reason, 500);
    const support = durableRefinementSupportText(context, evidenceItems, binding);
    if (!why || !support || !durableSeedGrounded(why, support)) return false;
    // A declared current-presentation change replaces obsolete presentation rather than
    // refining it clause-by-clause. The replacement itself must still be source-grounded.
    return durableSeedGrounded(incoming, support);
}

// (card traits win) A description is not a change event. Use a sentence that names this NPC as
// the subject or recipient, contains the proposed value, and actually describes the change.
// For a bare role the sentence itself supplies the reason, keeping the existing prompt shape.
export function groundedTraitEvent(npc, value, reason, context, kind = 'appearance') {
    const labels = developmentBindingLabels({ npc });
    const source = String(context || '').trim();
    if (!source || !labels.length || (kind === 'appearance' && !String(reason || '').trim())) return false;
    const roles = '(?:promoted|appointed|named|crowned|elected|hired|dismissed|fired|retired|resigned|became|becomes|made|inherited|chose|chosen)';
    const looks = '(?:turned|turns|changed|changes|became|becomes|dyed|dying|bleached|scarred|burned|burnt|transformed|struck|cursed|lost|grew|grown|cut|shaved)';
    const verb = kind === 'role' ? roles : looks;
    const escaped = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const subject = kind === 'role'
        ? new RegExp(`\\b(?:${escaped})\\s+(?:(?:was|is|has been|had been|now)\\s+)?${verb}\\b`)
        : new RegExp(`\\b(?:${escaped})\\s+(?:s\\s+)?(?:[a-z]+\\s+){0,4}(?:eyes?|hair|skin|face|ears?|horns?|tail|wings?|fur|scales|scars?|tattoos?|birthmarks?|build|frame|nose|jaw|fangs?|claws?|antlers|tusks?)\\s+(?:(?:was|were|has|had|have|been)\\s+)*${verb}\\b`);
    const object = new RegExp(`\\b${verb}\\s+(?:the\\s+)?(?:${escaped})\\b`);
    const traitNouns = 'eyes?|hair|skin|face|ears?|horns?|tail|wings?|fur|scales|scars?|tattoos?|birthmarks?|build|frame|nose|jaw|fangs?|claws?|antlers|tusks?';
    const doer = kind === 'role' ? null : new RegExp(`\\b(?:${escaped})\\b(?:\\s+[a-z]+){0,4}\\s+${verb}\\s+(?:her|his|their|its|the|own)\\s+(?:[a-z]+\\s+){0,3}(?:${traitNouns})\\b`);
    const tokens = text => [...new Set(durableRefinementTokens(text).filter(token => token.length >= 3 && !/^\d+$/.test(token)))];
    return developmentContextSegments(source).some(sentence => {
        const normalized = normalizeName(sentence);
        if (/\b(?:not|never|would|could|might|if|unless|imagined|wished)\b/.test(normalized)) return false;
        if (!subject.test(normalized) && !object.test(normalized) && !doer?.test(normalized)) return false;
        const present = new Set(tokens(sentence));
        const proposed = tokens(value);
        if (!proposed.length || !proposed.every(token => present.has(token))) return false;
        const why = tokens(reason);
        return !why.length ? kind === 'role' : why.some(token => present.has(token)) && new RegExp(`\\b${verb}\\b`).test(normalizeName(reason));
    });
}
