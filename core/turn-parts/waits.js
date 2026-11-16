// How long a reply may stay busy, and how long a send waits for Assist or the RPG's code.

// A reply that never ends (no MESSAGE_RECEIVED, GENERATION_ENDED or STOPPED) stops counting as in progress
// after this long, so Story Suite's own model calls on the chat's connection are not held up for good.
export const REPLY_BUSY_MAX_MS = 5 * 60_000;
// How long a send waits for the Assist safety net still reading the last reply (MODULES §F123): briefly.
// Lines that come later are kept on that reply and applied on the next one, right after its own lines.
export const ASSIST_WAIT_MS = 1500;
// How long the RPG's code (rpg-lazy.js) may take to load before a reply or a chat goes on without it: a stalled import never holds a generation or a chat open.
export const RPG_LOAD_WAIT_MS = 4000;
