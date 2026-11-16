/* NPC State Delta bounded diagnostic telemetry.
 * Records deterministic application decisions only. It never owns story/canonical state and
 * deliberately allowlists fields so prompts, full narration, credentials and provider payloads
 * cannot leak into the diagnostic bundle by accident.
 */
// Public face: re-exports its parts.
export { DIAGNOSTIC_BUNDLE_VERSION, DEFAULT_DIAGNOSTIC_OPERATION_LIMIT, createDiagnosticStore } from './diagnostics-core-parts/store.js';
export { sanitizeProfileDiagnostic, sanitizeBirthdayDiagnostic } from './diagnostics-core-parts/sanitize-rows.js';
export { sanitizeDiagnosticOperation } from './diagnostics-core-parts/sanitize-operation.js';
