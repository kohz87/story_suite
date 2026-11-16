// Whether the party already carries the item a name means.

import { resolveDef } from '../../names.js';

/** Whether the party (anyone in it) already carries the item a name means, by the tolerant lookup. */
export function owned(inv, name) {
    const found = resolveDef(inv, name);
    return found.status === 'found' && Object.values(inv.stacks).some(stack => stack.def === found.id);
}
