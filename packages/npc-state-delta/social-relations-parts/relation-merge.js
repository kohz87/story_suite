/* Merging two relation texts into the more specific one.
   Part of social-relations.js; social-relations.js re-exports it. */

import { cleanBoundary, norm } from '../social-primitives.js';
import { inverseRelationFamilies } from './family-checks.js';
import { socialRelationFamily } from './family-name.js';

function relationSpecificity(value) {
    const rel = norm(value);
    let score = rel.split(/\s+/).filter(Boolean).length;
    if (/\b(?:daughter|son|mother|father|sister|brother|wife|husband)\b/.test(rel)) score += 2;
    if (/\b(?:clone|twin|adoptive|biological|step|half|older|younger|elder)\b/.test(rel)) score += 2;
    return score;
}

function mergeRelations(a, b) {
    const left = cleanBoundary(a, 180, { ellipsis: false });
    const right = cleanBoundary(b, 180, { ellipsis: false });
    if (!left) return right;
    if (!right) return left;
    const ln = norm(left);
    const rn = norm(right);
    if (ln === rn) return relationSpecificity(right) >= relationSpecificity(left) ? right : left;
    // A gender-neutral inverse ("aunt / uncle") never replaces the specific relation it covers.
    const slashParts = value => value.split(/\s*\/\s*/).map(norm).filter(Boolean);
    if (slashParts(right).length > 1 && slashParts(right).includes(ln)) return left;
    if (slashParts(left).length > 1 && slashParts(left).includes(rn)) return right;
    if (ln.includes(rn)) return left;
    if (rn.includes(ln)) return right;
    const lf = socialRelationFamily(left);
    const rf = socialRelationFamily(right);
    if (lf && lf === rf) return relationSpecificity(right) >= relationSpecificity(left) ? right : left;
    if (inverseRelationFamilies(lf, rf)) return left;
    return cleanBoundary(`${left} / ${right}`, 180, { ellipsis: false });
}

export { relationSpecificity, mergeRelations };
