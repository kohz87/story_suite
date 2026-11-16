/* Naming the relation family ("father" becomes parent) a relation text belongs to.
   Part of social-relations.js; social-relations.js re-exports it. */

import { norm } from '../social-primitives.js';

export function socialRelationFamily(value) {
    const rel = norm(value);
    if (!rel) return '';
    // Ties by marriage are their own families: a father-in-law is not a parent, so he neither
    // mirrors as "child" nor proves that two people who share him are siblings.
    if (/\bin[\s-]*law\b/.test(rel)) {
        if (/\b(?:daughter|son|child)\b/.test(rel)) return 'child-in-law';
        if (/\b(?:mother|father|parent)\b/.test(rel)) return 'parent-in-law';
        if (/\b(?:sister|brother|sibling)\b/.test(rel)) return 'sibling-in-law';
    }
    if (/\b(?:daughter|son|child)\b/.test(rel)) return 'child';
    if (/\b(?:mother|father|parent)\b/.test(rel)) return 'parent';
    if (/\b(?:sister|brother|sibling)\b/.test(rel)) return 'sibling';
    if (/\b(?:wife|husband|spouse|fiance|fiancee|partner|lover|girlfriend|boyfriend)\b/.test(rel)) return 'partner';
    if (/\b(?:mentor|teacher)\b/.test(rel)) return 'mentor';
    if (/\b(?:student|apprentice|protege)\b/.test(rel)) return 'student';
    if (/\bguardian\b/.test(rel)) return 'guardian';
    if (/\bward\b/.test(rel)) return 'ward';
    if (/\b(?:friend|rival|cousin)\b/.test(rel)) return rel.match(/\b(friend|rival|cousin)\b/)?.[1] || rel;
    if (/\b(?:aunt|uncle)\b/.test(rel)) return 'aunt-uncle';
    if (/\b(?:niece|nephew)\b/.test(rel)) return 'niece-nephew';
    if (/\b(?:grandmother|grandfather|grandparent)\b/.test(rel)) return 'grandparent';
    if (/\bgrandchild\b/.test(rel)) return 'grandchild';
    return rel;
}
