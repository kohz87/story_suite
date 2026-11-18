// Editor slot for the items and foes section (views/route.js EDITORS). A stub: it draws the read-only cards until ST-ITEMS builds the items and foes forms.

import { renderSection } from '../views/records.js';

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    return [renderSection(section, ctx)];
}
