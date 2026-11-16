// A staged fight board's session: dropped when its anchor reply is gone, and its opening recreated and checked.

import { readRecord } from '../../persist.js';
import { rpgLib } from '../../rpg-lazy.js';
import { object } from './shared-board.js';

/** A copied chat cannot keep a staged fight if its anchor reply was not copied. */
export function pruneMissingBoard(meta, chat) {
    const session = meta?.rpgFightBoard;
    if (!object(meta) || !object(session) || typeof session.anchor !== 'string' || !session.anchor) return false;
    if ((Array.isArray(chat) ? chat : []).some(message => !message?.is_user && readRecord(message)?.sid === session.anchor)) return false;
    delete meta.rpgFightBoard;
    return true;
}

/** Recreate a board's opening without recording it, then check the exact sheet the board used. */
export function boardStartState(bus, state, board) {
    const opening = board?.setup?.opening;
    if (!opening) return { state };
    if (!object(opening.payload) || !Number.isSafeInteger(opening.seed)) return { error: 'The fight opening is damaged.' };
    const preview = bus.run('rpg.resolve', opening.payload, { cause: 'system', state, seed: opening.seed });
    const result = preview?.receipt?.data?.v2?.result;
    const dropOf = rpgLib()?.dropOf;
    if (!preview?.ok || !result || typeof dropOf !== 'function' || JSON.stringify(result.checks ?? []) !== JSON.stringify(board.setup.approach ?? [])
        || JSON.stringify(dropOf(result)) !== JSON.stringify(board.setup.drop ?? null)) return { error: 'The fight opening changed. Restore the sheet or discard the fight (Fight tab, Discard fight).' };
    return { state: preview.state, result };
}
