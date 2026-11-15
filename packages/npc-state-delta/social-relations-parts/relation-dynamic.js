/* Splitting a dynamic folded into a relation and folding it back in.
   Part of social-relations.js; social-relations.js re-exports it. */

import { SOCIAL_DYNAMIC_MAX_CHARS, cleanDynamic, normalizedWhitespace, richer } from '../social-primitives.js';

// A relation names only the relation. Scanners sometimes fold the dynamic in after a pipe
// ("cousin | endures her scolding") while also returning it as the dynamic; split it back out so
// the graph never stores it in the relation and projection never prints it twice.
function splitRelationDynamic(value) {
    const text = normalizedWhitespace(value);
    const pipe = text.indexOf('|');
    return pipe < 0 ? { relation: text, dynamic: '' } : { relation: text.slice(0, pipe), dynamic: text.slice(pipe + 1) };
}

function withFoldedDynamic(dynamic, folded) {
    return folded ? richer(dynamic, folded) : cleanDynamic(dynamic, SOCIAL_DYNAMIC_MAX_CHARS);
}

export { splitRelationDynamic, withFoldedDynamic };
