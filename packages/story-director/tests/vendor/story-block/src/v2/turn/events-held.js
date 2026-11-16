// Story Suite v2: the held fight reply's events, moved out of createEvents unchanged: a reply kept uncaptured while its fight board input changed
// is resumed once the reader restores it, and found again after a chat is opened. `createHeldEvents(s, deps)` is given the turn's state holder `s`
// and the turn parts it uses; `getOnMessageReceived` gives the capture it resumes into.
import { readRecord } from '../persist.js';
import { boardStep, heldForMessage } from './held-board.js';

export function createHeldEvents(s, deps) {
    const { ctx, metadata, store, problem, boardError, getOnMessageReceived } = deps;

    // If an input changed after the prompt left, keep the reply uncaptured until the reader restores it.
    function resumeHeldBoard() {
        const held = s.heldBoard;
        if (!held) return;
        const index = (ctx?.chat ?? []).indexOf(held.message);
        if (index < 0 || !heldForMessage(metadata(), held.message)) {
            s.heldBoard = null;
            if (s.session === held.current) s.session = null;
            return;
        }
        held.index = index;
        held.current.index = index;
        const sid = readRecord(held.message)?.sid;
        if (store.headIndex() !== index || metadata()?.rpgFightHeldDiscarded?.[sid]) return;
        if (!held.board || boardError(store.head(), held.board)) return;
        if (held.staged && metadata()?.rpgFightBoard?.id !== held.board.id) return;
        s.heldBoard = null;
        Promise.resolve().then(() => getOnMessageReceived()(held.index));
    }

    function restoreHeldBoard() {
        if (s.heldBoard || !metadata()?.rpgFightHeld) return;
        const chat = ctx?.chat ?? [];
        for (let index = chat.length - 1; index >= 0; index -= 1) {
            const message = chat[index], saved = heldForMessage(metadata(), message);
            if (!saved) continue;
            const current = { ...structuredClone(saved.current), index };
            const board = boardStep(current).payload.board;
            s.session = current;
            s.heldBoard = { index, message, current, board, staged: saved.staged === true };
            problem({ index, code: 'BOARD_HELD', message: 'The fight reply is still waiting. Restore the sheet or gear, or discard the fight (Fight tab, Discard fight) and regenerate the reply.' });
            return;
        }
    }

    return { resumeHeldBoard, restoreHeldBoard };
}
