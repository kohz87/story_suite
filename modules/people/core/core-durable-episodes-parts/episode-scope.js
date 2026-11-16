/* NPC State Delta episode scoping: narrows a story window to the sentences about one bound NPC. */

import { cleanText, normalizeName } from '../core-text.js';
import { developmentBindingLabels, developmentContextSegments, episodeContainsLabel } from './episode-labels.js';

export const BATCH_EPISODE_MAX_CHARS = 5200;

export function scopedEpisodeText(window, binding = null) {
    if (!binding) return cleanText(window, BATCH_EPISODE_MAX_CHARS);
    const targetLabels = developmentBindingLabels(binding);
    const otherLabels = (Array.isArray(binding?.otherLabels) ? binding.otherLabels : []).map(normalizeName).filter(Boolean);
    const segments = developmentContextSegments(window);
    const targetMentioned = segments.some(segment => episodeContainsLabel(segment, targetLabels));
    const otherMentioned = segments.some(segment => episodeContainsLabel(segment, otherLabels));
    if (!targetMentioned && binding?.targeted === true && !otherMentioned) return cleanText(window, BATCH_EPISODE_MAX_CHARS);

    const selected = [];
    let carryPronoun = false;
    for (const segment of segments) {
        const targetHere = episodeContainsLabel(segment, targetLabels);
        const otherHere = episodeContainsLabel(segment, otherLabels);
        if (otherHere && !targetHere) {
            carryPronoun = false;
            continue;
        }
        if (targetHere) {
            selected.push(segment);
            carryPronoun = true;
            continue;
        }
        const normalized = normalizeName(segment).replace(/^m\d+\s+/, '');
        const pronounContinuation = /^(?:(?:when\s+)?(?:she|he|they)|her|his|their|by then|during that time|during this time|throughout that time|throughout this period)\b/.test(normalized)
            || /^by\b.{0,72}\b(?:she|he|they)\b/.test(normalized);
        if (carryPronoun && pronounContinuation) {
            selected.push(segment);
            carryPronoun = false;
        } else {
            carryPronoun = false;
        }
    }
    return cleanText(selected.join(' '), BATCH_EPISODE_MAX_CHARS);
}
