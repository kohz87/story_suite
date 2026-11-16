// The matrix module keys: a module's label, the keys a row lists and the ones that are active.

import { MODULES, ORDER } from '../../modules.js';

const label = key => (key === 'sb' ? 'SB' : MODULES[key].label);
const keysOf = (row, keys = row.modules) => ['sb', ...ORDER.filter(key => keys.includes(key))];
/** The modules whose scripts run: the row's, less those it expects dormant. */
const activeOf = row => row.modules.filter(key => !row.dormant.includes(key));

export { label, keysOf, activeOf };
