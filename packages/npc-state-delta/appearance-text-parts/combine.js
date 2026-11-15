/* Shared-prefix stripping and combining of an overall appearance with a specific one. A part of appearance-text.js (same owner, moved without change). */
import { appearanceText } from './basics.js';
import { appearanceClauses, sameAppearance } from './clauses.js';
import { normalizeName } from '../core-text.js';

export function regexEscape(value) { return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function stripOverallPrefix(value, overall, max) {
    const current = appearanceText(value, max);
    const shared = appearanceText(overall, max);
    if (!current || !shared) return current;
    if (sameAppearance(current, shared)) return '';

    const sharedClauses = appearanceClauses(shared, max);
    const currentClauses = appearanceClauses(current, max);
    const remaining = currentClauses.filter(clause => !sharedClauses.some(sharedClause => sameAppearance(clause, sharedClause)));
    if (remaining.length !== currentClauses.length) return appearanceText(remaining.join('; '), max);

    // Some providers repeat the shared phrase before a comma/colon rather than as a complete
    // sentence. Match the exact normalized word sequence only, never loose keyword overlap, so
    // negated or genuinely different form anatomy remains intact.
    const words = normalizeName(shared).split(/\s+/).filter(Boolean);
    if (words.length) {
        const boundary = String.raw`[\s,.;:!?()\[\]{}\-–—/]`;
        const separator = `${boundary}+`;
        const trailing = `${boundary}*`;
        const prefix = new RegExp(`^\\s*${words.map(regexEscape).join(separator)}(?=$|${boundary})${trailing}`, 'iu');
        const match = prefix.exec(current);
        if (match) {
            const remainder = current.slice(match[0].length);
            if (!/^\s*(?:is|are|was|were|be|been|being|not|never|no|hidden|covered|concealed|veiled|beneath|under|obscured)\b/i.test(remainder)) {
                return appearanceText(remainder, max);
            }
        }
    }
    return current;
}
export function combineAppearance(overall, specific, max) {
    const shared = appearanceText(overall, max);
    const local = stripOverallPrefix(specific, shared, max);
    if (!shared) return local;
    if (!local) return shared;
    if (sameAppearance(shared, local)) return shared;
    if (normalizeName(local).startsWith(normalizeName(shared))) return local;
    return appearanceText(`${shared.replace(/[\s.;,]+$/, '')}; ${local}`, max);
}
