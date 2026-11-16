// The scanner request every dossier pass sends (scan, relationship evaluator, Refresh, backfill and
// dossier import): one dispatch through scanner-routing.js, JSON parsing, and one compact retry when
// the reply is cut off or malformed. (cleanup step 10) Moved out of index.js unchanged.
// Public face: re-exports its parts.
export { SCAN_RESPONSE_LENGTH, FULL_SCAN_RESPONSE_LENGTH, RELATIONSHIP_RESPONSE_LENGTH, BACKFILL_RESPONSE_LENGTH } from './scanner-request-parts/response-lengths.js';
export { JSON_RETRY_RESPONSE_LENGTH, isTruncatedScannerJsonError, compactRetryPrompt } from './scanner-request-parts/retry.js';
export { salvageScannerJson } from './scanner-request-parts/salvage.js';
export { generateParsedNpcJson } from './scanner-request-parts/generate.js';
