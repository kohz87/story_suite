/* Reading a collective bond ("twin daughters") into its family, count and descriptor.
   Part of social-relations.js; social-relations.js re-exports it. */

import { norm } from '../social-primitives.js';
import { socialRelationFamily } from './family-name.js';

function numberWord(value) {
    const raw = norm(value);
    const map = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twin: 2, twins: 2 };
    if (map[raw]) return map[raw];
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 && n <= 20 ? n : 0;
}

function singularRelation(value) {
    const raw = norm(value);
    if (raw === 'daughters') return 'daughter';
    if (raw === 'sons') return 'son';
    if (raw === 'children') return 'child';
    if (raw === 'sisters') return 'sister';
    if (raw === 'brothers') return 'brother';
    if (raw === 'siblings') return 'sibling';
    return raw.replace(/s$/, '');
}

function collectiveRelationshipShape(parsed) {
    if (!parsed) return null;
    const subject = norm(parsed.subject);
    const relationFamily = socialRelationFamily(singularRelation(parsed.relation));
    const plural = subject.match(/\b(daughters|sons|children|sisters|brothers|siblings)\b/);
    if (!plural) return null;
    const subjectFamily = socialRelationFamily(singularRelation(plural[1]));
    if (!subjectFamily || subjectFamily !== relationFamily) return null;
    const twin = /\btwins?\b/.test(subject);
    let expectedCount = twin ? 2 : 0;
    if (!expectedCount) {
        const countToken = subject.split(/\s+/).find(token => numberWord(token) > 0);
        if (countToken) expectedCount = numberWord(countToken);
    }
    if (expectedCount < 2) return null;
    return { family: relationFamily, expectedCount, sharedDescriptor: twin ? 'twins' : '' };
}

export { numberWord, singularRelation, collectiveRelationshipShape };
