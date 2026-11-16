/* Finding the inverse of a relation text.
   Part of social-relations.js; social-relations.js re-exports it. */

import { clean, uniq } from '../social-primitives.js';
import { conflictingKinship } from './family-checks.js';
import { socialRelationFamily } from './family-name.js';
import { symmetricInverse } from './relation-symmetric.js';

export function inverseSocialRelation(value) {
    const text = clean(value, 180);
    const parts = text.split(/\s*\/\s*/).filter(Boolean);
    // A relation that contradicts itself ("niece / sibling") has no trustworthy inverse.
    if (parts.some((part, i) => parts.slice(i + 1).some(other => conflictingKinship(part, other)))) return '';
    if (parts.length > 1) return uniq(parts.map(inverseSingleRelation).filter(Boolean)).join(' / ');
    return inverseSingleRelation(text);
}

function inverseSingleRelation(value) {
    const rel = clean(value, 180);
    const family = socialRelationFamily(rel);
    if (!family) return '';
    if (family === 'parent-in-law') return 'child-in-law';
    if (family === 'child-in-law') return 'parent-in-law';
    if (family === 'sibling-in-law') return 'sibling-in-law';
    if (family === 'child') return 'parent';
    if (family === 'parent') return 'child';
    if (family === 'sibling') return /\bclone\b/i.test(rel) ? 'clone sibling' : (/\btwin\b/i.test(rel) ? 'twin sibling' : 'sibling');
    if (family === 'friend' || family === 'rival' || family === 'cousin') return symmetricInverse(rel);
    if (family === 'partner') {
        if (/\b(?:wife|husband|spouse)\b/i.test(rel)) return 'spouse';
        return 'partner';
    }
    if (family === 'mentor') return 'student';
    if (family === 'student') return 'mentor';
    if (family === 'guardian') return 'ward';
    if (family === 'ward') return 'guardian';
    if (family === 'aunt-uncle') return 'niece/nephew';
    if (family === 'niece-nephew') return 'aunt/uncle';
    if (family === 'grandparent') return 'grandchild';
    if (family === 'grandchild') return 'grandparent';
    // Only a known symmetric bond mirrors itself; "servant" or "employer" has no safe inverse.
    return symmetricInverse(rel);
}

export { inverseSingleRelation };
