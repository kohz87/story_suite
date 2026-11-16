/* NPC State Delta episode labels: context segmenting, binding labels and phrase/label presence tests. */

import { cleanText, normalizeName } from '../core-text.js';

export function developmentContextSegments(value) {
    return String(value || '').replace(/\r/g, '\n').split(/\n+|(?<=[.!?])\s+/)
        .map(part => cleanText(part, 1200)).filter(Boolean);
}

export function developmentBindingLabels(binding = null) {
    const npc = binding?.npc && typeof binding.npc === 'object' ? binding.npc : null;
    if (!npc) return [];
    return [npc.name, ...(Array.isArray(npc.aliases) ? npc.aliases : [])]
        .map(normalizeName).filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index);
}

export function normalizedPhrasePresent(text, phrase) {
    const source = ` ${normalizeName(text)} `;
    const needle = ` ${normalizeName(phrase)} `;
    return Boolean(needle.trim()) && source.includes(needle);
}

export function episodeContainsLabel(segment, labels = []) {
    return labels.some(label => normalizedPhrasePresent(segment, label));
}
