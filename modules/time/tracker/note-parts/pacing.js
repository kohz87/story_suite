// Story Director v2, tracker part (note): the tail's pacing cues (breather, wrap-up, quiet scene), read from the state; nothing is stored.
//
// A beat is open from the reply that made it (`track.created.turn`) up to the reply that ended it: `track.closed.turn` for a
// closed one, `track.changed.turn` for one the story fired with `!` (quiet.js firedBeatIds). Replies are counted as the tracker
// counts them (`director.turn.n`). A chain is a run of replies that each ended with at least one of the story's own beats open
// (one dated for later counts too). An arc plan's beats (`track.arc`) are dated ahead and arrive together, so they make no
// chain and are not counted (else a new arc would at once be told to close them); an arc whose beats have all ended starts the
// breather too (a next plan accepted right after does not end it). An arc ended by the reader with beats open cannot be read:
// its ending keeps no reply count. An open story beat the tail no longer reads (tail-threads.js: idle too long) holds no chain
// and is not counted: the narrator is not shown it, so cannot be asked to close it.
// Limits of what the threads keep: a later line on a fired beat moves its end to that line's reply, and a beat opened again
// after it ended reads as open since it was first made.

import { ask } from '../scene.js';
import { firedBeatIds } from '../quiet.js';

/** The chain length (replies) from which the wrap-up cue is sent. */
export const WRAP_REPLIES = 12;
/** The beats opened during one chain from which the wrap-up cue is sent. */
export const WRAP_BEATS = 5;
// The replies written after a chain ended that are asked to stay calm.
const BREATHER_REPLIES = 2;

const BREATHER = 'Breather: the last pressing thread is settled. Keep this reply calm (aftermath, rest, travel, people) unless {{user}} starts something.';
const wrapUp = replies => `Wrap-up: this chain of events has run for ${replies} ${replies === 1 ? 'reply' : 'replies'}. Steer toward resolving it: close its open beats (! beat lines), no new escalation, unless {{user}} pushes it further.`;
const QUIET_SCENE = 'Quiet scene: no new beat, clock or agenda this reply unless {{user}} starts one.';

const turnOf = at => (Number.isSafeInteger(at?.turn) ? at.turn : null);

// Each beat with the reply that made it (`from`, null when not kept) and the one that ended it (`to`; Infinity while open).
// `read`: the threads the tail reads, by id (all when not given).
function beatSpans(director, state, read) {
    const fired = firedBeatIds(director, state);
    const isOpen = thread => thread.status === 'active' && !fired.has(thread.id);
    const unread = thread => read && !thread.track?.arc && isOpen(thread) && !Object.hasOwn(read, thread.id);
    return Object.values(director?.threads ?? {}).filter(thread => thread?.kind === 'beat' && !unread(thread)).map(thread => {
        const open = isOpen(thread);
        const ended = thread.status === 'active' ? turnOf(thread.track?.changed) : turnOf(thread.track?.closed) ?? turnOf(thread.track?.changed);
        return { from: turnOf(thread.track?.created), to: open ? Infinity : ended, arc: thread.track?.arc ?? null };
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

function chainCue(director, state, read) {
    const now = director?.turn?.n ?? 0;
    const spans = beatSpans(director, state, read);
    const story = spans.filter(span => !span.arc);
    if (!story.some(span => span.to === Infinity)) return breathing(spans, now) ? { label: 'Breather', text: BREATHER } : null;
    const chain = chainAt(story, now);
    return chain && (chain.replies >= WRAP_REPLIES || chain.opened >= WRAP_BEATS) ? { label: 'Wrap-up', text: wrapUp(chain.replies) } : null;
}

/**
 * The pacing lines of this reply's tail, `[{ label, text, join }]`: the breather or the wrap-up, then the quiet-scene line while
 * the reader's switch is on (`pulse.quiet`: nothing while the World pulse is off, when the switch is not shown either).
 * `director` is the whole slice, ended beats included; `read` is the threads the tail reads (by id).
 * `threads: false` (no beats are taught): none.
 */
export function pacingLines(view, director, { state, threads = true, read = null } = {}) {
    if (!threads) return [];
    const quiet = ask(typeof view?.query === 'function' ? view.query : null, 'pulse.quiet', {}, null)?.on === true;
    return [chainCue(director, state, read), quiet ? { label: 'Quiet scene', text: QUIET_SCENE } : null]
        .filter(Boolean).map(entry => ({ ...entry, join: '\n' }));
}
