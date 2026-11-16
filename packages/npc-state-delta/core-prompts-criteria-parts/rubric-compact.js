/* Shortens the relationship, impact and memory rubrics to their compact prompt wording when they are the stock text. */
import { DEFAULT_IMPACT_CRITERIA, DEFAULT_MEMORY_CRITERIA, DEFAULT_RELATIONSHIP_CRITERIA } from './default-criteria.js';
function compactScannerWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function compactRelationshipRubric(value) {
    const configured = compactScannerWhitespace(value);
    const stock = compactScannerWhitespace(DEFAULT_RELATIONSHIP_CRITERIA);
    if (!configured || configured === stock) {
        return 'Axes independent; 0 neutral; unsupported axes stay 0. Trust=reliance/safety, Affection=care, Desire=established attraction, Tension=pressure. Routine continuation is no change.';
    }
    return configured;
}

export function compactImpactRubric(value) {
    const configured = compactScannerWhitespace(value);
    const stock = compactScannerWhitespace(DEFAULT_IMPACT_CRITERIA);
    if (!configured || configured === stock) {
        return 'none=no new evidence/continuation; ordinary=new modest beat; meaningful=clear new event; major=lasting turning point; extreme=rare defining event.';
    }
    return configured;
}

export function compactMemoryRubric(value) {
    const configured = compactScannerWhitespace(value);
    const stock = compactScannerWhitespace(DEFAULT_MEMORY_CRITERIA);
    if (!configured || configured === stock) {
        return 'Store durable story-relevant events affecting later decisions/relationships/goals/obligations/fears/knowledge. Favor promises, betrayals, rescues, confessions, major discoveries/conflicts/losses/commitments. Reject routine dialogue/transactions, transient/repeated facts/raw Inner Chatter/trivia/duplicates.';
    }
    return configured;
}
