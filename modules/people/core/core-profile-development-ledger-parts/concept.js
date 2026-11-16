// Normalization of one profile-development concept record.
import * as mechanics from '../core-mechanics.js';
import { migrateLegacyStoryDay, STORY_DAY_SCHEME } from '../../legacy/calendar.js';
import { PROFILE_DEVELOPMENT_OBSERVATION_LIMIT } from './limits.js';
import { profileDevelopmentText, profileDevelopmentTurn, profileDevelopmentSourceMessageId } from './values.js';

export function normalizeProfileDevelopmentConcept(raw = {}) {
    const concept = mechanics.normalizeName(raw?.concept).slice(0, 60);
    if (!concept) return null;
    const sourceMessageIds = [...new Set((Array.isArray(raw?.sourceMessageIds) ? raw.sourceMessageIds : [])
        .map(profileDevelopmentSourceMessageId).filter(value => value !== null))]
        .sort((a, b) => a - b).slice(-PROFILE_DEVELOPMENT_OBSERVATION_LIMIT);
    const turns = [...new Set((Array.isArray(raw?.turns) ? raw.turns : [])
        .map(profileDevelopmentTurn).filter(value => value !== null))]
        .sort((a, b) => a - b).slice(-PROFILE_DEVELOPMENT_OBSERVATION_LIMIT);
    const currentDays = Number(raw?.dayScheme) === STORY_DAY_SCHEME;
    const days = [...new Set((Array.isArray(raw?.days) ? raw.days : [])
        .map(value => (currentDays ? Number(value) : migrateLegacyStoryDay(value))).filter(Number.isInteger))]
        .sort((a, b) => a - b).slice(-PROFILE_DEVELOPMENT_OBSERVATION_LIMIT);
    const firstTurn = profileDevelopmentTurn(raw?.firstTurn);
    const lastTurn = profileDevelopmentTurn(raw?.lastTurn);
    const observationCount = Math.max(
        0,
        Math.min(9, Math.round(Number(raw?.observationCount) || 0)),
        sourceMessageIds.length,
        turns.length,
    );
    const evidenceSamples = [...new Set((Array.isArray(raw?.evidenceSamples) ? raw.evidenceSamples : [])
        .map(item => profileDevelopmentText('speech', item, mechanics.DURABLE_PROFILE_LIMITS.evidence)).filter(Boolean))]
        .slice(-PROFILE_DEVELOPMENT_OBSERVATION_LIMIT);
    const latestEvidence = profileDevelopmentText('speech', raw?.latestEvidence, mechanics.DURABLE_PROFILE_LIMITS.evidence)
        || evidenceSamples.at(-1) || '';
    // v1 records had only latestEvidence. Seed one bounded sample during normalization, but once
    // v2 samples exist do not let a replayed source manufacture another historical observation.
    if (!evidenceSamples.length && latestEvidence) evidenceSamples.push(latestEvidence);
    return {
        concept,
        firstTurn: firstTurn ?? (turns.length ? Math.min(...turns) : null),
        lastTurn: lastTurn ?? (turns.length ? Math.max(...turns) : null),
        observationCount,
        sourceMessageIds,
        turns,
        ...(days.length ? { days, dayScheme: STORY_DAY_SCHEME } : {}),
        evidenceSamples,
        latestEvidence,
    };
}
