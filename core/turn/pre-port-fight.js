// The fight board's unsent scratch from before the port (INTERACTION-PLAN §6.4): the old metadata keys are not read any more, so an open fight, its Send copy,
// its waiting choice and a held reply are dropped when the chat is opened, with one quiet Problem; what only helped a regenerate (the last fight and its links) goes silently.
// Unsent scratch holds no story state, so nothing a reply carried is lost. Deleted with the rest of the pre-port compatibility (C11).
const OPEN = ['rpgFightBoard', 'rpgFightSend', 'rpgFightStart', 'rpgFightHeld', 'rpgFightHeldDiscarded'];
const QUIET = ['rpgFightAttempts', 'rpgFightLast', 'rpgFightLinks'];

export const FIGHT_CLOSED = 'A fight that was open before the update was closed. Start it again from the Fight tab.';

/** Removes the old keys from the chat's metadata. → whether an open fight was among them (the caller tells it), or null when nothing changed. */
export function dropPrePortFight(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const open = OPEN.some(key => Object.hasOwn(meta, key)), quiet = QUIET.some(key => Object.hasOwn(meta, key));
    if (!open && !quiet) return null;
    for (const key of [...OPEN, ...QUIET]) delete meta[key];
    return open;
}
