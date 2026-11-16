// The board's pre-port session API (openBoard, stageExchange, boardSession, discardBoard, markSend) over the interaction port, for tests that drive a fight without a view:
// the same arguments and the same return shapes, but every call goes through the real `sdk.interaction` implementation and the fight kind, on the chat metadata they are given.
import { createInteractionApi } from '../../../src/v2/sdk/interaction.js';
import { fightKind } from '../../../src/v2/lean-rpg/board/interaction.js';
import { FIGHT_KIND, openFight } from '../../../src/v2/lean-rpg/board/port-session.js';
import { toStep } from '../../../src/v2/lean-rpg/board/steps.js';
import { playBoard } from '../../../src/v2/lean-rpg/board/engine.js';
import { readSheet } from '../../../src/v2/lean-rpg/read.js';
import { resumeMembers } from '../../../src/v2/lean-rpg/board/resume.js';
import { markSend as copyOf } from '../../../src/v2/interaction/send.js';

const registry = { interaction: id => (id === FIGHT_KIND ? fightKind : null), featureOn: () => true };
const stateOf = state => (typeof state === 'function' ? state() : state);
const apiOn = (meta, state, sid) => createInteractionApi({ registry, meta: () => meta, state: () => stateOf(state), head: () => (sid ? { sid } : null), persona: () => readSheet(stateOf(state)).characters[0]?.who ?? '' });

/** A real `sdk.interaction` over the metadata, a state (or a function giving it) and the head reply's sid: for a board view built without a host. */
export const boardApi = (meta, state, sid) => apiOn(meta, state, sid);

/** The fight open on this chat's metadata (the pre-port `boardSession`): session-shaped (`id`, `anchor`, `setup`, `exchanges`, `groups`), or null. */
export const boardSession = meta => openFight(meta);

/** The pre-port `openBoard(meta, state, { sid, rules, gear, weapons, records })` → `{ session, preview }` or `{ error }`. A waiting start's recorded `result.opened` is the fight's `opened`. */
export function openBoard(meta, state, { sid, rules, gear = null, weapons = {}, records = [] } = {}) {
    const sheet = readSheet(state), groups = sheet.foes.filter(foe => foe.filled && foe.hurt > 0).map(foe => foe.slot);
    const start = meta?.storySuiteInteraction?.start, resumed = resumeMembers(records, groups, sheet.foes);
    const opened = start?.anchor === sid && Array.isArray(start.result?.opened) ? start.result.opened : null;
    const out = apiOn(meta, state, sid).open(FIGHT_KIND, { rules, gear, weapons, ...(resumed ? { resumed } : {}), ...(opened?.length ? { opened } : {}) });
    if (!out.ok) return { error: out.message };
    const session = openFight(meta);
    return { session, preview: playBoard(state, session.setup, session.exchanges) };
}

/** The pre-port `stageExchange(meta, state, actions)` → `{ session, preview }` or `{ error }`. */
export function stageExchange(meta, state, actions) {
    const session = openFight(meta);
    if (!session) return { error: 'Open a fight first.' };
    const out = apiOn(meta, state, session.anchor).stage(session.interactionId, toStep(state, actions));
    if (!out.ok) return { error: out.message };
    const now = openFight(meta);
    return { session: now, preview: playBoard(state, now.setup, now.exchanges) };
}

/** The pre-port `discardBoard(meta)` → whether a fight was open. */
export function discardBoard(meta) {
    const session = openFight(meta);
    return session ? apiOn(meta, null, session.anchor).discard(session.interactionId).ok === true : false;
}

/** The pre-port `markSend(meta, pending, session)`: copies the staged fight beside the waiting message. */
export const markSend = (meta, pending) => copyOf(meta?.storySuiteInteraction, pending, meta?.storySuiteInteraction?.open);
