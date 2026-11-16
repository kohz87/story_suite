/* The one gate for a fill call: something to fill and not the reader's own character. A part of appearance-fill.js (same owner, moved without change). */
import { fillWanted } from './wanted.js';

/** True when this record is the reader's own character (name or alias equals the player's name, case-insensitive). */
export const isReadersOwn = (npc, playerName) => {
    const player = String(playerName || '').trim().toLowerCase();
    return Boolean(player) && [npc?.name, ...(npc?.aliases || [])].some(label => String(label || '').trim().toLowerCase() === player);
};

/** The one gate for a fill call (Refresh and the new-admission backfill share it): something to fill, and not the reader's own character. */
export const fillAllowed = (npc, playerName) => fillWanted(npc) && !isReadersOwn(npc, playerName);
