// The history replay scope: the one scope holder, entering a replay and stepping away from it while the model is awaited.

import { setScannerWaitAround } from '../scanner-routing.js';

// ---- history replay scope ----
// While a history replay reads one missed reply, `replay` is the scope of that reply (one at a time: the scan operation of the replay holds the chat
// busy, and sending is held): { key, chat (the messages up to the reply), state (the engine's private copy), sink, now(), receipts, captures,
// catchUp }. Everything the live scan path reads of "now" goes through chatContext()/clockNow()/replayScope(), and every outward write through
// notify()/the scope's sink; with no scope (live) they are the real getContext, Date.now and toastr, byte for byte.
let replay = null;
export const replayScope = () => replay;
export async function inReplay(scope, fn) {
    replay = scope;
    try { return await fn(); } finally { replay = null; }
}
// While the replay's scan waits for the model (minutes), nothing of the replay runs: the scope steps aside, so the dossier panel, token counts,
// injection and the editor read and write the installed state (an edit there moves the head's fingerprint, the catch-up finds itself stale and
// retries on top of it). The scope is back before the replay's next line runs.
export async function awayFromReplay(promise) {
    const mine = replay;
    replay = null;
    try { return await promise; } finally { replay = mine; }
}
setScannerWaitAround(awayFromReplay);
