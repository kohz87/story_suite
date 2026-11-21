// Story Director v2, part **arc**: the hooks that judge the story's new world entries (switch story-director.world-events; entries are marked
// waiting by the chronicle's world line while its setting `judge` is on). afterReceive starts the asking for every entry still waiting (never
// awaited); beforeGenerate starts it too and hands the verdicts that are ready to the chronicle's store command, so they are written on the
// message before the next reply and replay reads them from there. The same for tomorrow's daily roll (rollHook). Nothing while the switch is off or nothing waits.

import { worldEventsOn } from '../../world/chronicle/conditions/feature.js';
import { JUDGED } from '../../world/chronicle/world-judge/judged.js';
import { judgeScope, worldJudgeAsker } from './world-ask.js';
import { rollAsker } from './roll-ask.js';
import { rollCandidates } from '../../world/chronicle/world-judge/look-ahead.js';
import { ledgerOf } from '../../world/chronicle/conditions/ledger.js';

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

// Tomorrow's roll (judge/roll-ask.js): the daily pass (arc setting `dailyPass`) looks at every eligible event, else the judge (chronicle setting `judge`,
// read as `worldJudge`) at the ones the roll will fire. Not asked again for a day whose items all have a stored mark.
function rollLook(view) {
    let settings = {};
    try { settings = (typeof view?.settings === 'function' ? view.settings() : view?.settings) ?? {}; } catch { settings = {}; }
    const pass = settings.dailyPass === true;
    if (!pass && settings.worldJudge !== true) return null;
    const look = rollCandidates(view, { all: pass, settings: { tempo: settings.worldTempo } });
    if (!look) return null;
    const stored = ledgerOf(view.state.domains.chronicle?.ledger).marks ?? {};
    return look.items.every(item => `${item.id}|${look.day}` in stored) ? null : { look, pass };
}

/** afterReceive / beforeGenerate for tomorrow's roll: starts the asking; `drain` (beforeGenerate) also returns the store command for marks that are ready. */
export function rollHook(view, { drain = false, asker = rollAsker } = {}) {
    if (!worldEventsOn(view)) return [];
    const found = rollLook(view);
    if (!found) return [];
    asker.kick(view, found.look, found.pass);
    const ready = drain ? asker.drain(judgeScope(view), found.look.day) : null;
    return ready ? [{ type: JUDGED, payload: { results: {}, ...ready } }] : [];
}
