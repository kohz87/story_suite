// The game pack's Calendar (views/route.js EDITORS: calendar; mock MK-7 "calendar"): whether it fits the open world, the year (era, leap years,
// the days of the week), and the months, seasons and holidays as row tables (form/table.js). A month's name, place and removal carry through to
// the seasons and holidays that name it, in the same undo step; removing a month they name, or the last season, asks first. A season month that
// is not one of the calendar's months says so, with the near one to use instead.

import { h } from '../../ui/kit/dom.js';
import { CALENDAR_LIMITS, GAME_CALENDAR_LIMITS } from '../../packs/limits.js';
import { foldKey } from '../../core/text.js';
import { fieldRow } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { rowTable } from '../form/table.js';
import { renderSection } from '../views/records.js';
import { pairPacks } from '../pairing.js';

const BASE = ['content', 'calendar'];
const FITS = ['PAIR_START_DATE', 'PAIR_EVENT_DATE', 'PAIR_EVENT_SEASON', 'PAIR_BIRTHDAY'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => (Array.isArray(value) ? value : []);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const names = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] ?? '');

// A month as a season or holiday names it (its name in any case, or its number from 1) → its index, or -1.
const monthAt = (months, given) => (typeof given === 'string' ? months.findIndex(month => foldKey(month?.name) === foldKey(given))
    : Number.isInteger(given) && given >= 1 && given <= months.length ? given - 1 : -1);

// How far apart two words are (edits), for "Use October" on a misspelt month.
function distance(a, b) {
    let row = Array.from({ length: b.length + 1 }, (_, n) => n);
    for (let i = 1; i <= a.length; i++) {
        const next = [i];
        for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        row = next;
    }
    return row[b.length];
}
const nearMonth = (months, given) => months.map(month => String(month?.name ?? '')).find(name => name && distance(foldKey(name), foldKey(given)) <= 2) ?? null;

// The seasons and holidays after the months move: `map(oldIndex)` is the new index, or -1 for a month taken out. A month named by number gets its new
// number; one taken out leaves its season (a season left with no month goes too) and takes its holidays with it. → patches and what was taken out.
function carryRefs(cal, map) {
    const months = list(cal.months);
    const patches = [];
    const gone = { seasons: [], from: [], holidays: [] };
    const keep = given => { const at = monthAt(months, given); return at < 0 ? given : map(at) < 0 ? undefined : typeof given === 'number' ? map(at) + 1 : given; };
    if (Array.isArray(cal.seasons)) {
        const seasons = cal.seasons.map(season => {
            if (!isRecord(season) || !Array.isArray(season.months)) return season;
            const kept = season.months.map(keep).filter(given => given !== undefined);
            if (kept.length !== season.months.length) (kept.length ? gone.from : gone.seasons).push(String(season.name ?? 'a season'));
            return kept.length ? { ...season, months: kept } : null;
        }).filter(season => season !== null);
        if (JSON.stringify(seasons) !== JSON.stringify(cal.seasons)) patches.push(seasons.length ? { op: 'set', path: [...BASE, 'seasons'], value: seasons } : { op: 'remove', path: [...BASE, 'seasons'] });
    }
    if (Array.isArray(cal.holidays)) {
        const holidays = cal.holidays.map(day => {
            if (!isRecord(day)) return day;
            const month = keep(day.month);
            if (month === undefined) { gone.holidays.push(String(day.name ?? 'a holiday')); return null; }
            return month === day.month ? day : { ...day, month };
        }).filter(day => day !== null);
        if (JSON.stringify(holidays) !== JSON.stringify(cal.holidays)) patches.push(holidays.length ? { op: 'set', path: [...BASE, 'holidays'], value: holidays } : { op: 'remove', path: [...BASE, 'holidays'] });
    }
    return { patches, gone };
}

