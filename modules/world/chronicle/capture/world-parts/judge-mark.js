// A narrator's new world entry waits for the Director's verdict (switch story-director.world-events, chronicle setting `judge`, default off;
// owner decision 17 Nov: "an auto-accepted world event does not wait for the judge: it shows as rumour at once; the judge confirms or reshapes
// it afterwards"). The entry made by the reply's world line is marked `judge: { state: 'pending', key, conditions }`: `key` is a hash of what
// the line wrote (a Re-read that writes other words gets a new key, so a verdict on the old words is never used), `conditions` the ones the
// line set (a refusal lifts them). At most two entries a reply wait; another is the line's as before. Pure on the draft.

import { sha256 } from '../../../hash.js';
import { conditionKey } from '../../conditions/key.js';
import { revOf } from '../../domain.js';

export const MAX_PENDING_PER_REPLY = 2;
const SET = /^\+(.+) \((.+)\)$/;

/** The key a verdict is stored under: the first 12 hex digits of the hash of the entry's words, place, factions and start. */
export const judgeKey = event => sha256(JSON.stringify([event.name, event.summary, event.place, event.factions ?? [], event.since ?? null])).slice(0, 12);

/** Whether the reader has the Director judge new world lines (the chronicle's setting; false where the host gives no settings). */
export function judgeLinesOn(ctx) {
    try { return (typeof ctx?.settings === 'function' ? ctx.settings() : null)?.judge === true; } catch { return false; }
}

/**
 * Marks the entry `id` the reply's world line just made (`done`: applyConditions' `['+name (ref)']`). Only a story line's new, plain entry
 * (no pack event wrote it, no pulse rumour), and only while the setting is on and the reply has room. Returns whether it was marked.
 */
export function markForJudge(ctx, chronicle, id, done = []) {
    const event = chronicle.events?.[id];
    if (ctx.cause !== 'story' || !event || event.by !== undefined || event.rumour !== undefined || event.judge !== undefined || !judgeLinesOn(ctx)) return false;
    const rev = revOf(ctx);
    const waiting = Object.values(chronicle.events).filter(other => other !== event && other?.judge?.state === 'pending' && other.rev === rev).length;
    if (waiting >= MAX_PENDING_PER_REPLY) return false;
    const conditions = done.map(text => SET.exec(text)).filter(Boolean).map(match => conditionKey(match[1], match[2])).slice(0, 6);
    event.judge = { state: 'pending', key: judgeKey(event), ...(conditions.length ? { conditions } : {}) };
    return true;
}
