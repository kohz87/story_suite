// What a story line does to a world entry the Director is still judging, or has refused: a changed pending entry is re-keyed
// (a verdict on the old words is then skipped), and a refused entry stays refused unless a `+` line restarts it. Pure on the draft.
import { judgeKey } from './judge-mark.js';

/** An update by the story to an entry still waiting: its words changed, so the verdict now owed is on the new words (a verdict on the old ones is skipped, judged.js). */
export function rekeyPending(chronicle, id) {
    const event = chronicle.events?.[id];
    if (event?.judge?.state === 'pending') event.judge = { ...event.judge, key: judgeKey(event) };
}

/** What a story line does to an entry the Director refused: only a `+` line restarts it (its judge field goes, it is a plain entry again); any other line leaves it refused. */
export function refusedHold(chronicle, id, op) {
    const event = chronicle.events?.[id];
    if (event?.judge?.state !== 'refused') return null;
    if (op === '+') { delete event.judge; return null; }
    return { summary: `World: ${event.name} stays a false rumour (the Director refused it); the line is not used.`, narrate: false, data: { event: id, state: event.state, idle: true, refused: true } };
}
