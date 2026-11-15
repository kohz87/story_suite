/* NPC State Delta refining and recovering behavior profile lists safely. */
import { cleanList, cleanText, normalizeName } from '../core-text.js';
import { DURABLE_PROFILE_LIMITS, durableEvidenceGroundsValue, durableSeedGrounded, durableSemanticSimilarity } from '../core-relationship.js';
import { containsBehaviorEvolutionLanguage, durableRefinementCandidateGrounded, durableRefinementSupportText, isSafeUnmarkedDurableRefinement } from '../core-durable.js';
import { behaviorProfileKey, behaviorProfileFamily, behaviorProfileBody } from './behavior-keys.js';
import { BEHAVIOR_PROFILE_LIMIT, behaviorProfileTargetSpecific, normalizeBehaviorProfile, isBehaviorLever } from './behavior-normalize.js';
import { behaviorProfileMoralityRelevant, moralityPolarity, behaviorProfileRefinementConflict } from './behavior-direction.js';
import { durableProfileCollectionCandidateGrounded } from './behavior-grounding.js';

function isSafeBehaviorProfileRefinement(existing, incoming) {
    const oldText = cleanText(existing, DURABLE_PROFILE_LIMITS.behaviorProfile);
    const newText = cleanText(incoming, DURABLE_PROFILE_LIMITS.behaviorProfile);
    if (!oldText || !newText || behaviorProfileTargetSpecific(newText)) return false;
    const sameKey = behaviorProfileKey(oldText) === behaviorProfileKey(newText);
    const sameFamily = behaviorProfileFamily(oldText) && behaviorProfileFamily(oldText) === behaviorProfileFamily(newText);
    if (!sameKey && !sameFamily) return false;
    if (containsBehaviorEvolutionLanguage(behaviorProfileBody(newText))) return false;
    if (behaviorProfileMoralityRelevant(oldText)) {
        const oldPolarity = moralityPolarity(oldText);
        const newPolarity = moralityPolarity(newText);
        if (oldPolarity && newPolarity && oldPolarity !== newPolarity) return false;
    }
    if (normalizeName(oldText) === normalizeName(newText)) return true;
    return isSafeUnmarkedDurableRefinement(oldText, newText)
        || durableSemanticSimilarity(behaviorProfileBody(oldText), behaviorProfileBody(newText)) >= 0.55;
}

