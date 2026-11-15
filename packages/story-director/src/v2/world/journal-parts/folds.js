// Story Director v2, journal: sorts one known day's lines into its folds by kind (Met, Events, News and the rest).

import { bucketDay, classify, parseTag } from '../../chronicle/backlog.js';
import { namesHidden } from '../known.js';
import { list } from './shared-helpers.js';
import { isNarratorNote } from './narrator-note.js';
import { wordEnd, same, plain } from './row-text.js';
import { isUpkeep } from './upkeep.js';
import { relationRows, itemRows, eventRows } from './rows.js';

const KINDS = [['met', 'Met'], ['relationships', 'Relationships'], ['events', 'Events'], ['party', 'Party & gear'], ['items', 'Items & money'], ['standing', 'Standing'], ['fame', 'Fame'], ['guild', 'Guild'], ['reputation', 'Reputation'], ['news', 'News']];

const textOf = row => [row.title, row.chip, row.detail, row.note, ...row.steps, ...row.tags].filter(Boolean).join(' ');

/** The Journal's folds of one known day: `[{ id, label, count, items: [{ title, chip, detail, note, tags }], search }]`, only kinds with something. */
export function foldsOf(entry, { kept, quests, hidden, threads, format }, display = false) {
    const fit = display ? wordEnd : same;
    const hide = line => namesHidden(line, hidden.words) || namesHidden(line, hidden.behind);
    const made = bucketDay({ ...entry, happened: kept.map(item => item.line), tags: kept.map(item => item.tag) });
    // A short day's own lists were made when it was written, before anything was hidden: they pass the same filter as a whole day's lines, at read time (a later Reveal shows them again).
    // `display`: the rows the screen draws. Every kind passes the same filter there: a secret's or an arc's name hides the line (a person with an agenda, or a
    // name a beat or clock shares with the story's own news, is not a spoiler: the line is the story's own). Without it (the narrator's [Earlier days] input,
    // eventLines) only relationships and news also hide agenda keys, as before: the prompt is unchanged.
    const plainHide = line => namesHidden(line, hidden.words);
    const relHide = display ? plainHide : hide;
    if (entry.brief) for (const cat of Object.keys(made)) made[cat] = made[cat].filter(line => !(!display && (cat === 'relationships' || cat === 'news') ? hide(line) : plainHide(line)) && !isNarratorNote(line));
    // Events keep their thread (a short day has only the lines).
    // On the screen, NPC upkeep ("nothing moved", mood, a look fixed) is not an event; the meter moves are the Relationships rows.
    const events = entry.brief ? (made.events ?? []).filter(line => !display || !isUpkeep('', line)).map(line => ({ line, thread: '' }))
        : kept.filter(item => classify({ type: parseTag(item.tag).type, text: item.line }) === 'events' && (!display || !isUpkeep(parseTag(item.tag).type, item.line))).map(item => ({ line: item.line, thread: parseTag(item.tag).thread, who: item.who }));
    const items = [...(made.items ?? []), ...(entry.moneyText && !entry.brief ? [`Money: ${entry.moneyText}`] : [])];
    const rows = {
        met: list(entry.met).map(name => ({ ...plain(''), title: name })),
        relationships: relationRows((made.relationships ?? []).filter(line => !relHide(line)), display),
        events: eventRows({ day: entry.day, quests, hide }, events, { threads, format, fit }),
        party: (made.party ?? []).map(line => plain(line, fit)),
        items: itemRows(items, fit),
        standing: (made.standing ?? []).map(line => plain(line, fit)),
        fame: (made.fame ?? []).map(line => plain(line, fit)),
        guild: (made.guild ?? []).map(line => plain(line, fit)),
        reputation: (made.reputation ?? []).map(line => plain(line, fit)),
        news: (entry.brief ? made.news ?? [] : list(entry.world).filter(line => !relHide(line))).map(line => plain(line, fit)),
    };
    if (entry.brief) rows.met = (made.met ?? []).map(name => ({ ...plain(''), title: name }));
    return KINDS.filter(([id]) => rows[id].length).map(([id, label]) => ({ id, label, count: rows[id].length, items: rows[id], search: rows[id].map(textOf).join(' • ') }));
}
