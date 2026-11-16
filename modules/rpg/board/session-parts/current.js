// Reads the open board session from chat metadata and names the data and key a reply keeps for it.
import { KEY } from './shared-keys.js';
import { object } from './shared-meta.js';

export const boardSession = meta => (object(meta?.[KEY]) ? meta[KEY] : null);
/** The exact data the reply must keep; none of the session's view state goes with it. */
export function boardPayload(session) {
    return structuredClone({ id: session.id, anchor: session.anchor, groups: session.groups, setup: session.setup, exchanges: session.exchanges });
}

/** A segment belongs to the reply which opened it, even if earlier messages move. */
export const boardKey = board => `b:${encodeURIComponent(board.id)}:${encodeURIComponent(board.anchor)}:${board.setup.offset}`;
