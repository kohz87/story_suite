/* NPC State Delta record normalization: turns any raw stored or incoming dossier into the canonical record. */
import { inferNpcIdentityKind, normalizeBoolean, normalizeGender, normalizeLifeState, normalizeStoredAgeFields } from '../core-identity.js';
import { appendRelationshipEvent, calibrateRelationshipSummary, compactDurableText, DURABLE_PROFILE_LIMITS, normalizeRelationshipAuditDelta, normalizeRelationshipBaseline, normalizeRelationshipEventHistory, normalizeRelationshipEvidence, normalizeRelationshipImpact, normalizeRelationshipMilestones, normalizeRelationshipProgress, RELATIONSHIP_KEYS, relationshipEventMessage } from '../core-relationship.js';
import { cleanList, cleanText, normalizeName } from '../core-text.js';
import { cleanTieSeen, compactKeyRelationshipEntry, KEY_RELATIONSHIP_LIMIT, mergeKeyRelationshipUpdates } from '../core-keyrel.js';
import { normalizeMannerisms } from '../core-durable.js';
import { BEHAVIOR_PROFILE_LIMIT, normalizeBehaviorProfile } from '../core-behavior.js';
import { PORTRAIT_NPC_PROMPT_LIMIT } from '../../portrait/core-portrait.js';
import { normalizeProfileEvidence } from '../core-evidence.js';
import { normalizeFactMemories } from '../../memory/memory-fact-store.js';
import { CAST_APPEARANCE_WIDE, castAppearanceKept, normalizeAppearanceCanon, normalizeLifeStateCertainty, normalizeMemoryStamps, normalizePortraitSeed, normalizeStoredMemories, stripRecordCitations } from '../core-record-shared.js';
import { impactDayProblems } from '../../legacy/relationship-pacing.js';
import { normalizeCustomFields } from '../core-record-custom-fields.js';

const ALIAS_KEYS = ['sex', 'race', 'ancestry', 'speciesRace', 'species_race', 'home_base', 'usualLocation', 'usual_location', 'whereToFind', 'where_to_find', 'identity_kind',
    'portrait_prompt_positive', 'portrait_prompt_negative', 'portrait_prompt_replace', 'portrait_seed', 'behavior_profile', 'key_relationships', 'innerCircle', 'inner_circle',
    'family', 'profile_evidence', 'relationship_progress', 'relationship_milestones', 'relationship_event_history', 'isMinor', 'is_minor', 'hideFromGallery', 'hide_from_gallery'];

