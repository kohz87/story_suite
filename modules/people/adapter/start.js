// Starts the one adapter of the page (or gives the running one) from NPC State's runtime start.

import { createPeopleAdapter } from './create.js';

let adapter = null;

/** Start the page's one adapter (runtime-entry.js calls this once at startup); later calls return the same one. */
export function startPeopleAdapter(options = {}) {
    if (!adapter) {
        adapter = createPeopleAdapter(options);
        adapter.start();
    }
    return adapter;
}
