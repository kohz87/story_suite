// The card's words for a reply's events and the amounts they asked and moved on the four built-in axes.
import { RELATIONSHIP_KEYS } from '../../core-relationship-model.js';
import { PACING_TIERS } from '../relationship-pacing.js';
import { describeGate } from '../../npc-meters-gate.js';
import { AXES } from './shared-limits.js';

/** The signed amounts a run's moved meters made on the four built-in axes: { axis: n } (nothing moved: {}). */
export const movesOf = moved => Object.fromEntries(moved.filter(item => AXES.includes(item.meter) && item.after !== item.before).map(item => [item.meter, item.after - item.before]));

/**
 * The card's words for one reply's events: { tier, held, note, ask, date }. `tier`: the highest tier actually spent, else the highest
 * asked (events naming only custom meters are left out); `held`: every event was held (then `note` is the first hold's words); `ask`: the held events' asks summed per axis, an axis a
 * story line named counted from the story only (a scanner's request for it is left out).
 */
export function eventSummary(event) {
    if (!event) return null;
    const rank = name => PACING_TIERS.indexOf(name);
    const top = list => list.reduce((best, item) => (rank(item.tier) > rank(best) ? item.tier : best), list[0].tier);
    const spent = event.events.filter(item => !item.held);
    const held = spent.length === 0;
    // An event that names only custom meters asks nothing of the axes: it does not set the chip (unless no event asks anything).
    const asking = event.events.filter(item => Object.keys(item.ask).length);
    const counted = asking.length ? asking : event.events;
    const countedSpent = counted.filter(item => !item.held);
    const named = new Set(event.events.filter(item => item.src === 'story').flatMap(item => Object.keys(item.ask)));
    const ask = {};
    for (const item of event.events.filter(entry => entry.held)) {
        for (const [axis, value] of Object.entries(item.ask)) if (item.src === 'story' || !named.has(axis)) ask[axis] = (ask[axis] || 0) + value;
    }
    // The anti-lever gate's words for the last story line that named an approach: "via praise · 3rd in 2 days · backfired".
    const approach = event.events.findLast(item => item.src === 'story' && item.via);
    const gate = approach ? describeGate(approach.gate ? { via: approach.via, ...approach.gate } : null) || `via ${approach.via}` : '';
    // The reason the story line gave (reason / why / because ...): the last story event's; (rule NSDFOLLOW-3) none: the scan's for the same reply.
    const why = event.events.findLast(item => item.src === 'story' && item.why)?.why ?? event.events.findLast(item => item.why)?.why ?? '';
    return { tier: top(countedSpent.length ? countedSpent : counted), held, note: held ? event.events[0].note : '', ask, date: event.date, ...(gate ? { gate } : {}), ...(why ? { why } : {}) };
}

/** What `changes` ask of the four built-in axes, per axis: an add is its value, a set the distance from the value now (`now(meter)`). */
export function askedOf(changes, now) {
    const ask = {};
    for (const change of changes) {
        if (!RELATIONSHIP_KEYS.includes(change.meter)) continue;
        ask[change.meter] = (ask[change.meter] || 0) + (change.mode === 'add' ? change.value : change.value - now(change.meter));
    }
    return ask;
}
