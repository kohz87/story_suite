// Story Director v2, tracker part (note): builds the Director note's tail for a reply.

import { noteHeader, noteParts, tailNote } from '../../../note.js';
import { classify, estimateTokens } from '../../../relevance.js';
import { givenUpIn, untrackedCorrections } from '../../../tracker.js';
import { orderedThreads, toTracker } from '../convert.js';
import { problemList } from '../domain.js';
import { calendarOf, packCalendarOf, settingsFrom } from '../time.js';
import { calendarRule } from '../calendar-settings.js';
import { dropThreads, quietThreads } from '../quiet.js';
import { elsewhereCap, elsewhereItem, elsewhereLine, knownToUser, sceneOf, splitByScene } from '../scene.js';
import { initiativeTail } from '../initiative.js';
import { gapCue, replyGap } from '../../time/line-gap.js';
import { threadsOn, withoutOwnedThreads } from '../../threads.js';
import { TAIL_BUDGET, TAIL_THREADS } from './budgets.js';
import { staticText } from './static.js';
import { withoutEncounters } from './encounters.js';
import { tailThreads } from './tail-threads.js';

// All neutral instructions keep hook identity.
const v2Lines = value => value.replace(/\bquest Key\b/g, 'hook Key');

// The thread ids the time part's recap for this reply tells (empty without the time part).
function recappedIds(view) {
    if (typeof view?.query !== 'function') return new Set();
    try {
        const recap = view.query('time.recap', {});
        return new Set(Array.isArray(recap?.threads) ? recap.threads : []);
    } catch {
        return new Set();
    }
}

// The note's labels up to its kind lines: the Initiative and Elsewhere lines go right after them.
const SCENE_LABELS = new Set(['Header', 'No weekdays', 'While away', 'Due now', 'Arriving', 'Off-screen', 'World', 'Hooks', 'Quests', 'Clocks', 'Beats']);

function insertAfterKinds(parts, extra) {
    if (!extra.length) return parts;
    let at = 0;
    parts.forEach((entry, index) => { if (SCENE_LABELS.has(entry.label)) at = index + 1; });
    return [...parts.slice(0, at), ...extra, ...parts.slice(at)];
}

// The reminder that the story has not moved its clock for a while (time/line-gap.js), or ''. Only while the clock is set.
function gapLine(view, now) {
    if (now === null || typeof view?.query !== 'function') return '';
    try {
        return gapCue(replyGap(view?.chat?.length, view.query('time.lastLine', {})?.index));
    } catch {
        return '';
    }
}

const joined = parts => parts.map((entry, index) => (index ? entry.join : '') + entry.text).join('');

