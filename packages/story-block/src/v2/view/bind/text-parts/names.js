// Checks that a name is allowed for a loop's items.

import { IDENT, RESERVED } from '../paths.js';

/** True for a name a loop may give its items. */
export const isLoopName = name => IDENT.test(name) && !RESERVED.has(name);
