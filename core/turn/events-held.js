// Story Suite v2: the held interaction reply's events, moved out of createEvents: a reply kept uncaptured while what its interaction read changed
// is resumed once the reader restores it, and found again after a chat is opened. `createHeldEvents(s, deps)` is given the turn's state holder `s`
// and the turn parts it uses; `getOnMessageReceived` gives the capture it resumes into.
import { readRecord } from '../persist.js';
import { heldForMessage as heldInteraction } from '../interaction/held.js';
import { openingStep, settleStep } from '../interaction/watch.js';

export function createHeldEvents(s, deps) {
    const { ctx, metadata, store, problem, interactionError = () => null, getOnMessageReceived } = deps;

    // If an input changed after the prompt left, keep the reply uncaptured until the reader restores it.
    function resumeHeldBoard() {
        const held = s.heldBoard;
        if (!held) return;
        const index = (ctx?.chat ?? []).indexOf(held.message);
        const box = metadata()?.storySuiteInteraction;
        if (index < 0 || !heldInteraction(metadata(), held.message)) {
            s.heldBoard = null;
            if (s.session === held.current) s.session = null;
            return;
        }
        held.index = index;
        held.current.index = index;
        const sid = readRecord(held.message)?.sid;
        if (store.headIndex() !== index || box?.heldDiscarded?.[sid]) return;
        if (interactionError(store.head(), held.interaction, openingStep(held.current))) return;
        if (held.staged && box?.open?.id !== held.interaction.id) return;
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
                hold: 'Restore what the interaction used, or discard the interaction from its screen, and regenerate the held reply.' };
            problem({ index, code: 'INTERACTION_HELD', message: 'The reply is still waiting for its interaction. Restore what it used, or discard the interaction from its screen, and regenerate the reply.' });
            return;
        }
    }

    // Found again after a chat is opened. A reply held by a fight from before the port (its own metadata keys) is not carried: its markers go with the open fight (turn/events.js).
    function restoreHeldBoard() {
        if (!s.heldBoard) restoreHeldInteraction();
    }

    return { resumeHeldBoard, restoreHeldBoard };
}