export function mergeBehaviorProfileRefinements(existing, incoming, { context = '', evidenceItems = [], binding = null, personality = '', rejected = [] } = {}) {
    const current = normalizeBehaviorProfile(existing);
    const updates = normalizeBehaviorProfile(incoming);
    if (!updates.length) return current;
    // Refine is a full current summary, but it is not an evolution channel. Evaluate
    // protected identity/morality direction across the whole proposal before category-by-
    // category replacement so relabeling cannot bypass the existing atomic safety gate.
    // Entries dropped at intake for not being levers still count here, so an unrecognised
    // label cannot hide a reversal from the gate.
    const rejectedEntries = cleanList(rejected, BEHAVIOR_PROFILE_LIMIT * 3, DURABLE_PROFILE_LIMITS.behaviorProfile);
    if (behaviorProfileRefinementConflict(current, [...updates, ...rejectedEntries])) return current;
    // A lever that restates a stored non-lever entry adds no new meaning: that accepted entry
    // grounds it, even when the scene that established it is outside the current window.
    evidenceItems = [...(Array.isArray(evidenceItems) ? evidenceItems : []), ...current.filter(entry => !isBehaviorLever(entry))];
    const identity = cleanText(personality, DURABLE_PROFILE_LIMITS.personality);
    const scopedSupport = String(context || '').trim() ? durableRefinementSupportText(context, [], binding) : '';
    const next = [];
    let droppedNew = rejectedEntries.length > 0;
    for (const entry of updates) {
        const key = behaviorProfileKey(entry);
        const family = behaviorProfileFamily(entry);
        let index = current.findIndex(item => behaviorProfileKey(item) === key);
        if (index < 0 && family) index = current.findIndex(item => behaviorProfileFamily(item) === family);
        if (index >= 0) {
            // A full-summary refine is atomic for safety. If any replacement fails its existing
            // identity/morality gate, reject the proposed summary rather than partially clearing it.
            if (!isSafeBehaviorProfileRefinement(current[index], entry)) return current;
            // Ground the claim, not the lever label: labels are schema vocabulary that story text
            // does not contain. First-seed grounding (groundedBehaviorProfile) uses the body too.
            if (!durableRefinementCandidateGrounded('behaviorProfile', behaviorProfileBody(current[index]), behaviorProfileBody(entry), context, evidenceItems, binding)) return current;
            next.push(entry);
            continue;
        }
        const incomingPolarity = behaviorProfileMoralityRelevant(entry) ? moralityPolarity(entry) : 0;
        const conflicts = incomingPolarity && current.some(item => {
            if (!behaviorProfileMoralityRelevant(item)) return false;
            const existingPolarity = moralityPolarity(item);
            return existingPolarity && existingPolarity !== incomingPolarity;
        });
        if (conflicts) return current;
        // A new lever category uses first-profile grounding (story, evidence or accepted
        // Personality) and is judged on its own: one unsupported addition is dropped instead of
        // discarding every grounded lever in the proposal.
        const body = behaviorProfileBody(entry);
        const grounded = durableRefinementCandidateGrounded('behaviorProfile', '', body, context, evidenceItems, binding)
            || (!behaviorProfileTargetSpecific(entry) && (
                Boolean(identity && (durableSemanticSimilarity(body, identity) >= 0.34 || durableSemanticSimilarity(entry, identity) >= 0.34))
                || Boolean(scopedSupport && durableSeedGrounded(body, scopedSupport))
                || durableEvidenceGroundsValue(body, evidenceItems)));
        if (!grounded) {
            droppedNew = true;
            continue;
        }
        next.push(entry);
    }
    // Omitted old rules are retired because the scanner contract says refine is a FULL field.
    // Longitudinal support remains in profileEvidence rather than being copied back into the list.
    // When an unsupported addition (or an intake-rejected entry) was dropped the proposal is
    // partial, so established levers it omitted stay; stored non-lever entries still retire.
    if (droppedNew) {
        if (!next.length) return current;
        // A stored entry the provider copied back is kept even when intake rejected the copy
        // (for example a pre-category label); only deliberate omission retires it.
        const copiedBack = new Set(rejectedEntries.map(normalizeName));
        for (const old of current) {
            if ((!isBehaviorLever(old) && !copiedBack.has(normalizeName(old))) || next.length >= BEHAVIOR_PROFILE_LIMIT) continue;
            const oldKey = behaviorProfileKey(old);
            const oldFamily = behaviorProfileFamily(old);
            if (next.some(entry => behaviorProfileKey(entry) === oldKey || (oldFamily && behaviorProfileFamily(entry) === oldFamily))) continue;
            next.push(old);
        }
    }
    return normalizeBehaviorProfile(next);
}

export function recoverBehaviorProfileKeepAdditions(existing, incoming, { evidenceItems = [], rejected = [] } = {}) {
    const current = normalizeBehaviorProfile(existing);
    const updates = normalizeBehaviorProfile(incoming);
    if (!current.length || updates.length <= current.length) return current;
    const rejectedEntries = cleanList(rejected, BEHAVIOR_PROFILE_LIMIT * 3, DURABLE_PROFILE_LIMITS.behaviorProfile);
    if (behaviorProfileRefinementConflict(current, [...updates, ...rejectedEntries])) return current;
    if (!durableProfileCollectionCandidateGrounded('behaviorProfile', current, updates, evidenceItems)) return current;

    // A missing/keep lifecycle marker may recover only an additive refinement. The provider must
    // still carry every established rule forward; keep never gains authority to retire or rewrite it.
    const represented = new Set();
    for (let i = 0; i < current.length; i += 1) {
        const old = current[i];
        const match = updates.findIndex((entry, index) => !represented.has(index)
            && normalizeName(entry) === normalizeName(old));
        if (match < 0) return current;
        represented.add(match);
    }

    const additions = updates.filter((_, index) => !represented.has(index));
    if (!additions.length) return current;
    const next = [...current];
    for (const entry of additions) {
        const key = behaviorProfileKey(entry);
        const family = behaviorProfileFamily(entry);
        const overlapsEstablished = current.some(item => behaviorProfileKey(item) === key
            || (family && behaviorProfileFamily(item) === family));
        if (overlapsEstablished) return current;
        if (next.length < BEHAVIOR_PROFILE_LIMIT) next.push(entry);
    }
    return normalizeBehaviorProfile(next);
}
