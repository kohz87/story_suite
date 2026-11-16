// Story Director v2, chronicle pick: chronicle.surface command and beforeGenerate hook.

import { isOpen, isRecord, orderedEvents, surfacedOf } from '../domain.js';
import { toSlot } from '../../slot.js';
import { nearness, scenePlaceOf } from './nearness.js';
import { TAIL_EVENTS, pickEvents } from './scoring.js';
import { pickFresh } from './tail-pick.js';

export const SURFACE = 'chronicle.surface';

const isInt = value => Number.isSafeInteger(value);

/**
 * `chronicle.surface { at }` (cause `system`, from the hook): picks the open events for the reply
 * being written with the receipt's seed and records the pick. Refused from a click.
 */
export function surface(ctx, payload = {}) {
    if (ctx?.cause === 'ui') return ctx.fail('REFUSED', 'The world events for a reply are picked by Story Director itself.');
    const at = payload?.at ?? null;
    if (!(at === null || (isInt(at) && at >= 0))) return ctx.fail('INVALID', 'chronicle.surface: "at" must be the chat\'s length (a whole number).');
    const chronicle = ctx.draft('chronicle');
    const round = (chronicle.round ?? 0) + 1;
    const query = typeof ctx.query === 'function' ? (name, args) => ctx.query(name, args) : null;
    let scene = null;
    try { scene = typeof ctx.read === 'function' ? ctx.read('scene') : null; } catch { scene = null; }
    const near = nearness(query, scenePlaceOf(query, { domains: { scene } }));
    // One draw per open event, in id order, so the pick depends only on the seed and the state.
    const draws = new Map(orderedEvents(chronicle).filter(isOpen).map(event => event.id).sort().map(id => [id, ctx.rng()]));
    const ids = pickEvents(chronicle, { round, near, jitter: id => draws.get(id) ?? 0 });
    // A counter (a deleted pick takes its +1 away; later ones keep theirs).
    chronicle.round = round;
    // By key (SPEC §2.2): the picked events' rounds added, closed events' keys removed; never written whole.
    if (!isRecord(chronicle.seenAt)) chronicle.seenAt = {};
    for (const id of Object.keys(chronicle.seenAt)) if (!isOpen(chronicle.events[id])) delete chronicle.seenAt[id];
    for (const id of ids) chronicle.seenAt[id] = round;
    // This reply's pick, written whole (a slot).
    chronicle.surfaced = toSlot({ at, round, ids });
    const names = ids.map(id => chronicle.events[id].name);
    return { summary: names.length ? `World news for the next reply: ${names.join(', ')}.` : '', narrate: false, data: { ids, round } };
}

/** `beforeGenerate(view)`: commits `chronicle.surface` when there is a pick to make for this reply. */
export function beforeGenerate(view) {
    const chronicle = view?.state?.domains?.chronicle;
    if (!chronicle) return undefined;
    const open = Object.values(chronicle.events ?? {}).filter(isOpen).length;
    if (open <= TAIL_EVENTS) return undefined;
    const at = isInt(view?.chat?.length) ? view.chat.length : null;
    if (at === null || pickFresh(surfacedOf(chronicle), at)) return undefined;
    return { commands: [{ type: SURFACE, payload: { at } }] };
}
