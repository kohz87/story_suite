// The job: checking one outcome weight against the pack: the expression reads, and every ref names a power or a score by id.

import { parseWeight } from './weight.js';

/** Says one Problem for a weight that does not read or names an unknown ref. */
export function checkWeight(weight, ctx, field) {
    const parsed = parseWeight(weight);
    if (parsed.error) return ctx.say(field, parsed.error);
    for (const term of parsed.terms) {
        if (term.number !== undefined) continue;
        const found = term.kind === 'standing' ? ctx.index.standing('power', term.id) ?? ctx.index.standing('score', term.id) : ctx.index.standing(term.kind, term.id);
        if (!found) ctx.say(field, `${field} "${weight}": there is no ${term.kind === 'standing' ? 'power or score' : term.kind} with that id (or unique name) in this pack.`, 'UNKNOWN_REF');
    }
}
