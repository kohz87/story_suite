// Story Suite v2: the held fight reply's events, moved out of createEvents unchanged: a reply kept uncaptured while its fight board input changed
// is resumed once the reader restores it, and found again after a chat is opened. `createHeldEvents(s, deps)` is given the turn's state holder `s`
// and the turn parts it uses; `getOnMessageReceived` gives the capture it resumes into.
import { readRecord } from '../persist.js';
import { boardStep, heldForMessage } from './held-board.js';
import { heldForMessage as heldInteraction } from '../interaction/held.js';
import { settleStep } from '../interaction/watch.js';

export function createHeldEvents(s, deps) {
    const { ctx, metadata, store, problem, boardError, interactionError = () => null, getOnMessageReceived } = deps;

    // If an input changed after the prompt left, keep the reply uncaptured until the reader restores it.
    function resumeHeldBoard() {
        const held = s.heldBoard;
        if (!held) return;
        const index = (ctx?.chat ?? []).indexOf(held.message);
        const box = metadata()?.storySuiteInteraction;
        if (index < 0 || !(held.interaction ? heldInteraction : heldForMessage)(metadata(), held.message)) {
            s.heldBoard = null;
            if (s.session === held.current) s.session = null;
            return;
        }
        held.index = index;
        held.current.index = index;
        const sid = readRecord(held.message)?.sid;
        if (store.headIndex() !== index || (held.interaction ? box?.heldDiscarded?.[sid] : metadata()?.rpgFightHeldDiscarded?.[sid])) return;
        if (held.interaction ? interactionError(store.head(), held.interaction) : (!held.board || boardError(store.head(), held.board))) return;
        if (held.staged && (held.interaction ? box?.open?.id !== held.interaction.id : metadata()?.rpgFightBoard?.id !== held.board.id)) return;
        s.heldBoard = null;
        Promise.resolve().then(() => getOnMessageReceived()(held.index));
    }

    // An interaction reply held across a reload: the same hold, found by the reply's marker.
    function restoreHeldInteraction() {
        const box = metadata()?.storySuiteInteraction;
        if (s.heldBoard || !box?.held) return;
        const chat = ctx?.chat ?? [];
        for (let index = chat.length - 1; index >= 0; index -= 1) {
            const message = chat[index], saved = heldInteraction(metadata(), message);
            if (!saved) continue;
            const current = { ...structuredClone(saved.current), index }, payload = settleStep(current).payload;
            s.session = current;
            s.heldBoard = { index, message, current, interaction: payload, staged: saved.staged === true,
                hold: 'Restore what the interaction used, or discard it, and regenerate the held reply.' };
            problem({ index, code: 'INTERACTION_HELD', message: 'The reply is still waiting for its interaction. Restore what it used, or discard it, and regenerate the reply.' });
            return;
        }
    }

    function restoreHeldBoard() {
        if (!s.heldBoard) restoreHeldInteraction();
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
