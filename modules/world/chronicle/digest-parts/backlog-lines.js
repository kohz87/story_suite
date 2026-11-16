// Story Director v2, chronicle part: the [Earlier days] block's lines for the next reply, from the Journal. Pure.

import { backlogBlock } from '../backlog.js';
import { nowFrom } from '../queries.js';
import { ask, digestOn, isInt } from './shared-ask.js';

/** About 200 tokens: the day lines of the block are optional tail lines (all but the newest day's), which Story Block drops before anything else. */
export const BACKLOG_BUDGET = 200;
/** The one sentence that explains the block: the first line of its cue (backlogCue), never part of the static prompt. */
export const BACKLOG_STATIC = 'Lines under [Earlier days] are what happened on past days, each with how long ago it was (counted by code): let people remember them as dated, and never invent other days.';

const namesOf = value => (Array.isArray(value) ? value : []).map(entry => (typeof entry === 'string' ? entry : entry?.name)).filter(name => typeof name === 'string' && name.trim());

/**
 * The [Earlier days] lines for the next reply: `[]` or `[tag, ...day lines]` (backlog.js). The days are the Journal's known days
 * (`director.journal`, so secrets and planner text never go in), the scene is who is present now, the current place and the open
 * quests and threads. Nothing while the digest is off, on a first day, or when the Journal cannot be read. The Journal is the World view's
 * query (`director.journal`), so with the World view feature off there is no block, and no sentence either (the sentence is part of the
 * pinned cue, `backlogCue`): block and sentence are one cue.
 */
export function backlogLines(view) {
    if (!digestOn(view) || !view?.state?.domains?.chronicle) return [];
    const query = typeof view.query === 'function' ? (name, args) => view.query(name, args) : null;
    const now = nowFrom(query, view.state);
    if (!isInt(now)) return [];
    const journal = ask(query, 'director.journal', {});
    if (!Array.isArray(journal?.days) || !journal.days.length) return [];
    const place = ask(query, 'scene.place', {}) ?? view.state?.domains?.scene?.place ?? null;
    const present = [...namesOf(ask(query, 'scene.present', {}) ?? view.state?.domains?.scene?.present), ...namesOf(ask(query, 'npc.present', {}))];
    const open = (ask(query, 'director.threads', { status: 'active' }) ?? []).filter(thread => thread && thread.status === 'active' && !thread.ended && typeof thread.key === 'string');
    return backlogBlock({ days: journal.days, now, present, place: String(place?.name ?? ''), threads: open.map(thread => thread.key) });
}
