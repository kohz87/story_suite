// The game Weather editor (views/route.js EDITORS: weather; mock MK-7 "weather"): the style (by climate, own tables, narrator) and the climate × season
// grid of `content.weather.tables`. A cell is the table for one climate and one season of the calendar (or the four built-in seasons when it has none);
// "Any season" covers every season of a climate that has no cell of its own, and the "Any climate" row is read only with the "Own tables" style, as the
// game reads them (modules/time climateWeather). The open cell's lines are a row table; a cell with no lines of its own shows the built-in ones and can
// copy them. A table for a season the calendar lacks gets a column of its own with a warning, and two tables for one cell are named, the second removable.

import { h } from '../../ui/kit/dom.js';
import { segmented } from '../../ui/kit/controls.js';
import { CLIMATES, GAME_WEATHER_LIMITS } from '../../packs/limits.js';
import { CLIMATE_TABLES, TEMPERATE } from '../../modules/time/weather.js';
import { gridTable, rowTable } from '../form/table.js';
import { openPicker } from '../form/pick.js';
import { renderSection } from '../views/records.js';
import { jsonRow } from '../views/json-row.js';

const BASE = ['content', 'weather'];
const ANY = '*';
const FOUR = ['spring', 'summer', 'autumn', 'winter'];
const STYLES = [['climate', 'By climate'], ['tables', 'Own tables'], ['story', 'Narrator']];
const L = GAME_WEATHER_LIMITS;
const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fold = text => String(text ?? '').trim().toLowerCase();
const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const contentOf = doc => (isObj(doc?.content) ? doc.content : isObj(doc?.doc?.content) ? doc.doc.content : {});

/** The calendar's season names, or the four built-in ones when it has none. */
function seasonsOf(content) {
    const own = Array.isArray(content.calendar?.seasons) ? content.calendar.seasons.map(season => season?.name).filter(name => typeof name === 'string' && name.trim()) : [];
    return own.length ? own : FOUR;
}

// Where a table sits in the grid: its row (a climate, ANY, or null for a climate the game does not know) and its column (a season, ANY, or "?<season>").
function placeOf(table, seasons) {
    const row = table?.climate === undefined ? ANY : CLIMATES.includes(table.climate) ? table.climate : null;
    if (table?.season === undefined) return { row, col: ANY };
    const found = seasons.find(name => fold(name) === fold(table.season));
    return { row, col: found ?? `?${table.season}` };
}

/** The built-in lines for a climate and a season name (a season the built-ins lack: the climate's lines for the whole year). */
function builtInLines(climate, season) {
    const key = FOUR.includes(fold(season)) ? fold(season) : null;
    if (climate === 'underground') return [...CLIMATE_TABLES.underground];
    const table = CLIMATE_TABLES[climate] ?? TEMPERATE;
    return (key ? [...table[key]] : FOUR.flatMap(name => table[name])).slice(0, L.kinds);
}

// The open world's regions by climate (a region with none is temperate): { <climate>: { count, none, first } }.
function regionsByClimate(world) {
    const out = {};
    for (const region of Array.isArray(contentOf(world).regions) ? contentOf(world).regions : []) {
        const climate = CLIMATES.includes(region?.climate) ? region.climate : 'temperate';
        const entry = (out[climate] ??= { count: 0, none: 0, first: region?.name ?? region?.id });
        entry.count += 1;
        if (region?.climate === undefined) entry.none += 1;
    }
    return out;
}

/**
 * The weather section. `section`: { key: 'weather', where, value, count }; `ctx`: the editor context (views/route.js). The open cell and the phone's
 * column live in ctx.keep('weather'), so they outlive the redraw after a change.
 */
