// How preflight classifies a module's stored data, and the store version this Story Block reads.

/** The classes a module's stored data can be in, as sdk.preflight tells them. */
export const PREFLIGHT_CLASSES = Object.freeze(['empty', 'current', 'legacy', 'mixed', 'future', 'damaged']);
// The version of the store records this Story Block reads (record `v`, state `v`).
export const STORE_VERSION = 2;
