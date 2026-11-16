// Story Suite v2: the fight board's input watch, moved out of createTurn unchanged (removed when the interaction port takes the board over):
// the commit guard that keeps the witnessed sheet and gear while a board reply is in flight, and the stop when they changed anyway.
// `createBoardWatch(s, deps)` registers the guard and returns `boardError` and `stopChangedBoard`; it never imports turn.js.

import { rpgLib } from '../rpg-lazy.js';
import { boardStartState, boardStep, restoreHint } from './held-board.js';

export function createBoardWatch(s, { bus, store, problem, notify }) {
    const boardError = (state, board) => {
        const start = boardStartState(bus, state, board);
        if (start.error) return start.error;
        const check = rpgLib()?.boardInputError;
        return typeof check === 'function' ? check(start.state, board) : 'The fight could not be checked.';
    };
    // Keep the witnessed inputs against reader edits while the reply is in flight. Capture runs its own changes in order.
    bus.setCommitGuard?.((next, receipt) => {
        if (receipt?.cause !== 'ui') return null;
        const board = s.replyBusy && boardStep(s.session)?.payload.board;
        if (!board) return null;
        return boardError(next(), board) ? 'Wait for the reply to finish before changing the fight sheet or gear.' : null;
    });
    const stopChangedBoard = () => {
        const current = s.session, board = s.replyBusy && boardStep(current)?.payload.board;
        if (!board || current.boardInvalid) return;
        const error = boardError(store.head(), board);
        if (!error) return;
        current.boardInvalid = true;
        const reason = `${error}${restoreHint(error, ' before retrying.')}`;
        problem({ module: 'story-block', code: 'BOARD_CHANGED', message: reason });
        try { s.abortBoard?.(true); } catch { /* the reason is still shown */ }
        try { notify?.(reason, 'story-block'); } catch { /* the problem remains visible */ }
    };
    return { boardError, stopChangedBoard };
}
