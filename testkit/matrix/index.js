// The combination matrix, vendored with the rest of the testkit.
//
// Public face: re-exports its parts.

export { CASES, NOT_EXPRESSIBLE, ROWS, MATRIX_VERSION } from './index-parts/data.js';
export { FOLDERS, MODULES, ORDER } from './index-parts/modules.js';
export { discoverRoots, loadModules, runMatrix } from './index-parts/loading.js';
export { describeTestkit, formatDetails, formatTable, summaryLine } from './index-parts/report.js';
