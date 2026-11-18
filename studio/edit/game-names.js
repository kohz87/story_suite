// Editor slot for the game names section (views/route.js EDITORS). A stub: it draws the read-only cards until ST-GNAMES builds the name cultures editor.

import { renderSection } from '../views/records.js';

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    return [renderSection(section, ctx)];
}
