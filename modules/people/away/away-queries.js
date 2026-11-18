// The away part's queries (pure apart from the queries they ask). Followed is read at answer time from the people store (`people.list`'s
// `followed`), never stored here, so the star and the away lines replay each on their own replies.
// - `director.away` → `[{ name, aliases, here, followed, away: { doing, since, back, steps: [{ date, text }] } | null, removed? }]`, the
//   contract NPC State reads (its hold, Belonging, "While away"): the people away now, then those back from an absence (`away: null`, the
//   newest kept), then the followed people who are neither. `removed: { reason: 'died' }` for one the store has as dead (no hold for them).
//   `since`, `back` and a step's `date` are story minutes (null when not known; `back` is the start of the day they are due).
// - `director.away.view` → `{ people: [{ key, name, here, away, followed, due, doing, status, step, newsAgo, back }], elsewhere, tokens }`: the
//   World screen's Elsewhere section and People › Elsewhere's "back <date>" and "doing" lines (followed people not in the scene, and anyone away).

import { calendarFrom } from '../../world/world/known.js';
import { tables } from './away-domain.js';
import { awayEntries, awayTail } from './away-prompt.js';
import { cutPoints, keyOf } from './away-text.js';
import { dateText } from './away-time.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isInt = Number.isSafeInteger;
const queryOf = tools => (typeof tools?.query === 'function' ? (name, args) => tools.query(name, args) : null);
const ask = (query, name, args = {}) => {
    try { return typeof query === 'function' ? query(name, args) ?? null : null; } catch { return null; }
};
// Story Block's present list drops a leading article ("the scout" is listed as "scout"), so a name is matched with it too.
const bare = key => key.replace(/^(?:the|a|an)\s+/, '');
const keysOf = (name, aliases = []) => [keyOf(name), ...aliases.map(keyOf)].filter(Boolean);
const deepFreeze = value => {
    if (value && typeof value === 'object') { for (const inner of Object.values(value)) deepFreeze(inner); Object.freeze(value); }
    return value;
};

// What the answers are made of: the store's people (by any of their names), who is here, the clock.
function sources(state, tools) {
    const query = queryOf(tools);
    const list = ask(query, 'people.list', {});
    const people = (Array.isArray(list) ? list : []).filter(row => isRecord(row) && typeof row.name === 'string');
    const here = new Set(people.filter(row => row.present === true).flatMap(row => keysOf(row.name, row.aliases ?? [])));
    for (const name of ['scene.present', 'npc.present']) {
        const present = ask(query, name, {});
        for (const entry of Array.isArray(present) ? present : []) {
            const key = keyOf(typeof entry === 'string' ? entry : entry?.name);
            if (key) here.add(key);
        }
    }
    const personOf = key => people.find(row => keysOf(row.name, row.aliases ?? []).includes(key)) ?? null;
    const minutes = state?.domains?.director?.time?.minutes;
    return { query, people, here, personOf, now: isInt(minutes) ? minutes : null };
}

const absence = record => ({
    doing: String(record.doing ?? ''), since: isInt(record.since) ? record.since : null, back: isInt(record.back) ? record.back : null,
    steps: (Array.isArray(record.steps) ? record.steps : []).filter(isRecord).map(step => ({ date: isInt(step.date) ? step.date : null, text: String(step.text ?? '') })),
});

/** `director.away` (see the header). */
export function awayQuery(state, _args, tools) {
    const { people, here, personOf } = sources(state, tools);
    const { away, home } = tables(state?.domains?.away);
    const out = [];
    const seen = new Set();
    const row = (key, name, record, gone) => {
        const person = personOf(key);
        const aliases = person ? [person.name, ...(person.aliases ?? [])].filter(alias => keyOf(alias) !== keyOf(name)).slice(0, 8) : [];
        const keys = keysOf(name, aliases);
        if (keys.some(own => seen.has(own))) return;
        keys.forEach(own => seen.add(own));
        out.push({
            name, aliases, here: keys.some(own => here.has(own) || here.has(bare(own))), followed: person?.followed === true,
            away: gone ? absence(record) : null, ...(person?.lifeState === 'deceased' ? { removed: { reason: 'died' } } : {}),
        });
    };
    for (const [key, record] of Object.entries(away)) if (isRecord(record)) row(key, String(record.name), record, true);
    for (const [key, record] of Object.entries(home).sort(([, a], [, b]) => (b?.rev ?? 0) - (a?.rev ?? 0))) if (isRecord(record)) row(key, String(record.name), record, false);
    for (const person of people) if (person.followed === true && person.lifeState !== 'deceased') row(keyOf(person.name), person.name, null, false);
    return deepFreeze(out.slice(0, 50));
}

const agoOf = days => (days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

/** `director.away.view` (see the header). */
export function awayView(state, _args, tools) {
    const { query, people, here, personOf, now } = sources(state, tools);
    const slice = state?.domains?.away;
    const calendar = calendarFrom(query);
    const rows = [];
    const seen = new Set();
    for (const entry of awayEntries(slice, now)) {
        const person = personOf(entry.key);
        const keys = person ? keysOf(person.name, person.aliases ?? []) : [entry.key];
        keys.forEach(key => seen.add(key));
        const back = dateText(calendar, entry.back);
        const step = entry.last?.text ? cutPoints(entry.last.text, 140) : '';
        rows.push({
            key: entry.key, name: person?.name ?? entry.name, here: keys.some(key => here.has(key) || here.has(bare(key))), away: true, followed: person?.followed === true, due: entry.due,
            status: entry.due ? 'Away · due back' : back ? `Away · back ${back}` : 'Away', doing: entry.doing ? cutPoints(entry.doing, 160) : 'Away.', step,
            newsAgo: isInt(now) && isInt(entry.last?.date) && now >= entry.last.date ? agoOf(Math.floor(now / 1440) - Math.floor(entry.last.date / 1440)) : '', back,
        });
    }
    for (const person of people) {
        const keys = keysOf(person.name, person.aliases ?? []);
        if (person.followed !== true || person.lifeState === 'deceased' || keys.some(key => seen.has(key))) continue;
        const present = keys.some(key => here.has(key) || here.has(bare(key)));
        rows.push({ key: keys[0], name: person.name, here: present, away: false, followed: true, due: false, status: present ? 'Here' : 'Not here', doing: cutPoints(person.status ?? person.role ?? '', 160), step: '', newsAgo: '', back: '' });
    }
    const told = awayTail(slice, { now, calendar });
    return { people: rows, elsewhere: rows.filter(row => !row.here).length, hasPeople: rows.some(row => !row.here), tokens: told.tokens, left: told.left };
}
