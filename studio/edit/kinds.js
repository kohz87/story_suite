// Editor slot for the place kinds, route kinds and markets section (views/route.js EDITORS). A stub: it draws the read-only cards until ST-KINDS builds the place and route kinds and the markets.

import { renderSection } from '../views/records.js';

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    return [renderSection(section, ctx)];
}