export function normalizeNpcRecord(rawInput = {}) {
    const raw = stripRecordCitations(rawInput);
    const npc = { ...raw };
    // Manual profile locks block scanner rewrites. Data hygiene still normalizes whitespace,
    // but semantic compaction is skipped for explicitly locked stable fields.
    npc.manualProfileFields = Array.isArray(raw.manualProfileFields)
        ? [...new Set(raw.manualProfileFields.map(value => String(value || '').trim()).filter(Boolean))]
        : [];
    const locked = new Set(npc.manualProfileFields);

    npc.name = cleanText(raw.name, 120) || 'Unnamed NPC';
    npc.identityKind = inferNpcIdentityKind(npc.name, raw.identityKind ?? raw.identity_kind);
    npc.role = cleanText(raw.role, 300);
    npc.species = cleanText(raw.species ?? raw.race ?? raw.ancestry ?? raw.speciesRace ?? raw.species_race, 160);
    npc.gender = normalizeGender(raw.gender ?? raw.sex);
    npc.homeBase = cleanText(raw.homeBase ?? raw.home_base ?? raw.usualLocation ?? raw.usual_location ?? raw.whereToFind ?? raw.where_to_find, 300);
    const customFields = normalizeCustomFields(raw.customFields);
    if (Object.keys(customFields).length) npc.customFields = customFields;
    else delete npc.customFields;
    const ageFields = normalizeStoredAgeFields(raw);
    npc.age = ageFields.age;
    npc.apparentAge = ageFields.apparentAge;
    // (the living cast) A dossier made from the pack's cast keeps the pack's words exactly as written (`castFrom.first`) for as long as
    // the stored field still is those words; once a scan or the reader changes the field it is compacted like any other.
    const packFirst = raw.castFrom && typeof raw.castFrom.first === 'object' && raw.castFrom.first ? raw.castFrom.first : {};
    const packWords = (field, max) => {
        const text = typeof packFirst[field] === 'string' ? cleanText(packFirst[field], max) : '';
        return text && cleanText(raw[field], max) === text;
    };
    npc.personality = locked.has('personality') || packWords('personality', 900)
        ? cleanText(raw.personality, 900)
        : compactDurableText(raw.personality, DURABLE_PROFILE_LIMITS.personality, 6);
    npc.speech = locked.has('speech') || packWords('speech', 600)
        ? cleanText(raw.speech, 600)
        : compactDurableText(raw.speech, DURABLE_PROFILE_LIMITS.speech, 5);
    // The stored appearance of a cast dossier is "<physical>; <current part>": the pack's `wears` is the current part, compared apart
    // from the physical words. While it is unchanged the whole text stays exact (any size the pack allows); once a scan or the reader
    // changed the current part, the normal canon applies to that part alone and the pack's physical words stay in front of it.
    const castKept = castAppearanceKept(raw);
    if (locked.has('appearance')) npc.appearance = cleanText(raw.appearance, 1800);
    else if (castKept.appearance) npc.appearance = cleanText(raw.appearance, CAST_APPEARANCE_WIDE);
    else if (castKept.overall && castKept.split && castKept.part) {
        const part = normalizeAppearanceCanon(castKept.part);
        npc.appearance = part ? cleanText(`${castKept.head}; ${part}`, CAST_APPEARANCE_WIDE) : cleanText(castKept.head, CAST_APPEARANCE_WIDE);
    } else npc.appearance = normalizeAppearanceCanon(raw.appearance);
    npc.background = locked.has('background') || packWords('background', 1200)
        ? cleanText(raw.background, 1200)
        : compactDurableText(raw.background, DURABLE_PROFILE_LIMITS.background, 8);
    npc.relationshipSummary = compactDurableText(raw.relationshipSummary, DURABLE_PROFILE_LIMITS.relationshipSummary, 6);
    npc.mood = cleanText(raw.mood, 300);
    npc.location = cleanText(raw.location, 300);
    npc.goal = cleanText(raw.goal, 500);
    npc.status = cleanText(raw.status, 500);
    npc.portraitPromptPositive = cleanText(raw.portraitPromptPositive ?? raw.portrait_prompt_positive, PORTRAIT_NPC_PROMPT_LIMIT);
    npc.portraitPromptNegative = cleanText(raw.portraitPromptNegative ?? raw.portrait_prompt_negative, PORTRAIT_NPC_PROMPT_LIMIT);
    npc.portraitPromptReplace = normalizeBoolean(raw.portraitPromptReplace ?? raw.portrait_prompt_replace);
    npc.portraitSeed = normalizePortraitSeed(raw.portraitSeed ?? raw.portrait_seed);
    npc.aliases = cleanList(raw.aliases, 8, 120);
    // A dossier carrying memory facts keeps its facts through an exact-text pass only (src/memory-fact-store.js); any other runs the original normalizer.
    const factual = raw.memoryFacts ? normalizeFactMemories(raw.memories, raw.memoryFacts, raw.manualMemories) : null;
    npc.memories = factual ? factual.memories : normalizeStoredMemories(raw.memories);
    // The memories the reader entered by hand (never evicted by a later scan), while they are stored.
    const manualMemories = Array.isArray(raw.manualMemories)
        ? raw.manualMemories.map(item => cleanText(item, DURABLE_PROFILE_LIMITS.memory)).filter(item => item && npc.memories.some(stored => normalizeName(stored) === normalizeName(item)))
        : [];
    if (manualMemories.length) npc.manualMemories = [...new Set(manualMemories)];
    else delete npc.manualMemories;
    if (factual?.facts) npc.memoryFacts = factual.facts;
    else delete npc.memoryFacts;
    const memoryStamps = normalizeMemoryStamps(raw.memoryStamps, npc.memories);
    if (memoryStamps) npc.memoryStamps = memoryStamps;
    else delete npc.memoryStamps;
    // A pack's levers and mannerisms are lists: whole while the stored list still is the pack's list (the cast builds them to pass the
    // normalizers unchanged; this keeps them if a normalizer ever changes).
    const packList = (field, max, chars) => {
        const first = Array.isArray(packFirst[field]) ? cleanList(packFirst[field], max, chars) : [];
        const stored = cleanList(field === 'behaviorProfile' ? raw.behaviorProfile ?? raw.behavior_profile : raw[field], max, chars);
        return first.length && first.length === stored.length && first.every((item, index) => item === stored[index]) ? stored : null;
    };
    npc.mannerisms = locked.has('mannerisms')
        ? cleanList(raw.mannerisms, 8, 320)
        : packList('mannerisms', 4, DURABLE_PROFILE_LIMITS.mannerism) ?? normalizeMannerisms(raw.mannerisms);
    npc.behaviorProfile = locked.has('behaviorProfile')
        ? cleanList(raw.behaviorProfile ?? raw.behavior_profile, BEHAVIOR_PROFILE_LIMIT, 320)
        : packList('behaviorProfile', BEHAVIOR_PROFILE_LIMIT, DURABLE_PROFILE_LIMITS.behaviorProfile) ?? normalizeBehaviorProfile(raw.behaviorProfile ?? raw.behavior_profile);
    npc.keyRelationships = locked.has('keyRelationships')
        ? (Array.isArray(raw.keyRelationships ?? raw.key_relationships ?? raw.innerCircle ?? raw.inner_circle ?? raw.family)
            ? (raw.keyRelationships ?? raw.key_relationships ?? raw.innerCircle ?? raw.inner_circle ?? raw.family)
                .map(compactKeyRelationshipEntry).filter(Boolean).slice(0, KEY_RELATIONSHIP_LIMIT)
            : [])
        : mergeKeyRelationshipUpdates([], raw.keyRelationships ?? raw.key_relationships ?? raw.innerCircle ?? raw.inner_circle ?? raw.family);
    { const seen = cleanTieSeen(raw.tieSeen); if (seen) npc.tieSeen = seen; }   // last story day each tie's person was mentioned (core-keyrel.js)
    npc.profileEvidence = normalizeProfileEvidence(raw.profileEvidence ?? raw.profile_evidence);
    // Current Thoughts are not durable dossier state; NPC Inner Chatter is ephemeral.
    delete npc.thoughts;
    const relationship = raw.relationship && typeof raw.relationship === 'object' ? raw.relationship : {};
    npc.relationship = normalizeRelationshipBaseline(relationship);
    npc.relationshipProgress = normalizeRelationshipProgress(raw.relationshipProgress ?? raw.relationship_progress);
    // The events counted for the story day (src/relationship-pacing.js); absent until a paced event, dropped when unusable.
    if (!impactDayProblems(raw.impactDay).length) npc.impactDay = structuredClone(raw.impactDay);
    else delete npc.impactDay;
    npc.relationshipMilestones = normalizeRelationshipMilestones(raw.relationshipMilestones ?? raw.relationship_milestones, npc.relationship);
    npc.relationshipEventHistory = normalizeRelationshipEventHistory(raw.relationshipEventHistory ?? raw.relationship_event_history);
    npc.relationshipSummary = calibrateRelationshipSummary(npc.relationshipSummary, npc.relationship);
    const lastChange = raw.lastRelationshipChange && typeof raw.lastRelationshipChange === 'object' ? raw.lastRelationshipChange : {};
    const normalizedAuditDelta = normalizeRelationshipAuditDelta(lastChange.delta ?? {});
    const auditHasDelta = RELATIONSHIP_KEYS.some(key => normalizedAuditDelta[key] !== 0);
    const auditEvidence = normalizeRelationshipEvidence(lastChange.evidence);
    const auditHasEvidence = RELATIONSHIP_KEYS.some(key => auditEvidence[key]);
    const auditReason = cleanText(lastChange.reason, 500);
    const auditIsManual = String(lastChange.impact || '').toLowerCase() === 'manual';
    npc.lastRelationshipChange = (auditHasDelta || auditHasEvidence) && !auditReason && !auditIsManual
        ? {
            impact: 'none',
            delta: { trust: 0, affection: 0, desire: 0, tension: 0 },
            evidence: normalizeRelationshipEvidence(),
            reason: '',
            sourceMessageId: null,
        }
        : {
            impact: auditIsManual ? 'manual' : normalizeRelationshipImpact(lastChange.impact, auditHasDelta || auditHasEvidence),
            delta: normalizedAuditDelta,
            evidence: auditEvidence,
            reason: auditReason,
            sourceMessageId: Number.isInteger(lastChange.sourceMessageId) ? lastChange.sourceMessageId : null,
            ...(Number.isFinite(Number(lastChange.turn)) ? { turn: Number(lastChange.turn) } : {}),
            ...relationshipEventMessage(lastChange),
        };
    if (!npc.relationshipEventHistory.length
        && npc.lastRelationshipChange.impact !== 'none'
        && npc.lastRelationshipChange.impact !== 'manual'
        && npc.lastRelationshipChange.reason) {
        npc.relationshipEventHistory = appendRelationshipEvent([], npc.lastRelationshipChange);
    }
    npc.present = normalizeBoolean(raw.present);
    npc.worldActive = normalizeBoolean(raw.worldActive) && !npc.present;
    npc.lifeState = normalizeLifeState(raw.lifeState);
    npc.lifeStateCertainty = normalizeLifeStateCertainty(raw.lifeStateCertainty);
    npc.lifeStateReason = cleanText(raw.lifeStateReason, 500);
    npc.minor = normalizeBoolean(raw.minor ?? raw.isMinor ?? raw.is_minor ?? raw.hideFromGallery ?? raw.hide_from_gallery);
    npc.lastSeenTurn = Math.max(0, Math.round(Number(raw.lastSeenTurn) || 0));
    npc.lastWorldActiveTurn = Math.max(0, Math.round(Number(raw.lastWorldActiveTurn) || 0));
    npc.seenCount = Math.max(0, Math.round(Number(raw.seenCount) || 0));
    npc.createdAt = Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now();
    npc.updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : npc.createdAt;
    delete npc.importance;
    delete npc.manual;
    // P6: no archive or retention fields any more (the old ones in a stored record are dropped here); a death is lifeState 'deceased'.
    for (const gone of ['archived', 'archiveReason', 'archivedAt', 'archiveSourceMessageId', 'retentionProtected']) delete npc[gone];
    // The alias spellings are read above and then dropped, so a record holds only the canonical fields (the people store refuses any other key).
    for (const alias of ALIAS_KEYS) delete npc[alias];
    return npc;
}