/** `context.tail(view)` → `{ lines, optional }` (SPEC §5). */
export function directorTail(view, { budget = TAIL_BUDGET } = {}) {
    const state = view?.state;
    const stored = state?.domains?.director;
    if (!stored) return { lines: [], optional: [] };
    const said = typeof view?.chat?.lastUser === 'string' ? view.chat.lastUser : '';
    // Without the feature `story-director.threads` the note speaks of quests and hooks only: nothing of the
    // agendas, events, clocks, beats and secrets the story may still hold (they are kept, not told).
    const threads = threadsOn(view);
    const kept = threads ? stored : withoutOwnedThreads(stored);
    const director = tailThreads(dropThreads(kept, quietThreads(kept, { state, query: typeof view.query === 'function' ? view.query : null })), { said, place: String(state?.domains?.scene?.place?.name ?? '') });
    const settings = settingsFrom(typeof view.settings === 'function' ? view.settings() : view.settings);
    const calendar = calendarOf(settings, packCalendarOf(view.query));
    const fights = view?.fights !== false;
    const tracker = fights ? toTracker(director) : withoutEncounters(toTracker(director));
    const now = director.time?.minutes ?? null;
    const message = director.turn?.n ?? 0;
    const selection = classify(tracker, {
        calendar,
        now,
        message,
        place: String(state?.domains?.scene?.place?.name ?? ''),
        recentText: said,
        settings: { dormantReplies: settings.dormantReplies, dormantDays: settings.dormantDays, dueSoonDays: settings.dueSoonDays },
    });
    // Highest priority first: the rest would only be cut again by the budget.
    if (selection.relevant.length > TAIL_THREADS) selection.relevant = selection.relevant.slice(0, TAIL_THREADS);
    const ordered = orderedThreads(director);
    const threadOf = new Map(tracker.records.map((record, index) => [record, ordered[index]]));
    // What can happen now first: the kind lines keep the threads that fit the scene (scene.js).
    const query = typeof view.query === 'function' ? view.query : null;
    const scene = sceneOf(query, state);
    const split = splitByScene(selection.relevant, { scene, calendar, now, dueSoonDays: settings.dueSoonDays, threads: threadOf, records: tracker.records });
    selection.relevant = split.here;
    // What the While away recap (the time part's `time.recap`) tells is not repeated under Due now or
    // Arriving (v1 note.js: the recapped items leave those lines).
    const recapped = recappedIds(view);
    if (recapped.size) {
        const ids = new Map(ordered.map((thread, index) => [tracker.records[index], thread.id]));
        selection.due = selection.due.filter(record => !recapped.has(ids.get(record)));
        selection.arriving = selection.arriving.filter(record => !recapped.has(ids.get(record)));
    }
    // The last reply's lines on names not tracked, as v1 reads its problems.
    const corrections = untrackedCorrections(problemList(director)
        .filter(problem => problem.turn === message)
        .map(problem => ({ ...problem, message: problem.turn })), { message });
    // Who takes the initiative in this reply (initiative.js): its line is kept, so its room comes first.
    const initiative = initiativeTail(view, { scene });
    const initiativeCost = initiative ? estimateTokens(`\n${initiative}`) : 0;
    const instruction = staticText({ fights, threads, calendarRule: calendarRule(calendar) });
    const total = budget + estimateTokens(instruction);
    let parts = noteParts(selection, {
        calendar,
        // v1's budget counts the instruction too; here it is in the static part.
        budgetTokens: total - initiativeCost,
        corrections,
        instruction,
        givenUp: givenUpIn(tracker, said),
        taking: [],
        declining: [],
    });
    // The rest {{user}} knows of, by name, at most `elsewhere` of them, while the budget has room.
    const others = split.elsewhere.filter(entry => knownToUser(entry.record)).slice(0, elsewhereCap(settings)).map(entry => elsewhereItem(entry.record));
    const room = total - initiativeCost - estimateTokens(joined(parts));
    while (others.length && estimateTokens(`\n${elsewhereLine(others)}`) > room) others.pop();
    const extra = [
        initiative ? { label: 'Initiative', text: initiative, join: '\n' } : null,
        others.length ? { label: 'Elsewhere', text: elsewhereLine(others), join: '\n' } : null,
    ].filter(Boolean);
    // A note with nothing else in it still says when and where it is.
    if (extra.length && !parts.some(entry => entry.label === 'Header')) parts = [{ label: 'Header', text: noteHeader(selection, calendar), join: '\n' }, ...parts];
    // The static part says there are no weekdays (calendarRule): the tail's own line for it would say it twice.
    // The time-gap cue goes right after the Header.
    const cue = gapLine(view, now);
    if (cue) {
        const at = parts.findIndex(entry => entry.label === 'Header') + 1;
        parts = [...parts.slice(0, at), { label: 'Time gap', text: cue, join: '\n' }, ...parts.slice(at)];
    }
    if (calendarRule(calendar)) parts = parts.filter((entry, index) => !index || entry.label !== 'No weekdays');
    const text = v2Lines(tailNote(insertAfterKinds(parts, extra)));
    // The Initiative line is kept (Story Block pins a `{ text, keep: true }` tail line under a tight budget); the rest are plain lines.
    const pinnedLine = initiative ? v2Lines(initiative).trimEnd() : '';
    return { lines: text ? text.split('\n').map(line => (pinnedLine && line.trimEnd() === pinnedLine ? { text: line, keep: true } : line)) : [], optional: [] };
}