// Whether the calendar fits the open world: the game's own pairing check, kept until either pack changes.
function fitCard(cal, ctx, game, state) {
    const world = ctx.other;
    if (!isRecord(world) || world.kind !== 'world') return null;
    if (state.fit?.world !== world || state.fit?.game !== game) state.fit = { world, game, result: pairPacks(JSON.stringify(world), JSON.stringify(game)) };
    const result = state.fit.result;
    const title = String(world.name ?? world.id ?? 'The open world');
    const date = world.content?.start?.date;
    const month = isRecord(date) ? list(cal.months)[date.month - 1]?.name : null;
    const when = isRecord(date) ? `${title} starts on day ${date.day} of month ${date.month}${month ? `, ${month}` : ''}, ${[date.year, date.era ?? cal.era].filter(item => item !== undefined && item !== '').join(' ')}.` : `${title} has no start date.`;
    const misfits = [...result.errors, ...result.warnings].filter(entry => FITS.includes(entry.code));
    const [head, sub] = result.blocked?.length ? [`Not checked against ${title} yet`, result.blocked.map(item => item.message).join(' ')]
        : misfits.length ? [`! ${plural(misfits.length, 'thing')} in ${title} ${misfits.length === 1 ? 'does' : 'do'} not fit this calendar`, `${when} ${misfits[0].message}`]
            : ['✓ Fits the open world.', `${when} Its dated and seasonal events find their months and seasons here.`];
    return h('section', { class: 'sgrp st-fit', dataset: { fit: result.blocked?.length ? 'waiting' : misfits.length ? 'no' : 'yes' } },
        h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('b', head), h('small', sub)),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'lnk st-pairing', onClick: () => ctx.go?.('pairing') }, 'Pairing ›'))));
}

