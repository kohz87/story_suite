// Ledger model: empty/normalized/reset/rebased ledgers and the per-NPC ledger accessor.
import * as mechanics from '../core-mechanics.js';
import { PROFILE_DEVELOPMENT_CONCEPT_LIMIT } from './limits.js';
import { PROFILE_DEVELOPMENT_FIELDS, PROFILE_DEVELOPMENT_VERSION } from './fields.js';
import { profileDevelopmentText, profileDevelopmentTurn, profileDevelopmentSourceMessageId } from './values.js';
import { profileDevelopmentEvidence, parseProfileDevelopmentEvidence } from './evidence.js';
import { normalizeProfileDevelopmentConcept } from './concept.js';

function legacyProfileDevelopmentConcepts(field, npc = {}) {
    const concepts = [];
    for (const evidence of profileDevelopmentEvidence(field, { evidence: npc?.profileEvidence || {} })) {
        const parsed = parseProfileDevelopmentEvidence(field, evidence);
        if (!parsed) continue;
        const duplicate = concepts.some(record => mechanics.durableProfileEvidenceRelated(record.latestEvidence, parsed.body));
        if (duplicate) continue;
        concepts.push({
            concept: parsed.concept,
            firstTurn: null,
            lastTurn: null,
            observationCount: 1,
            sourceMessageIds: [],
            turns: [],
            evidenceSamples: [parsed.body],
            latestEvidence: parsed.body,
        });
        if (concepts.length >= PROFILE_DEVELOPMENT_CONCEPT_LIMIT) break;
    }
    return concepts;
}

export function emptyProfileDevelopment(field, npc = {}, concepts = []) {
    const config = PROFILE_DEVELOPMENT_FIELDS[field];
    if (!config) return null;
    return {
        version: PROFILE_DEVELOPMENT_VERSION,
        epoch: 0,
        [config.baselineKey]: profileDevelopmentText(field, npc?.[field]),
        baselineTurn: null,
        baselineSourceMessageId: null,
        concepts: concepts.map(normalizeProfileDevelopmentConcept).filter(Boolean).slice(-PROFILE_DEVELOPMENT_CONCEPT_LIMIT),
    };
}

function normalizeProfileDevelopment(field, raw, npc = {}, { seedLegacy = false } = {}) {
    const config = PROFILE_DEVELOPMENT_FIELDS[field];
    if (!config) return null;
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
    if (!source) {
        const seeded = seedLegacy ? legacyProfileDevelopmentConcepts(field, npc) : [];
        return seeded.length ? emptyProfileDevelopment(field, npc, seeded) : null;
    }
    const concepts = [];
    const byConcept = new Map();
    for (const item of Array.isArray(source.concepts) ? source.concepts : []) {
        const normalized = normalizeProfileDevelopmentConcept(item);
        if (!normalized) continue;
        if (byConcept.has(normalized.concept)) concepts[byConcept.get(normalized.concept)] = normalized;
        else {
            byConcept.set(normalized.concept, concepts.length);
            concepts.push(normalized);
        }
    }
    return {
        version: PROFILE_DEVELOPMENT_VERSION,
        epoch: Math.max(0, Math.round(Number(source.epoch) || 0)),
        [config.baselineKey]: profileDevelopmentText(field, source[config.baselineKey] ?? npc?.[field]),
        baselineTurn: profileDevelopmentTurn(source.baselineTurn),
        baselineSourceMessageId: profileDevelopmentSourceMessageId(source.baselineSourceMessageId),
        concepts: concepts.slice(-PROFILE_DEVELOPMENT_CONCEPT_LIMIT),
    };
}

export function resetProfileDevelopment(field, ledger, value, options = {}) {
    const config = PROFILE_DEVELOPMENT_FIELDS[field];
    return {
        version: PROFILE_DEVELOPMENT_VERSION,
        epoch: Math.max(0, Math.round(Number(ledger?.epoch) || 0)) + 1,
        [config.baselineKey]: profileDevelopmentText(field, value),
        baselineTurn: profileDevelopmentTurn(options.turn),
        baselineSourceMessageId: profileDevelopmentSourceMessageId(options.sourceMessageId),
        concepts: [],
    };
}

export function rebaseProfileDevelopment(field, ledger, value) {
    const config = PROFILE_DEVELOPMENT_FIELDS[field];
    return { ...ledger, [config.baselineKey]: profileDevelopmentText(field, value) };
}

export function profileDevelopmentForNpc(field, npc = {}, { seedLegacy = false } = {}) {
    const config = PROFILE_DEVELOPMENT_FIELDS[field];
    if (!config) return null;
    let ledger = normalizeProfileDevelopment(field, npc?.[config.ledgerKey], npc, { seedLegacy });
    if (!ledger) return null;
    const current = profileDevelopmentText(field, npc?.[field]);
    if (mechanics.normalizeName(ledger[config.baselineKey]) !== mechanics.normalizeName(current)) {
        ledger = resetProfileDevelopment(field, ledger, current);
    }
    return ledger;
}
