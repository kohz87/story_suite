// The loaded RPG library's holder and the loader that fetches it when it is needed (rpgLib, setRpgLib, createRpgLoader).

import { holdsRpg } from './holds.js';

let library = null;

/** The loaded RPG library (lean-rpg/index.js's exports), or null while it is not loaded. */
export const rpgLib = () => library;

/** Hands over the library (the loader does; a test host that wants the RPG at once does too). `null` lets it go. */
export function setRpgLib(lib) { library = lib && typeof lib === 'object' ? lib : null; }

/**
 * The loader: `ensure()` → a promise that settles once the library is there when it is needed (never rejects), else undefined.
 *   load()          → the module (default: import('../lean-rpg/index.js'))
 *   featureOn()     → whether the RPG feature is on
 *   chat(), metadata() → the open chat and its metadata
 *   problem(entry)  → the Problems list, for a load that failed (the RPG then stays out of the way: its stored rolls cannot replay until it loads)
 * `ensure({ scan: false })` looks at the feature only (the per-reply check: no pass over the chat).
 */
export function createRpgLoader({ load = () => import('../lean-rpg/index.js'), featureOn = () => false, chat = () => null, metadata = () => null, problem = null } = {}) {
    let pending = null;
    const needed = scan => {
        let on = false;
        try { on = featureOn() === true; } catch { on = false; }
        if (on || !scan) return on;
        let meta = null;
        try { meta = metadata(); } catch { meta = null; }
        let messages = null;
        try { messages = chat(); } catch { messages = null; }
        return holdsRpg(messages, meta);
    };
    // → a promise while the library is being fetched (or is to be), else undefined (nothing to wait for: not a tick on the reply's way).
    function ensure({ scan = true } = {}) {
        if (library) return undefined;
        if (!pending) {
            if (!needed(scan)) return undefined;
            pending = Promise.resolve().then(load).then(lib => { setRpgLib(lib); return library; }).catch(error => {
                pending = null;
                try { problem?.({ module: 'story-block', code: 'RPG_LOAD', message: `The RPG could not be loaded: ${error?.message ?? error}` }); } catch { /* the Problems list is optional */ }
                return null;
            });
        }
        return pending;
    }
    return { ensure, loaded: () => library !== null, needed: ({ scan = true } = {}) => needed(scan) };
}
