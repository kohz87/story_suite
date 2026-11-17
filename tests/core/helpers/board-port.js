// The board's session API (boardApi, boardSession, discardBoard, markSend) over the interaction port, for tests that drive a fight without a view:
// every call goes through the real `sdk.interaction` implementation and the fight kind, on the chat metadata they are given.
import { createInteractionApi } from '../../../core/sdk/interaction.js';
import { fightKind } from '../../../modules/rpg/board/interaction.js';
import { FIGHT_KIND, openFight } from '../../../modules/rpg/board/port-session.js';
import { readSheet } from '../../../modules/rpg/read.js';
import { markSend as copyOf } from '../../../core/interaction/send.js';

const registry = { interaction: id => (id === FIGHT_KIND ? fightKind : null), featureOn: () => true };
const stateOf = state => (typeof state === 'function' ? state() : state);
const apiOn = (meta, state, sid) => createInteractionApi({ registry, meta: () => meta, state: () => stateOf(state), head: () => (sid ? { sid } : null), persona: () => readSheet(stateOf(state)).characters[0]?.who ?? '' });

/** A real `sdk.interaction` over the metadata, a state (or a function giving it) and the head reply's sid: for a board view built without a host. */
export const boardApi = (meta, state, sid) => apiOn(meta, state, sid);

/** The fight open on this chat's metadata (the pre-port `boardSession`): session-shaped (`id`, `anchor`, `setup`, `exchanges`, `groups`), or null. */
export const boardSession = meta => openFight(meta);

/** `discardBoard(meta)` → whether a fight was open. */
export function discardBoard(meta) {
    const session = openFight(meta);
    return session ? apiOn(meta, null, session.anchor).discard(session.interactionId).ok === true : false;
}

/** `markSend(meta, pending, session)`: copies the staged fight beside the waiting message. */
export const markSend = (meta, pending) => copyOf(meta?.storySuiteInteraction, pending, meta?.storySuiteInteraction?.open);
