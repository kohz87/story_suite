/* NPC State Delta dossier surface: the coalescing times for dossier refresh asks. */
// Refresh asks (settings mutations, focus, pins) are coalesced: quiet time before one check, the longest an ask may wait, and the re-check gap while a reply streams.
export const REFRESH_DEBOUNCE_MS = 250;
export const REFRESH_MAX_WAIT_MS = 1500;
export const REFRESH_STREAM_RECHECK_MS = 700;
