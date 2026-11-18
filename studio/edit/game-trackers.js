// Editor slot for the game meter presets and data modules section (views/route.js EDITORS). A stub: it draws the read-only cards until ST-GTRACK builds the meter presets and data modules editor.

import { renderSection } from '../views/records.js';

/** `section`: `{ key, where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    return [renderSection(section, ctx)];
}
