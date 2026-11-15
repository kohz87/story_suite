/* NPC State Delta presentation scope: NPC-scoped narration plus the continuation sentences that follow it. */

import { normalizeName } from '../core-text.js';
import { developmentBindingLabels, developmentContextSegments, episodeContainsLabel, scopedEpisodeText } from '../core-durable-episodes.js';

// The npcs row carries no evidence quotes, and NPC-scoped story text keeps only sentences that name
// the NPC, so an outfit change narrated in the next sentence ("A moment later she returns in a
// sundress") had no support in routine scans. Supply that story text itself: up to two sentences
// that directly follow a sentence naming only this NPC, stopping at any sentence naming another NPC.
export function presentationContinuationEvidence(context = '', npc = null, otherLabels = []) {
    const source = String(context || '').trim();
    const targetLabels = developmentBindingLabels({ npc });
    if (!source || !targetLabels.length) return [];
    const others = (Array.isArray(otherLabels) ? otherLabels : []).map(normalizeName).filter(Boolean)
        .filter(label => !targetLabels.includes(label));
    const evidence = [];
    let remaining = 0;
    for (const segment of developmentContextSegments(source)) {
        const targetHere = episodeContainsLabel(segment, targetLabels);
        const otherHere = others.length > 0 && episodeContainsLabel(segment, others);
        if (targetHere) {
            remaining = otherHere ? 0 : 2;
            continue;
        }
        if (otherHere) {
            remaining = 0;
            continue;
        }
        if (remaining > 0) {
            evidence.push(segment);
            remaining -= 1;
        }
    }
    return evidence;
}

// Story text the appearance model may ground one NPC's update in: sentences naming the NPC, its
// pronoun follow-up and the presentation continuation above. Narration that says nothing about the
// NPC yields a placeholder that grounds nothing, so another NPC's scene cannot support the update.
const NO_NPC_NARRATION = '[no narration about this NPC]';
export function npcScopedNarration(context = '', npc = null, otherLabels = []) {
    const raw = String(context || '').trim();
    if (!raw) return '';
    const scoped = [
        scopedEpisodeText(raw, { npc, otherLabels }),
        ...presentationContinuationEvidence(raw, npc, otherLabels),
    ].filter(Boolean).join(' ');
    return scoped || NO_NPC_NARRATION;
}
