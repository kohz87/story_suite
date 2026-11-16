/* NPC State Delta: request-scoped routing for the existing NPC scanner.
   Public face: re-exports its parts. */

export { SCANNER_REQUEST_TIMEOUT_MS, SCANNER_MAX_OUTPUT_TOKENS_MIN, SCANNER_MAX_OUTPUT_TOKENS_MAX, normalizeScannerMaxOutputTokens } from './scanner-routing-parts/shared-limits.js';
export { setScannerWaitAround, dispatchScannerRequest } from './scanner-routing-parts/dispatch.js';
export { configuredScannerMaxOutputTokens, selectedScannerProfileId, scannerProfileOptions } from './scanner-routing-parts/profile-settings.js';
export { scannerRoutingError, isScannerRoutingError, isEmptyScannerAnswer } from './scanner-routing-parts/errors.js';
export { cancelScannerRequests, scannerRoutingMetrics } from './scanner-routing-parts/request-tracking.js';
export { scannerDiagnosticLines } from './scanner-routing-parts/diagnostics.js';