export function editSection(section, ctx) {
    if (ctx.legacy || typeof ctx.commit !== 'function' || ctx.kind !== 'game') return [renderSection(section, ctx)];
    const note = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const commit = patches => {
        const result = ctx.commit(patches);
        note.textContent = result?.ok ? '' : result?.refusal ?? 'The change was not made.';
        note.hidden = Boolean(result?.ok);
        return result;
    };
    if (section.value === undefined) {
        return [h('section', { class: 'sgrp st-wnone' }, h('div', { class: 'gt' }, 'Weather'),
            h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', 'Not set: the built-in game\'s'), h('small', 'By climate, with the built-in lines for every climate and season.')),
                h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 pri st-wset', onClick: () => commit([{ op: 'set', path: BASE, value: { style: 'climate' } }]) }, 'Set it here'))), note)];
    }
    if (!isObj(section.value)) return [renderSection(section, ctx)];
    const root = h('div', { class: 'st-sec st-weather', dataset: { key: 'weather' } });
    const state = ctx.keep?.('weather') ?? {};
    const draw = () => root.replaceChildren(...page(section.value, ctx, state, commit, draw), note);
    draw();
    return [root];
}

function page(weather, ctx, state, commit, draw) {
    const content = contentOf(ctx.doc);
    const seasons = seasonsOf(content);
    const tables = Array.isArray(weather.tables) ? weather.tables : [];
    const style = weather.style ?? 'climate';
    const placed = tables.map((table, at) => ({ table, at, ...placeOf(table, seasons) }));
    const extra = [...new Set(placed.map(item => item.col).filter(col => col.startsWith('?')))];
    if (state.open?.col?.startsWith('?') && !extra.includes(state.open.col)) state.open = null;
    const cols = [...seasons.map(name => ({ key: name, label: name })), { key: ANY, label: 'any season' }, ...extra.map(key => ({ key, label: key.slice(1), warn: true }))];
    const at = (row, col) => placed.filter(item => item.row === row && item.col === col);
    const world = ctx.other ? regionsByClimate(ctx.other) : null;
    const rows = [...CLIMATES.map(climate => {
        const found = world?.[climate];
        return { key: climate, label: cap(climate), sub: world ? (found ? [plural(found.count, 'region'), found.none ? `${found.none} with none` : null].filter(Boolean).join(' · ') : 'no regions') : '' };
    }), { key: ANY, label: 'Any climate', sub: 'Read only with "Own tables"', muted: style !== 'tables' }];
    const cell = (row, col) => {
        const own = at(row, col);
        if (own.length) return { text: `Own · ${own[0].table.weather?.length ?? 0}${own.length > 1 ? ` · ${own.length} tables` : ''}`, state: 'own', warn: own.length > 1 || col.startsWith('?') };
        if (row === ANY || col === ANY || col.startsWith('?')) return { text: '—', state: 'none' };
        const any = at(row, ANY)[0];
        if (any) return { text: `Any season · ${any.table.weather?.length ?? 0}`, state: 'built' };
        return { text: row === 'underground' ? 'Built-in · all year' : 'Built-in', state: 'built' };
    };
    const ownCells = new Set(placed.filter(item => item.row !== null).map(item => `${item.row}|${item.col}`)).size;
    const styleRow = h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'How'),
        h('div', { class: 'srow', dataset: { key: 'style' } },
            h('span', { class: 'lb' }, h('b', 'Style'), h('small', 'By climate: the place\'s climate and the season pick the lines; this pack\'s cells win over the built-in ones. Own tables: also the "Any climate" row. Narrator: no tables, the story says the weather')),
            h('span', { class: 'ctl' }, segmented({ items: STYLES, value: style, label: 'Weather style', className: 'sseg2 st-wstyle', onChange: value => commit([{ op: 'set', path: [...BASE, 'style'], value }]) }))),
        style === 'story' && tables.length ? h('p', { class: 'fine st-wstory' }, 'The narrator says the weather, so these tables are kept but not read.') : null);
    const grid = gridTable({ key: 'weather', title: `Climate × season · ${plural(ownCells, 'own cell')}`, corner: 'Climate', columns: cols, rows, cell, open: state.open, column: state.column,
        legend: [{ state: 'own', text: 'Own: this pack\'s lines' }, { state: 'built', text: 'Built-in: the game\'s own lines for that climate' }, { state: 'none', text: '—: not set. Lines here cover every season of the climate that has no own cell' }] },
    { open: (row, col) => { state.open = { row, col }; draw(); }, column: col => { state.column = col; } });
    const strays = placed.filter(item => item.row === null);
    return [styleRow, grid, ...warnings(placed, cols, seasons, commit, state, draw),
        strays.length ? h('p', { class: 'fine st-problem' }, `${plural(strays.length, 'table names a climate', 'tables name climates')} the game does not know (${strays.map(item => `"${item.table.climate}"`).join(', ')}); fix ${strays.length === 1 ? 'it' : 'them'} in the JSON below.`) : null,
        state.open ? openCell(state.open, placed, tables, world, state, commit) : null,
        jsonRow({ value: weather, steps: BASE, noun: 'weather section', problems: ctx.problems ?? [], state: ctx.keep?.('json:weather') ?? {} }, patches => commit(patches))].filter(Boolean);
}

