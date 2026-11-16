// Which screens sit in the bar and which under More, and moving one between them.

import { HOME_ID, inDefaultBar } from '../screens.js';
import { readTabChoice } from './choice.js';

/**
 * Is `id` in the bar (the game view's navigation, the Story panel's tab strip), as against under More? Home always is; the
 * reader's choice wins; else the screens that declare `bar: true` are (`declared`: the caller reads it from the registration, see
 * screens.js inDefaultBar), and every other is not.
 */
export function isInBar(choice, id, declared = false) {
    const key = String(id);
    if (key === HOME_ID) return true;
    const clean = readTabChoice(choice);
    if (clean.inBar?.includes(key)) return true;
    if (clean.underMore?.includes(key)) return false;
    return inDefaultBar(key, declared);
}

/**
 * The choice with `id` placed in the bar (`inBar` true) or under More. Home stays in the bar (the choice comes back unchanged). A place
 * that is the default for that id (`declared`: its own `bar: true`) is not kept (the choice forgets it), so the default can change later.
 */
export function setNavInBar(choice, id, inBar, declared = false) {
    const clean = readTabChoice(choice);
    if (typeof id !== 'string' || !id || id === HOME_ID) return clean;
    const rest = { inBar: (clean.inBar ?? []).filter(item => item !== id), underMore: (clean.underMore ?? []).filter(item => item !== id) };
    if (inDefaultBar(id, declared) !== Boolean(inBar)) rest[inBar ? 'inBar' : 'underMore'].push(id);
    return readTabChoice({ ...clean, ...rest });
}
