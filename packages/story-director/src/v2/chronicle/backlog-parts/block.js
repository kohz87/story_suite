// Story Director v2, chronicle part: builds and budgets the [Earlier days] backlog block from past Journal days.

import { cut, dayOf, flat } from '../days/shared.js';
import { ALWAYS_DAYS, BACKLOG_CHARS, BACKLOG_LINES, BACKLOG_TAG } from './limits.js';
import { isRecord, list } from './shared.js';
import { BODY_CHARS, agoWords, witnessText } from './witness.js';

// Relevance: a present person or the current place counts more than an open thread.
const WEIGHT = Object.freeze({ person: 2, place: 2, thread: 1 });

const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A name as a whole word (letters and digits bound it), any case.
function mentions(haystack, name) {
    if (!name) return false;
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(name)}(?![\\p{L}\\p{N}])`, 'iu').test(haystack);
}

// The relevance of a text to the scene: its present people, its place and its open threads, weighted.
function relevanceOf(haystack, rel) {
    let score = 0;
    for (const name of rel.present) if (mentions(haystack, name)) score += WEIGHT.person;
    if (rel.place && mentions(haystack, rel.place)) score += WEIGHT.place;
    for (const name of rel.threads) if (mentions(haystack, name)) score += WEIGHT.thread;
    return score;
}

// A thread's key: its first three words (lower case, punctuation gone), so one thread's lines of a day are one.
const threadKey = line => flat(line).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(' ').slice(0, 3).join(' ');

// The day's body: its latest line per thread, the lines that touch the scene (or the day's own line when none does), two at most.
// `who`: the people there for those lines (the recorded present lists of the day; a day stored before them has none).
function bodyOf(day, rel) {
    const latest = new Map();
    // The Journal's own event rows are already one per thread (knownDay `eventLines`); a day without them keeps its latest line per thread by the line's first words.
    const rows = Array.isArray(day.eventLines) ? { lines: day.eventLines, who: day.eventWho } : { lines: day.happened, who: day.happenedWho };
    list(rows.lines).forEach((line, index) => {
        const key = threadKey(line);
        latest.delete(key);
        latest.set(key, { line, who: list(Array.isArray(rows.who?.[index]) ? rows.who[index] : []) });
    });
    const touching = [...latest.values()].filter(item => relevanceOf(item.line, rel) > 0);
    const parts = touching.length ? touching : [{ line: flat(day.short), who: [] }].filter(item => item.line);
    const shown = parts.slice(0, 2);
    const body = cut(shown.map(item => item.line).join('; '), BODY_CHARS);
    return { body, who: [...new Set(shown.flatMap(item => item.who))] };
}

// The days' text to match names against: the Journal's own search text, else their lines joined.
const haystackOf = day => (typeof day.search === 'string' ? day.search : [day.short, ...list(day.happened), ...list(day.met), ...list(day.npcs), ...list(day.world)].join(' • '));

/**
 * The block's lines, or [] when there is nothing to tell. `days`: the Journal's known days (knownDay shape: day, date, short,
 * happened, search); `now`: the story clock in minutes; `present`: the names in the scene now; `place`: the current place's name;
 * `threads`: the names of the open quests and threads. Returns [BACKLOG_TAG, …day lines], newest day first.
 */
export function backlogBlock({ days = [], now = null, present = [], place = '', threads = [] } = {}) {
    if (!Number.isSafeInteger(now)) return [];
    const today = dayOf(now);
    const rel = { present: list(present), place: flat(place), threads: list(threads) };
    const past = (Array.isArray(days) ? days : []).filter(day => isRecord(day) && Number.isSafeInteger(day.day) && day.day < today).sort((a, b) => b.day - a.day);
    if (!past.length) return [];
    const always = past.slice(0, ALWAYS_DAYS);
    const rest = past.slice(ALWAYS_DAYS)
        .map(day => ({ day, score: relevanceOf(haystackOf(day), rel) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || b.day.day - a.day.day)
        .map(item => item.day);
    // Priority order: the last two days, then the most relevant; a line that does not fit is skipped, so the lowest-ranked go first.
    const ranked = [];
    for (const day of [...always, ...rest]) {
        if (ranked.length >= BACKLOG_LINES) break;
        const { body, who } = bodyOf(day, rel);
        if (!body) continue;
        const date = flat(day.date) || `Day ${day.day}`;
        const ago = agoWords(today - day.day);
        const plain = `${date}${ago ? ` (${ago})` : ''}: ${body}`;
        ranked.push({ day: day.day, plain, line: `${plain}${witnessText(who)}` });
    }
    // The budget is unchanged. The plain lines are fitted first (the lowest-ranked that do not fit are skipped); then the names go back on
    // the surviving lines from the highest-ranked down, each only while it still fits.
    const block = [];
    let used = BACKLOG_TAG.length;
    for (const item of ranked) {
        if (block.length >= BACKLOG_LINES) break;
        if (used + 1 + item.plain.length > BACKLOG_CHARS) continue;
        block.push(item);
        used += 1 + item.plain.length;
    }
    for (const item of block) {
        const extra = item.line.length - item.plain.length;
        if (used + extra > BACKLOG_CHARS) continue;
        item.shown = item.line;
        used += extra;
    }
    if (!block.length) return [];
    return [BACKLOG_TAG, ...block.sort((a, b) => b.day - a.day).map(item => item.shown ?? item.plain)];
}
