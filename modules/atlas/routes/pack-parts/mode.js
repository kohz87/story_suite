// Normalizes travel mode strings against pre-modern or modern pack modes.

import { MODES, MODERN_MODES } from './codes.js';
import { MODE_ALIASES, MODERN_ALIASES } from './aliases.js';

export function normalizeMode(mode, pack = null) {
    if (typeof mode !== 'string') return null;
    const word = mode.trim().toLowerCase().replace(/\s+/g, ' ');
    if (pack?.era === 'modern') return MODERN_MODES.includes(word) ? word : MODERN_ALIASES[word] ?? null;
    if (MODES.includes(word)) return word;
    return MODE_ALIASES[word] ?? null;
}
