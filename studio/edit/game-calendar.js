// Editor slot for the game calendar section (views/route.js EDITORS). A stub: it draws the read-only cards until ST-GCAL builds the calendar editor.

import { renderSection } from '../views/records.js';

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    return [renderSection(section, ctx)];
}