/** `section`: `{ key: 'calendar', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the calendar's groups. */
export function editSection(section, ctx) {
    const cal = section.value;
    if (section.key !== 'calendar' || ctx.legacy || typeof ctx.commit !== 'function' || !isRecord(cal) || !Array.isArray(cal.months)) return [renderSection(section, ctx)];
    const game = ctx.doc?.doc ?? ctx.doc;
    const months = cal.months;
    const state = ctx.keep?.('calendar') ?? {};
    const note = h('p', { class: 'st-problem', role: 'status', hidden: !state.note }, state.note ?? '');
    const tell = text => { state.note = text ?? ''; note.textContent = state.note; note.hidden = !text; };
    const commit = (patches, said = '') => {
        if (!patches.length) return null;
        state.note = said;
        const result = ctx.commit(patches);
        tell(result?.ok ? said : result?.refusal ?? 'The change was not made.');
        return result;
    };
    const problems = ctx.problems ?? [];
    const under = path => problems.filter(problem => problem.path === `content.calendar.${path}` || String(problem.path).startsWith(`content.calendar.${path}.`) || String(problem.path).startsWith(`content.calendar.${path}[`));
    const said = path => under(path).map(problem => problem.message).join(' ');
    const rowSaid = (table, at) => said(`${table}[${at}]`) || null;
    // A top-level field: blank (false, an empty list) takes it out.
    const put = (key, value) => {
        const gone = value === '' || value === false || value === null || (Array.isArray(value) && !value.length);
        if (gone) return Object.hasOwn(cal, key) ? commit([{ op: 'remove', path: [...BASE, key] }]) : null;
        return JSON.stringify(cal[key]) === JSON.stringify(value) ? null : commit([{ op: 'set', path: [...BASE, key], value }]);
    };

    const year = h('section', { class: 'sgrp st-cyear' }, h('div', { class: 'gt' }, 'The year'),
        fieldRow({ type: 'text', key: 'era', label: 'Era', hint: 'Written after the year, like "611 CY". A world that names its own era wins; the reader\'s setting wins over both', value: cal.era ?? '', problem: said('era') },
            (key, value) => put('era', String(value ?? '').trim())),
        fieldRow({ type: 'toggle', key: 'leapYears', label: 'Leap years', hint: 'The second month gets one more day in leap years (the Gregorian rule)', value: cal.leapYears === true, problem: said('leapYears') },
            (key, value) => put('leapYears', value === true)),
        chipList({ key: 'week', label: 'Days of the week', hint: `In order, 1 to ${GAME_CALENDAR_LIMITS.week} names. None: days have no names`, values: list(cal.week).map(String), placeholder: 'Add a day name' },
            (key, values) => (values.length > GAME_CALENDAR_LIMITS.week ? tell(`A week has at most ${GAME_CALENDAR_LIMITS.week} days.`) : put('week', values))));

    // Months. A rename, move or removal carries through to the seasons and holidays (removal asks first when they name the month).
    const seasonOf = new Map();
    list(cal.seasons).forEach(season => list(season?.months).forEach(given => { const at = monthAt(months, given); if (at >= 0 && !seasonOf.has(at)) seasonOf.set(at, String(season.name ?? '')); }));
    const days = months.reduce((sum, month) => sum + (Number.isInteger(month?.days) ? month.days : 0), 0);
    const removeMonth = at => {
        const { patches, gone } = carryRefs(cal, index => (index === at ? -1 : index > at ? index - 1 : index));
        const name = String(months[at]?.name ?? `month ${at + 1}`);
        const taken = [gone.from.length ? `taken out of ${names(gone.from)}` : '', gone.seasons.length ? `${names(gone.seasons)} went with it` : '', gone.holidays.length ? `the holiday${gone.holidays.length === 1 ? '' : 's'} ${names(gone.holidays)} too` : ''].filter(Boolean);
        state.confirm = null;
        commit([{ op: 'remove', path: [...BASE, 'months', at] }, ...patches], `Removed ${name}${taken.length ? `: ${taken.join('; ')}` : ''}.`);
    };
    const monthOn = {
        change: (at, col, value) => {
            const month = months[at] ?? {};
            if (col === 'days') return value === null ? tell('A month needs its days.') : value === month.days ? null : commit([{ op: 'set', path: [...BASE, 'months', at, 'days'], value }]);
            const name = String(value ?? '').trim();
            if (!name) return tell('A month needs a name.');
            if (name === month.name) return null;
            const rename = given => (typeof given === 'string' && foldKey(given) === foldKey(month.name) ? name : given);
            const patches = [{ op: 'set', path: [...BASE, 'months', at, 'name'], value: name }];
            if (Array.isArray(cal.seasons) && cal.seasons.some(season => list(season?.months).some(given => rename(given) !== given))) {
                patches.push({ op: 'set', path: [...BASE, 'seasons'], value: cal.seasons.map(season => (isRecord(season) && Array.isArray(season.months) ? { ...season, months: season.months.map(rename) } : season)) });
            }
            if (Array.isArray(cal.holidays) && cal.holidays.some(day => rename(day?.month) !== day?.month)) {
                patches.push({ op: 'set', path: [...BASE, 'holidays'], value: cal.holidays.map(day => (isRecord(day) ? { ...day, month: rename(day.month) } : day)) });
            }
            return commit(patches, patches.length > 1 ? `Renamed ${month.name ?? 'the month'} to ${name} in its season and holidays too.` : '');
        },
        add: () => commit([{ op: 'insert', path: [...BASE, 'months', months.length], value: { name: `Month ${months.length + 1}`, days: 30 } }]),
        move: (at, step) => {
            const to = at + step;
            if (to < 0 || to >= months.length) return null;
            const { patches } = carryRefs(cal, index => (index === at ? to : index === to ? at : index));
            return commit([{ op: 'move', path: [...BASE, 'months', at], to }, ...patches]);
        },
        remove: at => {
            if (months.length === 1) return tell('A calendar needs at least one month.');
            const named = seasonOf.has(at) || list(cal.holidays).some(day => monthAt(months, day?.month) === at);
            if (!named) return removeMonth(at);
            state.confirm = { month: at };
            tell('');
            return ctx.go?.('calendar');
        },
    };
    const monthTable = rowTable({ key: 'months', title: 'Months', noun: 'month', max: CALENDAR_LIMITS.months, addLabel: '+ Add a month', note: said('months') && !under('months').some(p => /\[\d+\]/.test(p.path)) ? `✕ ${said('months')}` : null,
        foot: `${months.length} of ${CALENDAR_LIMITS.months} months · ${days} days a year`,
        columns: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'days', label: 'Days', type: 'number', min: 1, max: CALENDAR_LIMITS.days, width: 'minmax(88px, 110px)' },
            { key: 'season', label: 'Season', type: 'tag', placeholder: '—', phone: false }],
        rows: months.map((month, at) => ({ values: { name: month?.name ?? '', days: month?.days ?? null, season: seasonOf.get(at) ?? '' }, problem: rowSaid('months', at) })) }, monthOn);

    // Removing a month a season or holiday names asks first.
    let confirm = null;
    if (Number.isInteger(state.confirm?.month) && months[state.confirm.month]) {
        const at = state.confirm.month;
        const name = String(months[at].name ?? `month ${at + 1}`);
        const inSeason = seasonOf.get(at);
        const days2 = list(cal.holidays).filter(day => monthAt(months, day?.month) === at).map(day => String(day.name ?? 'a holiday'));
        const start = ctx.other?.content?.start?.date;
        const parts = [inSeason ? `${inSeason[0].toUpperCase()}${inSeason.slice(1)} names it, so it is taken out of ${inSeason} too.` : '', days2.length ? `The holiday${days2.length === 1 ? '' : 's'} ${names(days2)} go${days2.length === 1 ? 'es' : ''} with it.` : '',
            isRecord(start) && start.month >= months.length ? `${ctx.other.name ?? 'The open world'} starts in month ${start.month}: Pairing will say so if the calendar is shorter.` : ''];
        confirm = h('div', { class: 'cfm rec st-cconfirm', role: 'group', 'aria-label': `Remove ${name}?` }, h('b', `Remove ${name}?`), h('small', parts.filter(Boolean).join(' ')),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng st-cremove', onClick: () => removeMonth(at) }, 'Remove'),
                h('button', { type: 'button', class: 'btn2 st-ckeep', onClick: () => { state.confirm = null; tell(''); ctx.go?.('calendar'); } }, 'Keep it')));
    }

    // Seasons: a month is typed as the calendar spells it, and sits in one season only.
    const seasons = list(cal.seasons);
    const placed = new Set(seasonOf.keys());
    const unplaced = months.map((month, at) => (placed.has(at) ? null : String(month?.name ?? ''))).filter(Boolean);
    const removeSeason = at => commit([seasons.length === 1 ? { op: 'remove', path: [...BASE, 'seasons'] } : { op: 'remove', path: [...BASE, 'seasons', at] }], seasons.length === 1 ? 'The calendar has no seasons now.' : '');
    const seasonOn = {
        change: (at, col, value) => {
            const season = seasons[at] ?? {};
            if (col === 'name') { const name = String(value ?? '').trim(); return !name ? tell('A season needs a name.') : name === season.name ? null : commit([{ op: 'set', path: [...BASE, 'seasons', at, 'name'], value: name }]); }
            const wanted = list(value);
            const old = list(season.months);
            const added = wanted.filter(given => !old.includes(given));
            const out = [];
            for (const given of wanted) {
                if (!added.includes(given)) { out.push(given); continue; }
                const index = monthAt(months, given);
                if (index < 0) { const near = nearMonth(months, given); return tell(`"${given}" is not one of the calendar's months.${near ? ` Did you mean ${near}?` : ''}`); }
                const other = seasons.findIndex((item, n) => n !== at && list(item?.months).some(each => monthAt(months, each) === index));
                if (other >= 0) return tell(`${months[index].name} is in ${seasons[other].name ?? 'another season'}: take it out there first.`);
                out.push(months[index].name);
            }
            if (!out.length) return tell('A season needs at least one month; remove the season instead.');
            return commit([{ op: 'set', path: [...BASE, 'seasons', at, 'months'], value: out }]);
        },
        add: () => commit([Array.isArray(cal.seasons) ? { op: 'insert', path: [...BASE, 'seasons', seasons.length], value: { name: `season ${seasons.length + 1}`, months: unplaced.slice(0, 1) } }
            : { op: 'set', path: [...BASE, 'seasons'], value: [{ name: 'season 1', months: unplaced.slice(0, 1) }] }]),
        move: (at, step) => (at + step < 0 || at + step >= seasons.length ? null : commit([{ op: 'move', path: [...BASE, 'seasons', at], to: at + step }])),
        remove: at => { if (seasons.length !== 1) return removeSeason(at); state.confirm = { season: at }; tell(''); return ctx.go?.('calendar'); },
    };
    // A season month that is not one of the calendar's months: said on its row, with the near month to use.
    const seasonProblem = at => {
        const bad = list(seasons[at]?.months).find(given => monthAt(months, given) < 0);
        if (bad === undefined) return rowSaid('seasons', at);
        const near = typeof bad === 'string' ? nearMonth(months, bad) : null;
        return { text: `${JSON.stringify(bad)} is not one of the calendar's months.`, fix: near ? { label: `Use ${near}`, run: () => commit([{ op: 'set', path: [...BASE, 'seasons', at, 'months'], value: seasons[at].months.map(given => (given === bad ? near : given)) }]) } : null };
    };
    const seasonTable = rowTable({ key: 'seasons', title: 'Seasons', noun: 'season', max: GAME_CALENDAR_LIMITS.seasons, addLabel: '+ Add a season',
        empty: 'No seasons: the weather uses spring, summer, autumn and winter.', note: under('seasons').some(p => p.path === 'content.calendar.seasons') ? `✕ ${under('seasons').find(p => p.path === 'content.calendar.seasons').message}` : null,
        foot: seasons.length ? `${seasons.length} of ${GAME_CALENDAR_LIMITS.seasons} seasons · ${unplaced.length ? `${plural(unplaced.length, 'month')} in no season: ${names(unplaced.slice(0, 4))}${unplaced.length > 4 ? '…' : ''}` : 'every month is in one'}` : `0 of ${GAME_CALENDAR_LIMITS.seasons}`,
        columns: [{ key: 'name', label: 'Name', type: 'text', width: 'minmax(0, 1fr)' }, { key: 'months', label: 'Months (each in one season)', type: 'chips', placeholder: 'Add a month' }],
        rows: seasons.map((season, at) => ({ values: { name: season?.name ?? '', months: list(season?.months).map(String) }, problem: seasonProblem(at) })) }, seasonOn);
    const lastSeason = Number.isInteger(state.confirm?.season) && seasons.length === 1
        ? h('div', { class: 'cfm rec st-cconfirm', role: 'group', 'aria-label': 'Remove the last season?' }, h('b', 'Remove the last season?'),
            h('small', 'The calendar then has no seasons, and the weather uses spring, summer, autumn and winter. Weather cells that name this calendar\'s seasons stay, and are read while the built-in seasons have those names.'),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng st-cremove', onClick: () => { state.confirm = null; removeSeason(0); } }, 'Remove'),
                h('button', { type: 'button', class: 'btn2 st-ckeep', onClick: () => { state.confirm = null; tell(''); ctx.go?.('calendar'); } }, 'Keep it'))) : null;

    // Holidays: a named day that comes back every year.
    const holidays = list(cal.holidays);
    const monthNames = months.map(month => String(month?.name ?? ''));
    const holidayOn = {
        change: (at, col, value) => {
            const day = holidays[at] ?? {};
            const next = col === 'name' ? String(value ?? '').trim() : value;
            if (col === 'name' && !next) return tell('A holiday needs a name.');
            if (col === 'day' && next === null) return tell('A holiday needs its day.');
            return next === day[col] ? null : commit([{ op: 'set', path: [...BASE, 'holidays', at, col], value: next }]);
        },
        add: () => commit([Array.isArray(cal.holidays) ? { op: 'insert', path: [...BASE, 'holidays', holidays.length], value: { name: 'New holiday', month: monthNames[0], day: 1 } }
            : { op: 'set', path: [...BASE, 'holidays'], value: [{ name: 'New holiday', month: monthNames[0], day: 1 }] }]),
        move: (at, step) => (at + step < 0 || at + step >= holidays.length ? null : commit([{ op: 'move', path: [...BASE, 'holidays', at], to: at + step }])),
        remove: at => commit([holidays.length === 1 ? { op: 'remove', path: [...BASE, 'holidays'] } : { op: 'remove', path: [...BASE, 'holidays', at] }]),
    };
    const holidayTable = rowTable({ key: 'holidays', title: 'Holidays', noun: 'holiday', max: CALENDAR_LIMITS.holidays, addLabel: '+ Add a holiday', empty: 'No holidays. A holiday is a named day that comes back every year.',
        columns: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'month', label: 'Month', type: 'select', options: monthNames }, { key: 'day', label: 'Day', type: 'number', min: 1, width: 'minmax(88px, 110px)' }],
        rows: holidays.map((day, at) => ({ values: { name: day?.name ?? '', month: monthNames[monthAt(months, day?.month)] ?? (day?.month === undefined ? '' : String(day.month)), day: day?.day ?? null }, problem: rowSaid('holidays', at) })) }, holidayOn);

    return [fitCard(cal, ctx, game, state), note, year, confirm, monthTable, lastSeason, seasonTable, holidayTable].filter(Boolean);
}
