/* NPC State Delta normalizing the behavior profile list and recognising a behavior lever. */
import { cleanList, cleanText, normalizeName } from '../core-text.js';
import { compactDurableText, DURABLE_PROFILE_LIMITS } from '../core-relationship.js';
import { behaviorProfileKey, behaviorLeverLabel, behaviorProfileFamily, behaviorProfileBody } from './behavior-keys.js';

export const BEHAVIOR_PROFILE_LIMIT = 6;

export function behaviorProfileTargetSpecific(value) {
    const raw = cleanText(value, DURABLE_PROFILE_LIMITS.behaviorProfile);
    if (!raw) return true;
    const lower = raw.toLowerCase();
    if (/\b(?:with|toward|towards|around)\s+(?:the\s+)?(?:player|pc|\{\{user\}\})\b/.test(lower)) return true;
    if (/\b(?:when|while)\s+(?:alone|intimate)\s+(?:with|around)\b/.test(lower)) return true;
    if (/\b(?:during|after)\s+(?:private\s+)?intimacy\b/.test(lower)) return true;
    if (/\bprivate\s+intimacy\b/.test(lower)) return true;
    if (/\b(?:toward|towards|with|around|jealous of|possessive of)\s+[A-Z][\p{L}\p{M}'’.-]+(?:\s+[A-Z][\p{L}\p{M}'’.-]+)?\b/u.test(raw)) return true;
    if (/\b(?:this|that)\s+(?:incident|scene|night|argument|kiss|encounter)\b/.test(lower)) return true;
    return false;
}

const BEHAVIOR_FAMILY_LABEL = Object.freeze({
    disposition: 'Disposition',
    cruelty: 'Cruelty',
    independence: 'Independence',
    care: 'Care',
    expressiveness: 'Expressiveness',
    conflict: 'Conflict',
    threat: 'Threat Sensitivity',
    analytical: 'Analytical Style',
    presentation: 'Social Presentation',
});

function mergeBehaviorFamilyEntries(existing, incoming, family) {
    const label = BEHAVIOR_FAMILY_LABEL[family] || cleanText(existing, 40).split(':')[0] || 'Behavior';
    const cleanBody = value => behaviorProfileBody(value).replace(/[.;:,]+\s*$/g, '').trim();
    const body = compactDurableText(`${cleanBody(existing)}; ${cleanBody(incoming)}`, Math.max(80, DURABLE_PROFILE_LIMITS.behaviorProfile - label.length - 2), 3)
        .replace(/\.\s*;/g, ';');
    return cleanText(`${label}: ${body}`, DURABLE_PROFILE_LIMITS.behaviorProfile);
}

export function normalizeBehaviorProfile(value) {
    const items = cleanList(value, BEHAVIOR_PROFILE_LIMIT * 3, DURABLE_PROFILE_LIMITS.behaviorProfile)
        .filter(item => !behaviorProfileTargetSpecific(item));
    const out = [];
    for (const item of items) {
        const key = behaviorProfileKey(item);
        if (!key) continue;
        let index = out.findIndex(existing => behaviorProfileKey(existing) === key);
        if (index >= 0) {
            // Same labeled category is a current-summary replacement. Exact semantic
            // equivalents keep the established wording to avoid churn; real refinements use the newer rule.
            out[index] = normalizeName(out[index]) === normalizeName(item) ? out[index] : item;
            continue;
        }
        const family = behaviorProfileFamily(item);
        if (family) index = out.findIndex(existing => behaviorProfileFamily(existing) === family);
        if (index >= 0) out[index] = mergeBehaviorFamilyEntries(out[index], item, family);
        else out.push(item);
    }
    return out.slice(0, BEHAVIOR_PROFILE_LIMIT);
}

// Behavioral Levers describe how an NPC generally responds or decides, as "Category: level - effect"
// with a recognised category ("Threat Sensitivity: high - vets strangers before trusting them").
// Concrete routines, duties, house rules and habits ("keeps a quiet household", "Household: enforces
// curfews") are evidence for a lever, or belong in Mannerisms/Role/Background, so a scan cannot add
// them as levers. Manual edits are not filtered.
const BEHAVIOR_LEVER_NON_LABELS = /^(?:habits?|routines?|duties|duty|rules?|house rules?|chores?|jobs?|work|schedule|practices?|customs?|actions?)$/i;
export function isBehaviorLever(value) {
    const text = cleanText(value, DURABLE_PROFILE_LIMITS.behaviorProfile);
    const label = behaviorLeverLabel(text);
    if (!label || BEHAVIOR_LEVER_NON_LABELS.test(label)) return false;
    if (behaviorProfileBody(text).replace(/[^\p{L}]/gu, '').length < 3) return false;
    return Boolean(behaviorProfileFamily(text));
}
