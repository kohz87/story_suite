// Story Director v2, part **arc**: the hooks that judge the story's new world entries (switch story-director.world-events; entries are marked
// waiting by the chronicle's world line while its setting `judge` is on). afterReceive starts the asking for every entry still waiting (never
// awaited); beforeGenerate starts it too and hands the verdicts that are ready to the chronicle's store command, so they are written on the
// message before the next reply and replay reads them from there. Nothing while the switch is off or nothing waits.

import { worldEventsOn } from '../../world/chronicle/conditions/feature.js';
import { JUDGED } from '../../world/chronicle/world-judge/judged.js';
import { judgeScope, worldJudgeAsker } from './world-ask.js';

/** The entries waiting for a verdict: [{ id, key, name, summary, place, conditions }], oldest first. */
export function waitingEntries(state) {
    const events = state?.domains?.chronicle?.events;
    if (!events || typeof events !== 'object') return [];
    return Object.values(events).filter(event => event?.judge?.state === 'pending' && typeof event.judge.key === 'string')
        .sort((a, b) => (a.since ?? 0) - (b.since ?? 0) || (a.id < b.id ? -1 : 1))
        .map(event => ({ id: event.id, key: event.judge.key, name: event.name, summary: event.summary, place: event.place, conditions: event.judge.conditions ?? [] }));
}

/** afterReceive: asks about the entries waiting. */
export function judgeAfterReceive(view, asker = worldJudgeAsker) {
    if (!worldEventsOn(view)) return;
    const items = waitingEntries(view?.state);
    if (items.length) asker.kick(view, items);
}

/** beforeGenerate: asks about the entries waiting, then `[{ type: 'chronicle.world.judged', payload }]` for the verdicts that are ready ([] when none). */
export function judgeBeforeGenerate(view, asker = worldJudgeAsker) {
    if (!worldEventsOn(view)) return [];
    const items = waitingEntries(view?.state);
    if (!items.length) return [];
    asker.kick(view, items);
    const ready = asker.drain(judgeScope(view), new Set(items.map(item => `${item.id}|${item.key}`)));
    return ready ? [{ type: JUDGED, payload: ready }] : [];
}
