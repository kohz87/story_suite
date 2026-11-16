// Chronicle queries' day facts, day events and note facts worked out from the chat's receipts.

import { worldLineText } from '../capture.js';
import { isLocked, orderedEvents } from '../domain.js';
import { dayFacts, dayOf, entryOf, eventsOf, sceneOf, walkDays } from '../days.js';
import { dayArg } from './shared-day-args.js';

// The lasting entries a pack event wrote, by the revision of the receipt that fired it: for the Journal's world
// lines (the event's own receipt tells only its cue; the nested `chronicle.lasting` has none). The entry keeps
// the receipt of the fire that last changed it (`fire`), so a world line or a reader's edit afterwards does not
// hide it; an entry without one (written by hand into a saved chat) is found by the revision it was last changed at.
function lastingByRev(state) {
    const byRev = new Map();
    for (const event of orderedEvents(state?.domains?.chronicle)) {
        const fire = event.fire ?? (isLocked(event) ? { rev: event.rev, by: event.by } : null);
        if (!fire || !Number.isSafeInteger(fire.rev)) continue;
        if (!byRev.has(fire.rev)) byRev.set(fire.rev, []);
        byRev.get(fire.rev).push({ id: event.id, by: fire.by, text: worldLineText(event) });
    }
    return rev => byRev.get(rev) ?? [];
}

/**
 * `chronicle.dayFacts { before }`: what the stored receipts say about each story day before day
 * `before` (all days when it is not given), worked out now and saved nowhere: `{ days: [{ day, facts,
 * revs }], settle: { from, to } | null }`. The digest command writes its digests from it.
 */
export function dayFactsQuery(state, { before = null } = {}, tools) {
    let entries = [];
    try { entries = typeof tools?.receipts === 'function' ? tools.receipts() ?? [] : []; } catch { entries = []; }
    const walk = walkDays(entries);
    const lasting = lastingByRev(state);
    const limit = Number.isSafeInteger(before) ? before : null;
    const days = [...walk.days.keys()].filter(day => limit === null || day < limit).sort((a, b) => a - b).map(day => {
        const receipts = walk.days.get(day);
        return { day, facts: dayFacts(receipts, { revDay: walk.revs, state, day, lasting }), revs: receipts.map(receipt => receipt.rev).filter(Number.isSafeInteger) };
    }).filter(entry => entry.facts.count > 0);
    return { days, settle: walk.settle ? { ...walk.settle } : null, today: Number.isSafeInteger(walk.minutes) ? dayOf(walk.minutes) : null };
}

/**
 * `chronicle.dayEvents { day }`: every event of that story day, worked out now from the chat's receipts by the rules the
 * digest picks its "happened" from (bookkeeping left out), saved nowhere: `{ day, events: [text] }`; null for a day that is not a whole number.
 */
export function dayEventsQuery(_state, { day = null } = {}, tools) {
    const wanted = dayArg(day);
    if (wanted === null || Number.isNaN(wanted)) return null;
    let entries = [];
    try { entries = typeof tools?.receipts === 'function' ? tools.receipts() ?? [] : []; } catch { entries = []; }
    return { day: wanted, events: eventsOf(walkDays(entries).days.get(wanted) ?? []) };
}

// The receipts after the note `through` (a receipt ID), in chat order, with the clock and scene they start from; else those
// after revision `after`. A note that a Re-read kept keeps its ID and sits after that reply's new receipts, so reading from it
// never reads again what it kept nor files a reply's receipts under a later note, whatever revisions the Re-read gave. The
// start is worked out from the receipts up to and including that one (an edit that moved the clock or the scene is followed),
// and is the note's stored `minutes` and `present` where those receipts say nothing (data trimmed away). `rev` is for an older
// state (no `through`) or a note whose receipt is gone.
function since(list, after, through, minutes, present) {
    const at = typeof through === 'string' && through ? list.findIndex(item => (item?.receipt ?? item)?.id === through) : -1;
    if (at < 0) return { list, after: Number.isSafeInteger(after) ? after : null, minutes, present };
    const prefix = list.slice(0, at + 1);
    const clock = walkDays(prefix).minutes;
    return { list: list.slice(at + 1), after: null, minutes: Number.isSafeInteger(clock) ? clock : minutes, present: sceneOf(prefix.map(item => item?.receipt ?? item), present) };
}

/**
 * `chronicle.noteFacts { after, through, minutes, present }`: what the receipts committed after the note `through` (a
 * receipt ID; else after revision `after`) hold
 * (fresh: Story Block still keeps their data), by story day, the clock at `minutes` before them:
 * `{ entries: [{ day, entry }], minutes, rev, settle }` (the clock and the last revision after them,
 * and the last time settle's jump among them; `present`: the scene they leave, from where the last note left it). The note command keeps the entries (digest.js).
 */
export function noteFactsQuery(state, { after: rev = null, through = null, minutes = null, present = null } = {}, tools) {
    let all = [];
    try { all = typeof tools?.receipts === 'function' ? tools.receipts() ?? [] : []; } catch { all = []; }
    const start = since(Array.isArray(all) ? all : [], rev, through, minutes, Array.isArray(present) ? present : []);
    const { list, after } = start;
    const walk = walkDays(list, { after, minutes: start.minutes });
    const lasting = lastingByRev(state);
    // Who was in the scene: the note's own (`present`, where the last note left it), moved on day by day through the present receipts.
    let scene = start.present;
    const entries = [...walk.days.keys()].sort((a, b) => a - b).map(day => {
        const receipts = walk.days.get(day);
        const entry = entryOf(receipts, day, { lasting, present: scene });
        scene = sceneOf(receipts, scene);
        return { day, entry };
    });
    const revs = [...walk.revs.keys()];
    // The receipts that touched a quest or thread (their own commands' `data.quest`, their lines'
    // `data.thread`), for the quest history (quest.details), kept by the note before the trim.
    const quests = [];
    for (const item of list) {
        const receipt = item?.receipt ?? item;
        if (!receipt || !Number.isSafeInteger(receipt.rev) || (after !== null && receipt.rev <= after)) continue;
        const thread = typeof receipt.data?.quest === 'string' ? receipt.data.quest : typeof receipt.data?.thread === 'string' ? receipt.data.thread : null;
        const said = typeof receipt.summary === 'string' ? receipt.summary.trim() : '';
        if (thread && said) quests.push({ rev: receipt.rev, thread, text: said });
        // Turn-ins a later Director line settled (tracker/quest-lines.js withSettled): each quest's history too.
        for (const item of Array.isArray(receipt.data?.settled) ? receipt.data.settled : []) {
            if (typeof item?.quest === 'string' && item.quest !== thread && said) quests.push({ rev: receipt.rev, thread: item.quest, text: said });
        }
    }
    return { entries, quests, present: scene, minutes: walk.minutes, rev: revs.length ? Math.max(...revs) : null, settle: walk.settle ? { ...walk.settle } : null };
}
