/* Builds the targeted backfill prompt that recovers one chosen NPC's dossier from recent story history. */
import { DURABLE_PROFILE_LIMITS } from '../core-relationship.js';
import { cleanList, cleanText, cleanWords, cleanWordsList } from '../core-text.js';
import { normalizeBehaviorProfile } from '../core-behavior.js';
import { KEY_RELATIONSHIP_LIMIT } from '../core-keyrel.js';
import { normalizeGender } from '../core-identity.js';
import { IMPORTANT_MEMORY_LIMIT } from '../core-record.js';
import { compactMemoryRubric, DEFAULT_MEMORY_CRITERIA } from '../core-prompts-criteria.js';
import { fillLooksLine } from '../../appearance/appearance-fill.js';
import { BEHAVIOR_LEVER_LABELS, PROFILE_STYLE_LINE, PROMPT_CAPS, returnShape } from './prompt-shared.js';
// NSD6 (approved wording), the fill-in of a new person in lines mode: off by default, so every other backfill prompt is the same bytes as before.
const QUOTE_LINE = 'For every fact you write, quote the few words of the story that show it. Leave a field out when you have no quote for it.';

export function buildBackfillPrompt({
    transcript,
    targetName = '',
    existingNpc = null,
    userName = 'User',
    charName = 'Character',
    memoryCriteria = DEFAULT_MEMORY_CRITERIA,
    fillLooks = false,
    quoteFacts = false,
}) {
    const target = cleanText(targetName, 120);
    const existing = existingNpc ? {
        id: cleanText(existingNpc.id, 100),
        name: cleanText(existingNpc.name, 120),
        aliases: cleanList(existingNpc.aliases, 8, 120),
        role: cleanText(existingNpc.role, 300),
        species: cleanText(existingNpc.species, 160),
        gender: normalizeGender(existingNpc.gender),
        homeBase: cleanText(existingNpc.homeBase, 300),
        age: cleanText(existingNpc.age, 80),
        apparentAge: cleanText(existingNpc.apparentAge, 80),
        appearance: cleanText(existingNpc.appearance, DURABLE_PROFILE_LIMITS.appearance),
        personality: cleanWords(existingNpc.personality, DURABLE_PROFILE_LIMITS.personality),
        speech: cleanWords(existingNpc.speech, DURABLE_PROFILE_LIMITS.speech),
        behaviorProfile: normalizeBehaviorProfile(existingNpc.behaviorProfile),
        mannerisms: cleanWordsList(existingNpc.mannerisms, 4, DURABLE_PROFILE_LIMITS.mannerism),
        background: cleanText(existingNpc.background, 320),
        keyRelationships: cleanWordsList(existingNpc.keyRelationships, KEY_RELATIONSHIP_LIMIT, DURABLE_PROFILE_LIMITS.keyRelationship),
        relationshipSummary: cleanText(existingNpc.relationshipSummary, 280),
        location: cleanText(existingNpc.location, 300),
        goal: cleanText(existingNpc.goal, 500),
        status: cleanText(existingNpc.status, 500),
        memories: cleanWordsList(existingNpc.memories, IMPORTANT_MEMORY_LIMIT, DURABLE_PROFILE_LIMITS.memory),
    } : null;
    const memoryRubric = compactMemoryRubric(memoryCriteria);

    return `You are NPC State Delta's targeted dossier backfill extractor. The player EXPLICITLY chose to keep one NPC. Do not decide whether the NPC is important or dossier-worthy. Your only task is to find that requested individual in the supplied recent story history and recover grounded dossier facts.

Requested NPC: ${target || '(missing target)'}
Player/main character to exclude: ${userName}
Main card speaker to exclude: ${charName}
Existing dossier (identity hint; its values change only as rule 12 says): ${JSON.stringify(existing)}

Rules:
1. Search the ENTIRE supplied history for the requested NPC. Match the requested personal name, an expanded full name, a known alias, or an unmistakable role reference tied to that same individual.
2. World State and NPC Inner Chatter are valid identity/evidence sections. A proper name established there can link nearby prose that calls the same person only by role, such as receptionist, guard, merchant, or clerk.
3. If the requested NPC is found, RETURN EXACTLY ONE NPC object. Do not return other NPCs. If the target genuinely does not occur and cannot be linked to a role/alias in this history, return {"npcs":[]}.
4. Preserve literal Species / Race. GENDER=male|female only if explicitly/unambiguously established; never infer. AGE is chronology only. APPARENT AGE is visual presentation and should be a compact approximate number like ~6 or ~24 when inferable; never prose such as "around six/twenties". Never infer fantasy lifespan from species.
5. A newer explicit correction/reveal beats an obscured prior impression. Apparent Age owns visual age; invent nothing.
6. Recover CURRENT COMPACT SUMMARIES, not notes. Important Memories are capped at 5. Key relationships=max5, ONE unambiguous entry/counterpart; never use dangling "(deceased)" that could modify the wrong person. Mannerisms=max4 DISTINCT recurring patterns, not separate animations of the same habit. behaviorProfile=max6 "Label: level - effect" levers: how they generally respond/decide (Label=${BEHAVIOR_LEVER_LABELS}). Actions are evidence; routines, duties, house rules and habits are not levers (habits=>mannerisms). Route player-specific patterns to relationshipSummary, one-off states to live fields, and consequential incidents to Memories. Memories=max5 distinct events; if crowded return memoryRetention=top5 most consequential/durable. ${PROFILE_STYLE_LINE}
7. NPC Inner Chatter may support durable personality, goals, attitude, or relationship-summary evidence, but do not store the moment-to-moment internal monologue itself.
8. PRESENT is current-scene state, not historical presence. Set present=true only if the requested NPC physically appears or actively participates in the MOST RECENT ASSISTANT STORY MESSAGE contained in this history. An older appearance does not count. A World State mention alone does not establish presence. Set worldActive=true only for explicit current off-screen activity in the latest World State; present and worldActive are mutually exclusive.
9. This is historical backfill. relationshipImpact MUST be "none" and every relationshipDelta value MUST be 0. Do not numerically replay old relationship events.
10. Do not create a dossier for ${userName} or ${charName}.
11. HOME BASE / USUAL LOCATION is durable home, workplace, headquarters, or regular haunt, not the current scene location. Establish it only from grounded ongoing-life evidence; changing an established homeBase requires homeBaseState:"update"+homeBaseReason. Keep the JSON compact enough to finish reliably, caps: ${PROMPT_CAPS}. Merge overlaps rather than append. Unknown facts may be empty.
12. A value the dossier already has changes only by its *State, as in the scan: refine=correction/reveal, FULL field; evolve/change/advance/correct/update+reason=lasting change; keyRelationships merge by counterpart; "clear" only when explicitly ended.
13. Output JSON only. No markdown, no code fence, no commentary. Finish and close every quoted string, array, and object before stopping.${quoteFacts ? `\n${QUOTE_LINE}` : ''}

Memory criteria:
${memoryRubric || '(none configured; store only clearly durable story-relevant events)'}

${returnShape('backfill', { relationshipSummary: `"stance toward ${userName}"` })}

Recent story history:
${String(transcript || '').trim()}${fillLooks ? fillLooksLine(existingNpc || {}) : ''}`;
}
