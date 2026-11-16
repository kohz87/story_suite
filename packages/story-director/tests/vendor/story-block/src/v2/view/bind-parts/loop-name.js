// Loop name: tells whether a name may be given to a loop's items.

import { IDENT, RESERVED } from './path-names.js';

/** True for a name a loop may give its items. */
export const isLoopName = name => IDENT.test(name) && !RESERVED.has(name);