// A table for a season the calendar lacks, and two tables for one cell: each named, with its fix.
function warnings(placed, cols, seasons, commit, state, draw) {
    const out = [];
    const label = item => `${item.row === ANY ? 'Any climate' : cap(item.row)} · ${item.col === ANY ? 'any season' : item.col.replace(/^\?/, '')}`;
    for (const item of placed.filter(entry => entry.row !== null && entry.col.startsWith('?'))) {
        out.push(warnRow(`${label(item)}`, `"${item.col.slice(1)}" is not a season of this calendar, so this table is never read.`,
            [['Move it to a season ›', () => openPicker({}, { title: 'Move it to a season', items: [...seasons.map(name => ({ id: name, label: name })), { id: ANY, label: 'Any season', sub: 'every season with no cell of its own' }] },
                season => commit([season === ANY ? { op: 'remove', path: [...BASE, 'tables', item.at, 'season'] } : { op: 'set', path: [...BASE, 'tables', item.at, 'season'], value: season }]))]]));
    }
    const seen = new Map();
    for (const item of placed.filter(entry => entry.row !== null)) {
        const key = `${item.row}|${item.col}`;
        if (!seen.has(key)) { seen.set(key, item); continue; }
        const first = seen.get(key);
        out.push(warnRow(`${label(item)} has two tables`, `Only the first is read: ${plural(first.table.weather?.length ?? 0, 'line')}. The second has ${item.table.weather?.length ?? 0}.`,
            [['Show the second ›', () => { state.open = { row: item.row, col: item.col, at: item.at }; draw(); }], ['Remove it', () => removeTable(item.at, placed.length, commit, state)]]));
    }
    return out.length ? [h('section', { class: 'sgrp st-wwarn' }, ...out)] : [];
}

function warnRow(title, text, fixes) {
    return h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', `! ${title}`), h('small', text)),
        h('span', { class: 'ctl' }, ...fixes.map(([name, run]) => h('button', { type: 'button', class: 'lnk st-wfix', onClick: run }, name))));
}

function removeTable(index, count, commit, state) {
    if (commit([count === 1 ? { op: 'remove', path: [...BASE, 'tables'] } : { op: 'remove', path: [...BASE, 'tables', index] }])?.ok && state.open?.at === index) state.open = { ...state.open, at: undefined };
}

