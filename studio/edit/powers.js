// Editor slot for the powers and scores section (views/route.js EDITORS). A stub: it draws the read-only cards until ST-POW builds the powers and scores forms.

import { renderSection } from '../views/records.js';

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    return [renderSection(section, ctx)];
}
