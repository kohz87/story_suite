// Editor slot for the game currency and economy section (views/route.js EDITORS). A stub: it draws the read-only cards until ST-GMONEY builds the coins and economy editor.

import { renderSection } from '../views/records.js';

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    return [renderSection(section, ctx)];
}
