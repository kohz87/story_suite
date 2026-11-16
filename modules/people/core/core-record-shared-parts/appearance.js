/* NPC State Delta appearance: the cast appearance width, the pack-words-kept split and the appearance canon normalizer. */
import { AGE_NUMBER_WORD_RE } from '../core-identity.js';
import { compactDurableText, DURABLE_PROFILE_LIMITS } from '../core-relationship.js';
import { cleanText } from '../core-text.js';

/** The longest a cast dossier's stored appearance can be: the pack's look and wears (1800 each) joined by "; ". */
export const CAST_APPEARANCE_WIDE = 3700;

/**
 * (the living cast) Which of a cast dossier's appearance fields still are the pack's own words (`castFrom.first`), and the stored
 * current appearance split into its parts. The stored `appearance` is the RESOLVED text, "<overallAppearance>; <current part>", so the
 * pack's `wears` is compared with the part after the physical words, not with the whole. Returns
 * { overall, appearance, head, part } where `overall` / `appearance` say the field still is the pack's words, `head` is the physical
 * text and `part` the stored text after it (the whole stored text when it does not start with the physical words).
 */
export function castAppearanceKept(raw) {
    const first = raw?.castFrom && typeof raw.castFrom.first === 'object' && raw.castFrom.first ? raw.castFrom.first : {};
    const text = (value, max) => (typeof value === 'string' ? cleanText(value, max) : '');
    const physical = text(raw?.overallAppearance, 1800);
    const stored = text(raw?.appearance, CAST_APPEARANCE_WIDE);
    const head = physical.replace(/[\s.;,]+$/, '');
    let part = stored;
    let split = false;
    if (physical) {
        if (stored === physical || stored === head) { part = ''; split = true; }
        else if (stored.startsWith(`${head}; `)) { part = stored.slice(head.length + 2); split = true; }
    }
    const firstPhysical = text(first.overallAppearance, 1800);
    const firstCurrent = text(first.appearance, 1800);
    const overall = Boolean(physical) && physical === firstPhysical;
    // No pack words for the current part (an entry without `wears`): the stored text is the physical words alone while it still is them.
    const appearance = Boolean(stored) && (firstCurrent ? part === firstCurrent : (overall && part === ''));
    return { overall, appearance, head, part, split };
}

export function normalizeAppearanceCanon(value) {
    let text = compactDurableText(value, DURABLE_PROFILE_LIMITS.appearance, 10);
    if (!text) return '';
    const ageToken = `(?:\\d{1,3}|${AGE_NUMBER_WORD_RE})`;
    const articlePattern = new RegExp(`^(\\s*(?:a|an)\\s+)${ageToken}(?:[-\\s]+years?[-\\s]+old)\\s+`, 'i');
    const barePattern = new RegExp(`^\\s*${ageToken}(?:[-\\s]+years?[-\\s]+old)\\s+`, 'i');
    text = text.replace(articlePattern, '$1').replace(barePattern, '');
    text = text.replace(new RegExp(`^\\s*(?:aged|age)\\s+${ageToken}\\s*[,;:-]?\\s*`, 'i'), '');
    text = text.replace(/\s+/g, ' ').trim();
    if (text && /^[a-z]/.test(text)) text = text.charAt(0).toUpperCase() + text.slice(1);
    return cleanText(text, DURABLE_PROFILE_LIMITS.appearance);
}
