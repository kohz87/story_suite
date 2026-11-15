/* Builds the dossier import prompt that fills one NPC from supplied structured dossier text. */
import { DURABLE_PROFILE_LIMITS } from '../core-relationship.js';
import { cleanList, cleanText, cleanWords, cleanWordsList } from '../core-text.js';
import { normalizeBehaviorProfile } from '../core-behavior.js';
import { KEY_RELATIONSHIP_LIMIT } from '../core-keyrel.js';
import { normalizeGender } from '../core-identity.js';
import { BEHAVIOR_LEVER_LABELS, PROFILE_STYLE_LINE, PROMPT_CAPS, returnShape } from './prompt-shared.js';
export function buildDossierImportPrompt({
    dossierText,
    targetName = '',
    existingNpc = null,
    userName = 'User',
    charName = 'Character',
}) {
    const target = cleanText(targetName, 120);
    const existing = existingNpc ? {
        id: cleanText(existingNpc.id, 100), name: cleanText(existingNpc.name, 120),
        aliases: cleanList(existingNpc.aliases, 8, 120), role: cleanText(existingNpc.role, 240),
        species: cleanText(existingNpc.species, 160), gender: normalizeGender(existingNpc.gender), homeBase: cleanText(existingNpc.homeBase, 300), age: cleanText(existingNpc.age, 80),
        apparentAge: cleanText(existingNpc.apparentAge, 80), appearance: cleanText(existingNpc.appearance, DURABLE_PROFILE_LIMITS.appearance),
        personality: cleanWords(existingNpc.personality, DURABLE_PROFILE_LIMITS.personality), speech: cleanWords(existingNpc.speech, DURABLE_PROFILE_LIMITS.speech),
        behaviorProfile: normalizeBehaviorProfile(existingNpc.behaviorProfile),
        background: cleanText(existingNpc.background, 320), keyRelationships: cleanWordsList(existingNpc.keyRelationships, KEY_RELATIONSHIP_LIMIT, DURABLE_PROFILE_LIMITS.keyRelationship),
        relationshipSummary: cleanText(existingNpc.relationshipSummary, 280), mannerisms: cleanWordsList(existingNpc.mannerisms, 4, DURABLE_PROFILE_LIMITS.mannerism),
    } : null;
    return `NPC State Delta explicit DOSSIER IMPORT. The player deliberately asked to populate one existing NPC from the supplied structured dossier text. Use ONLY that dossier text, not outside knowledge. Return exactly one compact NPC object for the requested person, or {"npcs":[]} if it is clearly a different person.

Requested NPC: ${target}
Player (exclude from Key Relationships): ${userName}
Main card speaker: ${charName}
Existing NPC State Delta record: ${JSON.stringify(existing)}

Mapping/rules:
1. Inner Circle / family / close allies / rivals / mentors / partners => keyRelationships, max ${KEY_RELATIONSHIP_LIMIT}, one "Name — their role to this NPC | durable dynamic" entry each. Never dangling "(deceased)"; state who is late/surviving. Never put ${userName} there; player stance belongs relationshipSummary.
2. Voice=>speech; Personality=>personality; Appearance=>overallAppearance (body only: kind, age look, build, height, hair, eyes, marks)+appearance (clothes and their state, fewest words; no body traits); named forms=>each form complete; Background=>background; Role=>role; explicit chronological Age=>age. Explicit/unambiguous Gender/Sex=>gender=male|female; never infer. Apparent Age should be compact ~N when inferable; Appearance must not duplicate an explicit age. behaviorProfile=max6 "Label: level - effect" levers: how they generally respond/decide (Label=${BEHAVIOR_LEVER_LABELS}). Actions are evidence; routines, duties, house rules and habits are not levers (habits=>mannerisms). Player-specific/one-scene behavior does not belong there. Do not infer species/age from stereotypes.
3. Read on the PC/current stance toward ${userName} may initialize relationshipSummary, but relationshipImpact="none" and every relationshipDelta key MUST be 0. Never invent numeric Trust/Affection/Desire/Tension from prose.
4. Agenda may initialize goal only when the dossier presents it as the NPC's current ongoing agenda. "Where to Find Them", home, workplace, headquarters, or regular haunt => homeBase, NOT current Location. Changing an established homeBase requires homeBaseState:"update"+homeBaseReason. Do not map home/work/hangout into live location unless the dossier explicitly says they are there now. Do not invent Mood/Status/current presence.
5. A durable Tell may become a mannerism. One-scene/emotional/stress/player-specific behavior does not. Merge multiple animations of one recurring pattern into one mannerism. Important memories only from explicit consequential past events, max3 new, in npcs[]; added to stored ones.
6. Existing unlocked durable fields may refine from established facts. Empty != permission to guess from one act: seed only direct description, recurrence, or stable cross-context evidence (an empty background is filled from stated role, workplace, history or circumstances). Return FULL CURRENT COMPACT fields; merge duplicate concepts first. personality/speech/appearance/mannerisms/behaviorProfile use refine; lasting change uses evolve/change+reason; age advance|correct+reason; apparentAge evolve+reason; background update+reason. Player-specific behavior=>relationshipSummary. Social update/evolve merges named counterparts; omission never erases others. ${PROFILE_STYLE_LINE}
7. KeyRelationships update/evolve merge by named counterpart and never erase unrelated ties by omission. Estrangement, death, reconciliation, or rivalry changes that counterpart entry; otherwise omit unchanged fields.
8. JSON only. Compact caps: ${PROMPT_CAPS}. Never repeat a fact just to preserve wording.

${returnShape('import')}

Structured dossier text:
${String(dossierText || '').trim()}`;
}
