/* NPC State Delta durable refinement support text: the story and evidence text a refinement may be grounded in. */

import { cleanText, normalizeName } from '../core-text.js';
import { DURABLE_PROFILE_LIMITS } from '../core-relationship.js';
import { developmentBindingLabels, episodeContainsLabel, normalizedPhrasePresent, scopedEpisodeText } from '../core-durable-episodes.js';

export function durableRefinementSupportText(context = '', evidenceItems = [], binding = null) {
    const rawContext = String(context || '').trim();
    const effectiveBinding = binding?.npc || (binding && typeof binding === 'object' && binding.name ? binding : null);
    const scopedContext = (effectiveBinding && rawContext) ? scopedEpisodeText(rawContext, binding) : rawContext;
    const targetLabels = binding ? developmentBindingLabels(binding) : [];
    const otherLabels = (Array.isArray(binding?.otherLabels) ? binding.otherLabels : []).map(normalizeName).filter(Boolean);
    const evidence = (Array.isArray(evidenceItems) ? evidenceItems : [])
        .filter(value => {
            const attributed = cleanText(String(value || '').replace(/^\[m\d+\]\s*/i, ''), DURABLE_PROFILE_LIMITS.evidence);
            if (!attributed) return false;
            if (otherLabels.length && episodeContainsLabel(attributed, otherLabels) && !episodeContainsLabel(attributed, targetLabels)) return false;
            const prefix = cleanText(attributed.match(/^([^:]{1,52}):\s+/)?.[1], 52);
            const prefixKey = normalizeName(prefix);
            const targetPrefix = targetLabels.some(label => prefixKey && normalizeName(label) === prefixKey);
            const properNamePrefix = /^[\p{Lu}][\p{L}\p{M}'’.-]*(?:\s+[\p{Lu}][\p{L}\p{M}'’.-]*){0,2}$/u.test(prefix);
            if (prefix && !targetPrefix && properNamePrefix && normalizedPhrasePresent(rawContext, prefix)) return false;
            return true;
        })
        .map(value => cleanText(String(value || '')
            .replace(/^\[m\d+\]\s*/i, '')
            .replace(/^[^:]{1,52}:\s*/, ''), DURABLE_PROFILE_LIMITS.evidence))
        .filter(item => {
            if (!item) return false;
            if (otherLabels.length && episodeContainsLabel(item, otherLabels) && !episodeContainsLabel(item, targetLabels)) {
                return false;
            }
            return true;
        });
    return [scopedContext, ...evidence].filter(Boolean).join(' ');
}
