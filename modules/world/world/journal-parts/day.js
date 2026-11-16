// Story Director v2, journal: one board day with what {{user}} must not see taken out, and its line, facts, search text and folds made again.

import { agoWords } from '../../chronicle/backlog.js';
import { dayLine, dayOf } from '../../chronicle/days.js';
import { namesHidden } from '../known.js';
import { isRecord, isInt, list } from './shared-helpers.js';
import { isNarratorNote } from './narrator-note.js';
import { wordEnd, summaryOf } from './row-text.js';
import { foldsOf } from './folds.js';

/**
 * One board day with what {{user}} must not see taken out, its line, facts and search text made again, and its folds by kind
 * (`cats`: Met, Relationships, Events, Party & gear, Items & money, Standing, Fame, Guild, Reputation, News). `context`: `{ now, threads, format }`: the story clock
 * (for "3 days ago"), the threads by id and the calendar's date text of story minutes.
 */
export function knownDay(entry, hidden, { now = null, threads = new Map(), format = null } = {}) {
    const lines = list(entry.happened);
    // Who was there at each line (new days only), without the people {{user}} does not know.
    const kept = lines.map((line, index) => ({ line, tag: entry.tags?.[index] ?? '', who: list(entry.who?.[index]).filter(name => !namesHidden(name, hidden.words)) })).filter(item => !namesHidden(item.line, hidden.words) && !isNarratorNote(item.line));
    const happened = kept.map(item => item.line);
    const happenedWho = kept.map(item => item.who);
    // The narrator's input hides agenda, beat and clock names too, as it always did; the screen's News fold reads the entry's own list (foldsOf).
    const drop = line => namesHidden(line, hidden.words) || namesHidden(line, hidden.behind);
    const world = list(entry.world).filter(line => !drop(line));
    const met = list(entry.met);
    const npcs = list(entry.npcs);
    const quests = isRecord(entry.quests) ? entry.quests : { taken: [], done: [], failed: [], dropped: [] };
    const removed = lines.length - happened.length;
    let short = String(entry.short ?? '');
    if (entry.brief) {
        if (namesHidden(short, hidden.words)) short = '';
    } else if (removed || world.length !== list(entry.world).length || namesHidden(short, hidden.words)) {
        // The line is made of the facts (days.js dayLine); made again from what is left.
        const line = dayLine(entry.date, { places: list(entry.places), quests, fights: entry.fights ?? { count: 0 }, money: entry.money ?? { in: 0, out: 0 }, npcs, world, happened, count: Math.max(0, (entry.count ?? 0) - removed) });
        short = entry.date && line.startsWith(`${entry.date}: `) ? line.slice(entry.date.length + 2) : line;
    }
    // The narrator's input (`eventLines`, `eventWho`, `search`) is worked out as it always was; the screen's own rows (`cats`, `meta`, `line`, `find`) by the display rules.
    const context = { kept, quests, hidden, threads, format };
    const told = foldsOf(entry, context);
    const events = told.find(cat => cat.id === 'events');
    const search = [entry.date, short, ...happened, ...list(entry.places), ...Object.values(quests).flatMap(list), ...npcs, ...world, ...met, ...told.map(cat => cat.search)].join(' • ');
    const cats = foldsOf(entry, context, true);
    const shown = cats.find(cat => cat.id === 'events');
    const find = [entry.date, short, ...happened, ...list(entry.places), ...Object.values(quests).flatMap(list), ...npcs, ...world, ...met, ...cats.map(cat => cat.search)].join(' • ');
    const ago = isInt(now) && isInt(entry.day) ? agoWords(dayOf(now) - entry.day) : '';
    return {
        day: entry.day,
        date: String(entry.date ?? ''),
        today: entry.today === true,
        brief: entry.brief === true,
        short,
        facts: list(entry.facts),
        happened,
        happenedWho,
        more: isInt(entry.more) ? entry.more : 0,
        total: happened.length + (isInt(entry.more) ? entry.more : 0),
        world,
        met,
        npcs,
        cats,
        hasCats: cats.length > 0,
        ago,
        eventCount: shown?.count ?? 0,
        // The "today" pill stands for today's own ago; every day tells its events ("quiet day" with none).
        meta: [entry.today === true ? '' : ago, shown ? `${shown.count} ${shown.count === 1 ? 'event' : 'events'}` : 'quiet day'].filter(Boolean).join(' · '),
        summary: summaryOf(short),
        // What the screen draws: the summary cut at a word end, and its search text (`search` is the narrator's, kept as it was).
        line: wordEnd(summaryOf(short)),
        find,
        // One line per event row (the thread's latest), for the narrator's [Earlier days] block.
        eventLines: (events?.items ?? []).map(row => (row.title ? `${row.title} (${row.chip}${row.note ? `, ${row.note}` : ''}): ${row.detail}`.replace(/: $/, '') : row.detail)),
        // Who was there for each of those lines (parallel; [] when unknown), for the same block's witnesses.
        eventWho: (events?.items ?? []).map(row => row.who ?? []),
        hasFacts: list(entry.facts).length > 0,
        hasHappened: happened.length > 0,
        hasWorld: world.length > 0,
        hasMet: met.length > 0,
        hasNpcs: npcs.length > 0,
        search,
    };
}
