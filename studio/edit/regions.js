// Editor slot for the regions and realms section (views/route.js EDITORS). A stub: it draws the read-only cards until ST-REGIONS builds the regions and realms forms.

import { renderSection } from '../views/records.js';

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    return [renderSection(section, ctx)];
}
