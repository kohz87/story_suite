/* Durable clause splitting, claim units and compact durable text. */
import { cleanText } from '../core-text.js';
import { durableRefinementTokens } from './tokens.js';
import { semanticDedupeItems } from './similarity.js';

function splitDurableClauses(value) {
    const source = String(value ?? '')
        .replace(/\r/g, '\n')
        .replace(/[•●▪◦]+/g, ';')
        .replace(/\s+[·]\s+/g, '; ');
    return source.split(/\n+|\s*;\s*|(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map(part => cleanText(part, 520))
        .filter(Boolean);
}

export function splitDurableClaimUnits(value) {
    const out = [];
    for (const clause of splitDurableClauses(value)) {
        const units = clause
            .split(/\s*,\s*|\s+\b(?:and|but|while|yet)\b\s+/iu)
            .map(part => cleanText(part, 520))
            .filter(part => durableRefinementTokens(part).some(token => token.length >= 3 && !/^\d+$/.test(token)));
        if (units.length > 1) out.push(...units);
        else out.push(clause);
    }
    return out.filter(Boolean);
}

export function compactDurableText(value, maxChars, maxClauses = 8) {
    let clauses = semanticDedupeItems(splitDurableClauses(value), {
        maxItems: 64, maxChars: Math.min(520, maxChars), similarity: 0.60,
    });
    if (clauses.length > maxClauses) {
        // Preserve both the established core and the newest distinct refinements when a
        // oversized append-only field has more concepts than the compact summary can carry.
        const headCount = Math.ceil(maxClauses / 2);
        clauses = [...clauses.slice(0, headCount), ...clauses.slice(-(maxClauses - headCount))];
    }
    if (!clauses.length) return '';
    const out = [];
    let used = 0;
    for (const clause of clauses) {
        const separator = out.length ? '; ' : '';
        const available = maxChars - used - separator.length;
        if (available <= 0) break;
        if (clause.length <= available) {
            out.push(clause);
            used += separator.length + clause.length;
            continue;
        }
        if (!out.length) out.push(cleanText(clause, maxChars));
        break;
    }
    return out.join('; ');
}
