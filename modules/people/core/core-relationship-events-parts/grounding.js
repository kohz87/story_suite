/* NPC State Delta relationship grounding: whether evidence and reasons are grounded in the source text, and filtering deltas by evidence. */
import { cleanText } from '../core-text.js';
import { normalizeRelationshipDelta, RELATIONSHIP_KEYS } from '../core-relationship-model.js';
import { durableSeedGrounded } from '../core-relationship-text.js';
import { normalizeRelationshipEvidence } from './shared-evidence.js';

const RELATIONSHIP_AXIS_CUES = Object.freeze({
    trust: /\b(trust(?:s|ed|ing)?|rely|relies|relied|relying|reliance|reliable|dependable|promise(?:s|d)?|confidence|confide(?:s|d)?|vulnerab|safe|safety|protect(?:s|ed|ing)?|rescu|betray|betrayed|deceiv|deception|lied|lying|honest|secret|abandon|unreliable|faith)\b/i,
    affection: /\b(affection|fond|fondness|care(?:s|d|ing)?|warmth|kindness|comfort|bond(?:s|ed|ing)?|companionship|companion|attached|attachment|love(?:s|d)?|like(?:s|d)?|resent|resentment|dislike|hate(?:s|d)?|hurt|reject(?:s|ed|ion)?|humiliat|neglect|cherish)\b/i,
    desire: /\b(desire|desires|desired|desiring|attract|attracts|attracted|attracting|attraction|attractive|romantic|romance|intimacy|intimate|kiss|kisses|kissed|kissing|sexual|sexually|lust|longing|yearn|yearns|yearned|yearning|flirt|flirts|flirted|flirting|date|dating|lover|physical closeness|physical contact|(?:want|wants|wanted|wanting) (?:him|her|them|the player)|drawn to)\b/i,
    tension: /\b(tension|tense|awkward|fear|afraid|suspicion|suspicious|argument|argued|threat|threaten|pressure|rival|rivalry|resent|conflict|hostil|unease|uneasy|reconcil|relief|relaxed|ease|eased|reassur|strain|friction)\b/i,
});

export function relationshipAxisEvidenceGrounded(key, evidence, context = '') {
    if (!RELATIONSHIP_KEYS.includes(key)) return false;
    const explanation = cleanText(evidence, 300);
    if (!explanation) return false;
    const source = String(context || '').trim();
    if (key === 'desire') {
        if (!RELATIONSHIP_AXIS_CUES.desire.test(explanation)) return false;
        if (!source) return true;
        return RELATIONSHIP_AXIS_CUES.desire.test(source) && relationshipChangeReasonGrounded(explanation, source);
    }
    if (!source) return true;
    return relationshipChangeReasonGrounded(explanation, source);
}

export function filterRelationshipDeltaByEvidence(delta, evidence, context = '') {
    const normalized = normalizeRelationshipDelta(delta);
    const proof = normalizeRelationshipEvidence(evidence);
    return Object.fromEntries(RELATIONSHIP_KEYS.map(key => [
        key,
        normalized[key] !== 0 && relationshipAxisEvidenceGrounded(key, proof[key], context) ? normalized[key] : 0,
    ]));
}

export function relationshipChangeReasonGrounded(reason, context = '') {
    const explanation = cleanText(reason, 500);
    if (!explanation) return false;
    const source = String(context || '').trim();
    if (!source) return true;
    return durableSeedGrounded(explanation, source);
}
