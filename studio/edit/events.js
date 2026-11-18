// Editor slot for the world events (and a format 3 pack's dated events) section (views/route.js EDITORS). A stub: it draws the read-only cards until ST-EVENTS builds the world events form.

import { renderSection } from '../views/records.js';

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    return [renderSection(section, ctx)];
}
