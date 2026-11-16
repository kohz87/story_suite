/* Cleaning the relation text of one bond entry.
   Part of social-relations.js; social-relations.js re-exports it. */

import { cleanBoundary, norm } from '../social-primitives.js';
import { inverseRelationFamilies } from './family-checks.js';

function sanitizeRelationshipRelation(subject, value) {
    let relation = cleanBoundary(value, 180, { ellipsis: false });
    if (!relation) return '';
    const slash = [];
    const seen = new Set();
    for (const part of relation.split(/\s*\/\s*/).map(item => cleanBoundary(item, 180, { ellipsis: false })).filter(Boolean)) {
        const key = norm(part);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        slash.push(part);
    }
    if (slash.length === 2 && inverseRelationFamilies(slash[0], slash[1])) relation = slash[0];
    else if (slash.length) relation = cleanBoundary(slash.join(' / '), 180, { ellipsis: false });
    const subjectKey = norm(subject);
    const relationKey = norm(relation);
    if (/^late husband\b/.test(subjectKey) && /^(?:surviving )?widow\b/.test(relationKey)) return 'spouse';
    if (/^late wife\b/.test(subjectKey) && /^(?:surviving )?widower\b/.test(relationKey)) return 'spouse';
    return relation;
}

export { sanitizeRelationshipRelation };
