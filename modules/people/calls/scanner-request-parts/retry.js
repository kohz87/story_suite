// The compact JSON retry: the retry length, the truncation test, and the correction prompt.
import { IMPORTANT_MEMORY_LIMIT } from '../../core.js';

export const JSON_RETRY_RESPONSE_LENGTH = 5200;

export function isTruncatedScannerJsonError(error) {
    const text = [error?.message, error?.cause?.message]
        .filter(Boolean)
        .join(' ');
    return /unterminated string|unexpected end of json input|unexpected end of data|end of json input/i.test(text);
}

export function compactRetryPrompt(prompt, label = 'scanner', reason = 'malformed') {
    const cause = reason === 'truncated'
        ? 'Your previous response ended before the JSON was complete.'
        : 'Your previous response was not valid JSON. Rebuild it from the beginning with correct commas, colons, quotes, arrays, and objects.';
    const targetedMemoryLimit = /(?:backfill|chat refresh)/i.test(String(label || '')) ? IMPORTANT_MEMORY_LIMIT : 3;
    return `${prompt}

CRITICAL COMPACT JSON RETRY (${label}): ${cause} Return the full JSON object again from the beginning. Use MINIFIED JSON only. Keep every value concise; shorten prose instead of risking truncation. Omit unsupported optional facts rather than explaining them. Compact rather than append: appearance under 500 characters, personality 280, speech 240, behaviorProfile at most 6 short point-form rules, background/relationship summary 280-320, mannerisms at most 4 DISTINCT short items, key relationships one entry per counterpart, memories at most ${targetedMemoryLimit} distinct events, memoryRetention at most 5 distinct events. Close every quoted string, array, and object. No markdown, no commentary, no code fence.`;
}
