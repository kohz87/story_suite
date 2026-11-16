/* Durable-field acceptance rules shared by a scan row and a profile update (role, gender, home base, background, ages). */
import { ageSpecificity, normalizeGender } from '../core-identity.js';
import { durableSeedGrounded } from '../core-relationship.js';
import { normalizeName } from '../core-text.js';
import { isSafeUnmarkedDurableReplacement } from '../core-durable.js';
import { groundedTraitEvent } from '../core-durable-grounding.js';

// ---- Durable-field rules shared by a scan row (npcs[]) and a profile update (profileUpdates[]) ----
// (cleanup step 5) A model may send an existing NPC's durable facts in either channel; both apply
// them by these same rules.

// The plain durable texts a profile update applies with the npcs[] rules (the profile texts, Personality,
// Speech and Appearance, have their own evidence-gated rules there).
export const PROFILE_UPDATE_TEXT_FIELDS = Object.freeze(['role', 'species', 'gender', 'homeBase', 'age', 'apparentAge', 'background']);

// Role, gender, home base, background and ages are keep-by-default once established.
export function durableTextAccepted(field, existing, incoming, value, options = {}) {
    if (field === 'gender') {
        // Never stated: filled in whenever the story states it outright, also after death (then it is stated and frozen). Stated: while the person lives a
        // Refresh (profile update) replaces it with a new stated gender, a scan row only with genderState:"correct" + a reason; once they have died a stated
        // gender no longer changes (the reader can still change it by hand in the editor).
        const prior = normalizeGender(existing.gender);
        const next = normalizeGender(value);
        if (!next) return false;
        if (!prior) return true;
        if (prior === next) return false;
        const accepted = existing.lifeState !== 'deceased' && (options.profileUpdate === true || (incoming.genderState === 'correct' && String(incoming.genderReason || '').trim() !== ''));
        // The story contradicts what is stored and the stored word stays: tell the reader (a dossier warning) instead of overwriting in silence.
        if (!accepted) options.onGenderConflict?.({ id: existing.id, name: existing.name, kept: prior, story: next, dead: existing.lifeState === 'deceased' });
        return accepted;
    }
    if (field === 'role') {
        // (card traits win) The source event itself supplies the reason for a bare role; an
        // explicit reason, when supplied, must describe that same target-specific event.
        const prior = String(existing.role || '').trim();
        if (!prior || normalizeName(prior) === normalizeName(value)) return true;
        return groundedTraitEvent(existing, value, incoming.roleReason, options.developmentContext, 'role');
    }
    if (field === 'homeBase') {
        const prior = String(existing.homeBase || '').trim();
        const context = String(options.developmentContext || '').trim();
        if (prior) {
            if (incoming.homeBaseState !== 'update' || !String(incoming.homeBaseReason || '').trim()) return false;
            if (context && !durableSeedGrounded(value, context)) return false;
        } else if (context && !durableSeedGrounded(value, context)) {
            return false;
        }
        return true;
    }
    if (field === 'background') {
        // (cleanup step 6) Background is durable history and keep-by-default like the home base: an
        // established one changes with backgroundState:"update" + backgroundReason + grounding. No
        // prompt asks for that state yet, so a grounded restatement that keeps every stored concept
        // (the unmarked-refinement safety appearance uses) is accepted too; a shorter restatement that
        // drops a stored clause is not.
        const prior = String(existing.background || '').trim();
        const context = String(options.developmentContext || '').trim();
        if (prior && normalizeName(prior) === normalizeName(value)) return false;
        if (prior) {
            const marked = incoming.backgroundState === 'update' && String(incoming.backgroundReason || '').trim();
            if (!marked && !isSafeUnmarkedDurableReplacement(prior, value)) return false;
        }
        return !context || durableSeedGrounded(value, context);
    }
    if (field === 'age' && String(existing.age || '').trim()) {
        // Chronological age is keep-by-default once established. It may advance from
        // explicit elapsed chronology/birthdays or be corrected by stronger story evidence.
        // An advance may never move an exact numeric age backward or sideways.
        const state = String(incoming.ageState || 'keep');
        if ((state !== 'advance' && state !== 'correct') || !String(incoming.ageReason || '').trim()) return false;
        const oldExact = /^\d{1,3}$/.test(String(existing.age || '').trim()) ? Number(existing.age) : null;
        const newExact = /^\d{1,3}$/.test(String(value || '').trim()) ? Number(value) : null;
        if (state === 'advance' && oldExact !== null && newExact !== null && newExact <= oldExact) return false;
    }
    if (field === 'apparentAge' && String(existing.apparentAge || '').trim()) {
        // Apparent age is also keep-by-default. Visual aging, growth, rejuvenation,
        // transformation, or a grounded correction must be explicitly marked as evolution.
        if (incoming.apparentAgeState !== 'evolve' || !String(incoming.apparentAgeReason || '').trim()) return false;
    }
    if (field === 'age' || field === 'apparentAge') {
        // Even a lifecycle update cannot downgrade stronger age evidence to a weaker estimate.
        if (ageSpecificity(existing[field]) > ageSpecificity(value)) return false;
    }
    return true;
}
