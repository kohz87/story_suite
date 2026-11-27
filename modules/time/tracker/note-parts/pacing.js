// Story Director v2, tracker part (note): the tail's pacing cues (breather, wrap-up, quiet scene), read from the state; nothing is stored.
//
// A beat is open from the reply that made it (`track.created.turn`) up to the reply that ended it: `track.closed.turn` for a
// closed one, `track.changed.turn` for one the story fired with `!` (quiet.js firedBeatIds). Replies are counted as the tracker
// counts them (`director.turn.n`). A chain is a run of replies that each ended with at least one of the story's own beats open.
// An open story beat holds a chain (and counts toward its beats) only while it is live: one with a readable date, while that date
// is at most one story day ahead (or past); any other (no date, one the calendar cannot read, or no story clock) while it was made,
// changed, seen or engaged in the last LIVE_REPLIES replies. An arc plan's beats (`track.arc`) are dated ahead and arrive
// together, so they make no chain and are not counted (else a new arc would at once be told to close them); an arc whose beats
// have all ended starts the breather too (a next plan accepted right after does not end it). An arc ended by the reader with
// beats open cannot be read: its ending keeps no reply count. No breather while an arc beat is due now.
// Limits of what the threads keep: a later line on a fired beat moves its end to that line's reply, a beat opened again
// after it ended reads as open since it was first made, and a beat that went quiet and ends later counts as open all along.

import { dateOf } from '../../../atlas/relevance.js';
import { ask } from '../scene.js';
import { dueWithin } from '../scene-parts/dates.js';
import { firedBeatIds } from '../quiet.js';
import { lastTurn } from './tail-threads.js';

/** The chain length (replies) from which the wrap-up cue is sent. */
export const WRAP_REPLIES = 12;
/** The beats opened during one chain from which the wrap-up cue is sent. */
export const WRAP_BEATS = 5;
/** An open undated story beat untouched for this many replies no longer holds a chain. */
export const LIVE_REPLIES = 15;
// The open beats the wrap-up cue names, at most.
const WRAP_NAMES = 3;
// The replies written after a chain ended that are asked to stay calm.
const BREATHER_REPLIES = 2;

const BREATHER = 'Breather: the last pressing thread is settled. Keep this reply calm (aftermath, rest, travel, people) unless {{user}} starts something.';
const wrapUp = (replies, names) => `Wrap-up: this chain of events has run for ${replies} ${replies === 1 ? 'reply' : 'replies'}. Steer toward resolving it: close its open beats (${names.join(', ')}) with ! beat lines, no new escalation, unless {{user}} pushes it further.`;
const QUIET_SCENE = 'Quiet scene: no new beat, clock or agenda this reply unless {{user}} starts one.';

const turnOf = at => (Number.isSafeInteger(at?.turn) ? at.turn : null);

function isLive(thread, now, { calendar, minutes }) {
    const dated = Boolean(calendar) && Number.isFinite(minutes) && ['on', 'due', 'arrive'].some(field => dateOf(thread, field, { calendar, reference: minutes }));
    return dated ? dueWithin(thread, { calendar, now: minutes, days: 1 }) : now - lastTurn(thread) < LIVE_REPLIES;
}

// Each beat with its name, the reply that made it (`from`, null when not kept) and the one that ended it (`to`; Infinity while
// open). An open story beat that is not live is left out.
function beatSpans(director, state, clock) {
    const fired = firedBeatIds(director, state);
    const now = director?.turn?.n ?? 0;
    return Object.values(director?.threads ?? {}).filter(thread => thread?.kind === 'beat').flatMap(thread => {
        const open = thread.status === 'active' && !fired.has(thread.id);
        const arc = thread.track?.arc ?? null;
        if (open && !arc && !isLive(thread, now, clock)) return [];
        const ended = thread.status === 'active' ? turnOf(thread.track?.changed) : turnOf(thread.track?.closed) ?? turnOf(thread.track?.changed);
        return [{ name: thread.key, order: thread.track?.order ?? 0, from: turnOf(thread.track?.created), to: open ? Infinity : ended, arc }];
    });
}

// The reply each played-out arc ended in: the last of its beats' ends, once none is open.
function arcEnds(spans) {
    const arcs = [...new Set(spans.map(span => span.arc).filter(Boolean))];
    return arcs.map(arc => spans.filter(span => span.arc === arc).map(span => span.to))
        .filter(ends => !ends.includes(Infinity) && ends.some(end => end !== null))
        .map(ends => Math.max(...ends.filter(end => end !== null)));
}

// No story beat is open: whether a chain or an arc ended just now and the story opened no beat since (a next arc's plan, accepted
// at once, does not end the breather).
function breathing(spans, now) {
    // Only a beat that was open when some reply ended makes a chain.
    const chains = spans.filter(span => !span.arc && span.from !== null && span.to !== null && span.from < span.to).map(span => span.to);
    const ends = [...chains, ...arcEnds(spans)];
    if (!ends.length) return false;
    const end = Math.max(...ends);
    return now >= end && now - end < BREATHER_REPLIES && !spans.some(span => !span.arc && span.from !== null && span.from > end);
}

// The chain running at reply `now`: `{ replies, opened }`, or null.
function chainAt(spans, now) {
    const lasting = spans.filter(span => span.from !== null && span.from <= now && span.to !== null && span.to > span.from).sort((a, b) => a.from - b.from);
    let start = null;
    let reach = -Infinity;
    for (const span of lasting) {
        if (span.from > reach) start = span.from;
        reach = Math.max(reach, span.to);
    }
    if (start === null || reach <= now) return null;
    // Reply 0 is before any reply (a beat a pack or the reader's start put there).
    const first = Math.max(start, 1);
    return { replies: now - first + 1, opened: spans.filter(span => span.from !== null && span.from >= start && span.from <= now).length };
}

function chainCue(director, state, clock, arcDue) {
    const now = director?.turn?.n ?? 0;
    const spans = beatSpans(director, state, clock);
    const story = spans.filter(span => !span.arc);
    if (!story.some(span => span.to === Infinity)) return !arcDue && breathing(spans, now) ? { label: 'Breather', text: BREATHER } : null;
    const chain = chainAt(story, now);
    if (!chain || (chain.replies < WRAP_REPLIES && chain.opened < WRAP_BEATS)) return null;
    // The oldest open ones first.
    const open = story.filter(span => span.to === Infinity).sort((a, b) => (a.from ?? 0) - (b.from ?? 0) || a.order - b.order);
    return { label: 'Wrap-up', text: wrapUp(chain.replies, open.slice(0, WRAP_NAMES).map(span => span.name)) };
}

/**
 * The pacing lines of this reply's tail, `[{ label, text, join }]`: the breather or the wrap-up, then the quiet-scene line while
 * the reader's switch is on (`pulse.quiet`: nothing while the World pulse is off, when the switch is not shown either).
 * `director` is the whole slice, ended beats included. `calendar` and `minutes` (the story clock, or null) judge a dated beat;
 * `arcDue`: an arc beat is on this note's Due now line. `threads: false` (no beats are taught): none.
 */
export function pacingLines(view, director, { state, threads = true, calendar = null, minutes = null, arcDue = false } = {}) {
    if (!threads) return [];
    const quiet = ask(typeof view?.query === 'function' ? view.query : null, 'pulse.quiet', {}, null)?.on === true;
    return [chainCue(director, state, { calendar, minutes }, arcDue), quiet ? { label: 'Quiet scene', text: QUIET_SCENE } : null]
        .filter(Boolean).map(entry => ({ ...entry, join: '\n' }));
}
