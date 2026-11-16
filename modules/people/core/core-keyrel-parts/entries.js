/* NPC State Delta key-relationship entries: the limit, compacting one entry, reading its subject and splitting it into parts. */
import { compactSocialKeyRelationship } from '../../social.js';
import { cleanText, cleanTextBoundary, normalizeName } from '../../core-text.js';

export const KEY_RELATIONSHIP_LIMIT = 8;

export function compactKeyRelationshipEntry(value) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const match = text.match(/^(.+?)(?:\s+[—–-]\s+|\s*\|\s*|\s*:\s+)([\s\S]*)$/);
    if (!match) return compactSocialKeyRelationship(text);
    const subject = cleanTextBoundary(match[1], 120, { ellipsis: false });
    let rest = String(match[2] ?? '').replace(/\s+/g, ' ').trim();
    const ambiguousDeath = /\s*\((?:deceased|dead)\)\.?\s*$/i.test(rest);
    if (ambiguousDeath) {
        rest = rest.replace(/\s*\((?:deceased|dead)\)\.?\s*$/i, '').trim();
        if (/^widow\b/i.test(rest)) rest = rest.replace(/^widow\b/i, 'Surviving widow');
        else if (/^widower\b/i.test(rest)) rest = rest.replace(/^widower\b/i, 'Surviving widower');
        else rest = `${rest}; deceased`;
    }
    return compactSocialKeyRelationship(`${subject} — ${rest}`);
}

export function keyRelationshipSubject(value) {
    const text = compactKeyRelationshipEntry(value);
    if (!text) return '';
    const match = text.match(/^(.+?)(?:\s+[—–-]\s+|\s*\|\s*|\s*:\s+)/);
    const head = cleanText(match ? match[1] : text, 160);
    return normalizeName(head);
}

export const tieParts = entry => {
    const text = compactKeyRelationshipEntry(entry);
    const match = text.match(/^(.+?)(?:\s+[—–-]\s+|\s*\|\s*|\s*:\s+)([\s\S]*)$/);
    return { text, name: match ? match[1].trim() : text, rest: match ? match[2].trim() : '' };
};
