// Editor slot for the Overview fields (id, version, name, author, description, requires, recommends; views/route.js EDITORS). A stub:
// it draws each field read-only until ST-OVER builds the form.

import { fieldRow } from '../views/value.js';

/** `section`: `{ key, where: 'top', value, count }`; `ctx`: the editor context (views/route.js). Returns the field's row. */
export function editSection(section, ctx) {
    return [fieldRow(section.key, section.value)];
}
