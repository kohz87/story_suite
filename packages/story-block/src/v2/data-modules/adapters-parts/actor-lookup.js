// Resolving a who value to a Story Director actor ID, by name or ca_ ID.
import { refuse } from '../interpreter.js';
import { dmOwn } from '../schema.js';
import { actorsOf } from './state-views.js';

export function resolveActor(state, value, attached = null) {
    const actors = actorsOf(state), ids = attached ?? Object.keys(actors);
    if (typeof value !== 'string' || !value.trim() || value.startsWith('ac_')) refuse('DM_LABEL', 'who', 'who must name a Story Director actor (a name or a ca_ ID), not a party character ID');
    const wanted = value.normalize('NFKC').trim().toLowerCase();
    const matches = ids.filter(id => dmOwn(actors, id) && (id === value.trim() || actors[id].name.normalize('NFKC').toLowerCase() === wanted));
    if (matches.length > 1) refuse('DM_LABEL', 'who', `who is ambiguous: ${matches.map(id => `${actors[id].name} (${id})`).join(' and ')} both fit; use the ca_ ID`);
    if (matches.length !== 1) {
        const here = ids.filter(id => dmOwn(actors, id)).map(id => actors[id].name);
        refuse('DM_LABEL', 'who', `who must be ${attached ? 'an attached character' : 'an actor of Story Director'}${here.length ? ` (${here.join(', ')})` : ''}`);
    }
    return matches[0];
}