// The open cell: its own lines as a row table, or the built-in lines it reads now with a way to write own ones.
function openCell(open, placed, tables, world, state, commit) {
    const climate = open.row === ANY ? null : open.row;
    const season = open.col === ANY ? null : open.col.replace(/^\?/, '');
    const title = `${climate ? cap(climate) : 'Any climate'} · ${season ?? 'any season'}`;
    const here = placed.filter(item => item.row === open.row && item.col === open.col);
    const mine = here.find(item => item.at === open.at) ?? here[0];
    const found = climate && world?.[climate];
    const about = ['One line is drawn each day.', found ? `${plural(found.count, 'region')} of the open world ${found.count === 1 ? 'is' : 'are'} ${climate}${found.first ? `, ${found.first} among them` : ''}.` : null].filter(Boolean).join(' ');
    const builtIn = builtInLines(climate ?? 'temperate', season ?? '');
    const head = [h('div', { class: 'gt' }, here.length > 1 && mine !== here[0] ? 'The open cell · its second table' : 'The open cell'),
        h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', title), h('small', about)))];
    const write = lines => {
        const value = { ...(climate ? { climate } : {}), ...(season ? { season } : {}), weather: lines };
        if (commit([tables.length ? { op: 'insert', path: [...BASE, 'tables', tables.length], value } : { op: 'set', path: [...BASE, 'tables'], value: [value] }])?.ok) state.open = { ...open, at: tables.length };
    };
    if (!mine) {
        const reads = !climate || !season ? 'Nothing is written for this cell.' : season && !FOUR.includes(fold(season)) && climate !== 'underground' ? `It reads the built-in ${climate} lines for the time of year.` : `It reads the built-in ${climate} lines:`;
        return h('section', { class: 'sgrp st-wcell', dataset: { open: `${open.row}|${open.col}` } }, ...head,
            h('p', { class: 'fine' }, reads),
            climate && season ? h('ul', { class: 'st-wbuilt' }, ...builtIn.map(line => h('li', line))) : null,
            h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-wown', onClick: () => write(climate ? builtIn : builtInLines('temperate', season ?? '')) }, 'Write own lines'),
                h('small', { class: 'fine' }, ' Starts from the built-in lines; change them as you like.')));
    }
    const lines = Array.isArray(mine.table.weather) ? mine.table.weather : [];
    const path = [...BASE, 'tables', mine.at, 'weather'];
    const table = rowTable({ key: 'weather-lines', noun: 'line', columns: [{ key: 'text', label: 'Line', type: 'text', max: L.text, placeholder: 'A short weather line…' }], max: L.kinds, addLabel: '+ Add a line',
        rows: lines.map(text => ({ values: { text }, problem: typeof text !== 'string' || !text.trim() ? 'A line can\'t be empty.' : text.length > L.text ? `At most ${L.text} characters.` : null })),
        foot: `${lines.length} of ${L.kinds} lines · at most ${L.text} characters each`, focus: Number.isInteger(state.fresh) ? { row: state.fresh, col: 'text' } : null }, {
        change: (index, col, value) => {
            const text = String(value).trim();
            if (!text) return lines.length === 1 ? removeTable(mine.at, tables.length, commit, state) : commit([{ op: 'remove', path: [...path, index] }]);
            return commit([{ op: 'set', path: [...path, index], value: text }]);
        },
        add: () => { if (commit([{ op: 'insert', path: [...path, lines.length], value: '' }])?.ok) state.fresh = lines.length; },
        move: (index, step) => commit([{ op: 'move', path: [...path, index], to: index + step }]),
        remove: index => (lines.length === 1 ? removeTable(mine.at, tables.length, commit, state) : commit([{ op: 'remove', path: [...path, index] }])),
    });
    state.fresh = undefined;
    const reset = climate ? h('button', { type: 'button', class: 'btn2 st-wbuiltin', onClick: () => commit([{ op: 'set', path, value: builtIn }]) }, 'Use the built-in lines') : null;
    if (reset) table.querySelector('.st-tcount')?.before(reset);
    // the cell's heading sits in the same card as its lines (mock MK-7)
    table.querySelector('.st-thead, .st-tempty')?.before(...head);
    table.classList.add('st-wcell');
    table.dataset.open = `${open.row}|${open.col}`;
    return table;
}
