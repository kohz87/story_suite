/* NPC State Delta dossier view-model part: the change the With {{user}} card shows, with the stored event details of the latest change. */
import { changeStamp, plain, RELATIONSHIP_AXES } from '../dossier-ui-model.js';
import { object } from './shared-object.js';

const EVENT_TIERS = Object.freeze(['ordinary', 'meaningful', 'major', 'extreme']);

// The stored event details of the latest change (tier, held, note, ask, date), or null when there are none.
function eventModel(event) {
    const source = object(event);
    if (!EVENT_TIERS.includes(source.tier)) return null;
    const ask = RELATIONSHIP_AXES
        .map(([axis, label]) => ({ axis, label, value: Math.round(Number(object(source.ask)[axis]) || 0) }))
        .filter(item => item.value !== 0);
    return {
        tier: source.tier,
        held: source.held === true,
        note: plain(source.note),
        ask,
        date: plain(source.date),
        gate: plain(source.gate),
        why: plain(source.why),
    };
}

// The change the With {{user}} card shows: the four axis moves of the latest reply, its reason and its stamp.
export function changeModel(change) {
    const source = object(change);
    const delta = RELATIONSHIP_AXES.map(([axis, label]) => ({ axis, label, value: Math.round(Number(object(source.delta)[axis]) || 0) }));
    const moved = delta.filter(item => item.value !== 0);
    const stamp = changeStamp({ turn: source.turn, message: source.message });
    const event = eventModel(source.event);
    return {
        impact: plain(source.impact, 'none').toLocaleLowerCase(),
        moved,
        reason: plain(source.reason),
        when: stamp.label,
        mark: stamp.mark,
        legacy: stamp.legacy,
        hosted: source.hosted === true,
        event,
        gate: event?.gate || '',
        hasChange: moved.length > 0 || Boolean(plain(source.reason)) || event !== null,
    };
}
