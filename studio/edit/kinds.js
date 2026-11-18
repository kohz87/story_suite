// The job: the kind maps and markets of a world pack (views/route.js EDITORS: placeKinds, routeKinds, markets). A kind map is a table of
// the pack's own words for places or routes, each with the engine class it counts as (PLACE_CLASSES, ROUTE_CLASSES) and how many records
// use it; a rename carries those records along (and, for a place kind, the `where.kinds` of templates and world events), and a kind in use
// cannot be removed unless it is a class itself. Markets are one card per settlement type (buy, sell, stock) or environment tag (prices per
// goods category), with the places that name it and the JSON row.

import { h } from '../../ui/kit/dom.js';
import { MARKET_LIMITS, MARKET_WORD, PLACE_CLASSES, ROUTE_CLASSES, WORLD_LIMITS } from '../../packs/limits.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { jsonRow, oddRecordCard } from '../views/json-row.js';
import { renderSection } from '../views/records.js';

const PART = 'map';
const MAPS = {
    placeKinds: { title: 'Place kinds', classes: PLACE_CLASSES, users: 'places', noun: 'place', hint: 'Your words for places, and the engine class each counts as' },
    routeKinds: { title: 'Route kinds', classes: ROUTE_CLASSES, users: 'routes', noun: 'route', hint: 'Your words for routes, and the engine class each counts as' },
};
const SIBLINGS = [['placeKinds', {}, 'place kinds'], ['routeKinds', {}, 'route kinds'], ['markets', [], 'markets']];
const { factorMin: LO, factorMax: HI } = MARKET_LIMITS;
const PRICE = /^(\S+)\s+×?\s*(\d+(?:\.\d+)?)$/;
const STOCK = /^(\d+)(?:\s*(?:-|–|to)\s*(\d+))?$/;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const contentOf = ctx => ctx.doc?.doc?.content ?? ctx.doc?.content ?? {};
const recordsOf = (content, key) => (Array.isArray(content[key]) ? content[key] : []).map((record, at) => ({ record, at })).filter(({ record }) => isObject(record));
const labelOf = ({ record, at }) => String(record.name ?? record.id ?? (record.from && record.to ? `${record.from} – ${record.to}` : `#${at + 1}`));
const free = (taken, base) => { let word = base; for (let n = 2; taken.has(word); n++) word = `${base}-${n}`; return word; };
const said = result => (result?.ok ? '' : result?.refusal ?? 'The change was not made.');

// The records of `key` whose `field` names `word` (a string field, or a word in a list field).
const usersOf = (content, key, field, word) => recordsOf(content, key).filter(({ record }) => (Array.isArray(record[field]) ? record[field].includes(word) : record[field] === word));

// The templates and world events whose `where.kinds` names a place kind `word`: [{ path, kinds }].
const wheresOf = (content, word) => ['templates', 'worldEvents'].flatMap(key => recordsOf(content, key)
    .filter(({ record }) => isObject(record.where) && Array.isArray(record.where.kinds) && record.where.kinds.includes(word))
    .map(({ record, at }) => ({ path: ['content', key, at, 'where', 'kinds'], kinds: record.where.kinds })));

// Chips that open each user's record (places only: routes have no record page of their own yet).
function userChips(users, key) {
    const shown = users.slice(0, 12).map(user => (key === 'places'
        ? h('button', { type: 'button', class: 'kc st-used', dataset: { rec: `places.${user.at}` }, onClick: () => user.go(PART, `places.${user.at}`) }, labelOf(user))
        : h('span', { class: 'kc' }, labelOf(user))));
    if (users.length > shown.length) shown.push(h('small', { class: 'none' }, `and ${users.length - shown.length} more`));
    return shown;
}

function kindRow(key, word, map, ctx, content) {
    const spec = MAPS[key];
    const steps = ['content', key];
    const users = usersOf(content, spec.users, 'kind', word).map(user => ({ ...user, go: ctx.go }));
    const wheres = key === 'placeKinds' ? wheresOf(content, word) : [];
    const cls = map[word];
    const options = spec.classes.includes(cls) ? spec.classes : [String(cls), ...spec.classes];
    const name = h('input', { type: 'text', class: 'txt2 st-kword', 'aria-label': `Kind "${word}"` });
    name.value = word;
    const pick = h('select', { class: 'sel2 st-kclass', 'aria-label': `Engine class of "${word}"` }, options.map(option => h('option', { value: option, selected: option === cls }, option)));
    const row = h('div', { class: 'srow st-kind', dataset: { kind: word } },
        h('span', { class: 'lb' }, name, h('small', users.length ? `${plural(users.length, spec.noun)} use it` : `No ${spec.noun} uses it`)),
        h('span', { class: 'ctl' }, pick,
            h('button', { type: 'button', class: 'btn2 dng st-remove', 'aria-label': `Remove ${word}`, onClick: () => drop() }, '×')));
    const tell = text => setProblem(row, text);
    const rename = () => {
        const to = name.value.trim();
        if (to === word) return;
        if (!to || to.length > 40) return tell('A kind is a word of 1 to 40 characters.');
        if (Object.hasOwn(map, to)) return tell(`"${to}" is already in this list.`);
        const next = Object.fromEntries(Object.entries(map).map(([k, v]) => [k === word ? to : k, v]));
        const named = wheres.map(({ path, kinds }) => ({ op: 'set', path, value: [...new Set(kinds.map(kind => (kind === word ? to : kind)))] }));
        tell(said(ctx.commit([{ op: 'set', path: steps, value: next }, ...users.map(user => ({ op: 'set', path: ['content', spec.users, user.at, 'kind'], value: to })), ...named])));
    };
    const drop = () => {
        if (users.length && !spec.classes.includes(word)) return tell(`${plural(users.length, spec.noun)} use it: give ${users.length === 1 ? 'it' : 'them'} another kind first.`);
        if (wheres.length && !spec.classes.includes(word)) return tell(`${wheres.length === 1 ? 'An event or template names' : `${wheres.length} events and templates name`} it in where.kinds: take it out of ${wheres.length === 1 ? 'that' : 'those'} first.`);
        tell(said(ctx.commit([{ op: 'remove', path: [...steps, word] }])));
    };
    name.addEventListener('change', rename);
    pick.addEventListener('change', () => tell(said(ctx.commit([{ op: 'set', path: [...steps, word], value: pick.value }]))));
    const problem = (ctx.problems ?? []).find(item => item.path === `content.${key}.${word}`);
    if (problem) tell(problem.message);
    if (ctx.focus?.path?.[0] === word) name.classList.add('st-at');
    return row;
}

function kindMapNodes(section, ctx) {
    const key = section.key;
    const spec = MAPS[key];
    const map = section.value;
    const content = contentOf(ctx);
    const words = Object.keys(map);
    // kinds the records use that are neither mapped nor a class: the checker refuses them, so offer each as a new row
    const loose = [...new Set(recordsOf(content, spec.users).map(({ record }) => record.kind).filter(kind => typeof kind === 'string' && kind && !Object.hasOwn(map, kind) && !spec.classes.includes(kind)))];
    const full = words.length >= WORLD_LIMITS.kinds;
    const add = word => ctx.commit([{ op: 'set', path: ['content', key, word], value: 'none' }]);
    const whole = (ctx.problems ?? []).find(item => item.path === `content.${key}`);
    return h('div', { class: 'st-sec', dataset: { key } },
        h('div', { class: 'secl2' }, `${spec.title} · ${words.length}`),
        h('section', { class: 'sgrp st-kinds' },
            h('div', { class: 'gt' }, spec.title, h('small', ` · ${spec.hint}`)),
            whole ? h('p', { class: 'st-problem', role: 'alert' }, whole.message) : null,
            words.length ? words.map(word => kindRow(key, word, map, ctx, content)) : h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('small', { class: 'none' }, 'No kinds yet.'))),
            h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('small', `Engine classes: ${spec.classes.join(', ')}. A class can also be used as a kind as it is.`))),
            loose.length ? h('div', { class: 'srow wide st-loose' }, h('span', { class: 'lb' }, h('b', 'Used but not mapped'), h('small', `${spec.users === 'places' ? 'Places' : 'Routes'} use these kinds; add each, then pick its class`)),
                h('span', { class: 'ctl' }, h('span', { class: 'chips3' }, loose.map(kind => h('button', { type: 'button', class: 'kc st-map', disabled: full, onClick: () => add(kind) }, `+ ${kind}`))))) : null,
            h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-add', disabled: full, onClick: () => add(free(new Set(words), 'new-kind')) },
                full ? `At most ${WORLD_LIMITS.kinds} kinds` : '+ Add a kind'))));
}

// --- markets ---------------------------------------------------------------------------------------------------------------------

const priceChips = prices => Object.entries(isObject(prices) ? prices : {}).map(([category, factor]) => `${category} ×${factor}`);
const badFactor = value => !(typeof value === 'number' && value >= LO && value <= HI);

function marketCard(record, index, ctx, on) {
    const isType = record.type !== undefined || record.tag === undefined;
    const field = isType ? 'type' : 'tag';
    const word = record[field];
    const steps = ['content', 'markets', index];
    const rec = `markets.${index}`;
    const content = contentOf(ctx);
    const mine = (ctx.problems ?? []).filter(item => String(item.path).startsWith(`content.markets[${index}]`));
    const problemFor = key => mine.find(item => item.path === `content.markets[${index}].${key}` || String(item.path).startsWith(`content.markets[${index}].${key}.`))?.message;
    const users = typeof word === 'string' ? usersOf(content, 'places', isType ? 'market' : 'tags', word).map(user => ({ ...user, go: ctx.go })) : [];
    const set = (key, value, row) => setProblem(row, said(ctx.commit([value === undefined ? { op: 'remove', path: [...steps, key] } : { op: 'set', path: [...steps, key], value }])));
    const rows = [];

    const nameRow = fieldRow({ type: 'text', key: field, label: isType ? 'Settlement type' : 'Environment tag', value: word, problem: problemFor(field),
        hint: isType ? 'A lowercase word like "village"; a place names it as its market' : 'A lowercase word like "coastal"; a place carries it in its tags' }, (key, value) => {
        const to = String(value).trim();
        if (to === word) return;
        if (!MARKET_WORD.test(to)) return setProblem(nameRow, 'Use a lowercase word like "village" or "coastal" (up to three "-" joins).');
        if (on.list.some((other, at) => at !== index && isObject(other) && other[field] === to)) return setProblem(nameRow, `"${to}" is already in this list.`);
        const follow = users.map(user => ({ op: 'set', path: ['content', 'places', user.at, field === 'type' ? 'market' : 'tags'],
            value: isType ? to : user.record.tags.map(tag => (tag === word ? to : tag)) }));
        setProblem(nameRow, said(ctx.commit([{ op: 'set', path: [...steps, field], value: to }, ...follow])));
    });
    rows.push(nameRow);

    if (isType) {
        for (const [key, label, hint] of [['buy', 'Buys at', 'What traders pay, as a factor (1 = as usual)'], ['sell', 'Sells at', 'What traders ask, as a factor (1 = as usual)']]) {
            const row = fieldRow({ type: 'number', key, label, hint: `${hint}; blank: as usual`, value: record[key], problem: problemFor(key) }, (k, value) => {
                if (value !== null && badFactor(value)) return setProblem(row, `A factor from ${LO} to ${HI}.`);
                set(key, value === null ? undefined : value, row);
            });
            rows.push(row);
        }
        const stock = Array.isArray(record.stock) ? `${record.stock[0]}-${record.stock[1]}` : '';
        const stockRow = fieldRow({ type: 'text', key: 'stock', label: 'Stock', hint: `The least and most things a trader has, like "2-6" (1 to ${MARKET_LIMITS.stock}); blank: as usual`, value: stock, problem: problemFor('stock') }, (k, value) => {
            const text = String(value).trim();
            if (!text) return set('stock', undefined, stockRow);
            const found = STOCK.exec(text);
            const pair = found ? [Number(found[1]), Number(found[2] ?? found[1])] : null;
            if (!pair || pair[0] < 1 || pair[1] > MARKET_LIMITS.stock || pair[0] > pair[1]) return setProblem(stockRow, `Write the least and most, like "2-6": whole numbers from 1 to ${MARKET_LIMITS.stock}, the least first.`);
            set('stock', pair, stockRow);
        });
        rows.push(stockRow);
    } else {
        const prices = chipList({ key: 'prices', label: 'Prices', hint: `A goods category and a factor from ${LO} to ${HI}, like "fish ×0.8"; "all" for everything`, values: priceChips(record.prices), placeholder: 'fish ×0.8', none: 'No price change' },
            (key, values) => {
                const parsed = values.map(value => PRICE.exec(value.trim()));
                const bad = values.find((value, at) => !parsed[at] || !MARKET_WORD.test(parsed[at][1]) || badFactor(Number(parsed[at][2])));
                if (bad) return setProblem(prices, `"${bad}" is not a price: write a lowercase category and a factor from ${LO} to ${HI}, like "fish ×0.8".`);
                if (values.length > MARKET_LIMITS.categories) return setProblem(prices, `At most ${MARKET_LIMITS.categories} categories.`);
                set('prices', Object.fromEntries(parsed.map(found => [found[1], Number(found[2])])), prices);
            });
        if (problemFor('prices')) setProblem(prices, problemFor('prices'));
        rows.push(prices);
    }
    const noteRow = fieldRow({ type: 'long', key: 'note', label: 'Note', hint: `What the story should know about prices here, at most ${MARKET_LIMITS.note} characters`, rows: 2, value: record.note, problem: problemFor('note') }, (key, value) => {
        const text = String(value).trim();
        if (text.length > MARKET_LIMITS.note) return setProblem(noteRow, `At most ${MARKET_LIMITS.note} characters (this is ${text.length}).`);
        set('note', text || undefined, noteRow);
    });
    rows.push(noteRow, h('div', { class: 'srow wide st-usedby', dataset: { key: 'used-by' } },
        h('span', { class: 'lb' }, h('b', 'Used by'), h('small', isType ? 'Places whose market is this type' : 'Places that carry this tag')),
        h('span', { class: 'ctl' }, users.length ? h('span', { class: 'chips3' }, userChips(users, 'places')) : h('small', { class: 'none' }, `No place ${isType ? 'names this type' : 'carries this tag'} yet.`))));

    const order = h('div', { class: 'srow subrow' }, h('span', { class: 'lb' }, h('b', 'Order')),
        h('span', { class: 'ctl' },
            h('button', { type: 'button', class: 'btn2 st-up', 'aria-label': `Move ${word} up`, disabled: index === 0, onClick: () => on.move(index, -1) }, '↑'),
            h('button', { type: 'button', class: 'btn2 st-down', 'aria-label': `Move ${word} down`, disabled: index === on.list.length - 1, onClick: () => on.move(index, 1) }, '↓'),
            h('button', { type: 'button', class: 'btn2 dng st-remove', 'aria-label': `Remove ${word}`, onClick: () => {
                if (isType && users.length) return setProblem(order, `${plural(users.length, 'place')} name${users.length === 1 ? 's' : ''} it as ${users.length === 1 ? 'its' : 'their'} market: change those first.`);
                setProblem(order, said(ctx.commit([{ op: 'remove', path: steps }])));
            } }, '×')));
    const node = h('section', { class: 'sgrp st-rec', dataset: { rec }, tabindex: '-1' },
        h('div', { class: 'gt' }, String(word ?? `#${index + 1}`), h('small', isType ? ' · settlement type' : ' · environment tag')), rows, order);
    node.append(jsonRow({ value: record, steps, noun: 'market', problems: mine, focus: ctx.focus?.rec === rec ? ctx.focus : null, state: ctx.keep(`json:${rec}`) }, patches => ctx.commit(patches)));
    if (ctx.focus?.rec === rec && ctx.focus.path?.length) {
        const at = `[data-key="${ctx.focus.path[0]}"]`;
        node.querySelector(`${at} input, ${at} select, ${at} textarea`)?.classList.add('st-at');
    }
    return node;
}

function marketNodes(section, ctx) {
    const list = section.value;
    const on = { list, move: (at, step) => ctx.commit([{ op: 'move', path: ['content', 'markets', at], to: at + step }]) };
    const full = list.length >= MARKET_LIMITS.records;
    const add = isType => {
        const taken = new Set(list.filter(isObject).map(record => record[isType ? 'type' : 'tag']));
        const value = isType ? { type: free(taken, 'new-type') } : { tag: free(taken, 'new-tag'), prices: {} };
        ctx.commit([{ op: 'insert', path: ['content', 'markets', list.length], value }]);
    };
    return h('div', { class: 'st-sec', dataset: { key: 'markets' } },
        h('div', { class: 'secl2' }, `Markets · ${list.length}`),
        h('div', { class: 'st-list' }, list.map((record, index) => (isObject(record) ? marketCard(record, index, ctx, on)
            : oddRecordCard({ value: record, steps: ['content', 'markets', index], rec: `markets.${index}`, index, noun: 'market', problems: (ctx.problems ?? []).filter(problem => String(problem.path).startsWith(`content.markets[${index}]`)), state: ctx.keep(`json:markets.${index}`) }, patches => ctx.commit(patches))))),
        h('div', { class: 'addrow' },
            h('button', { type: 'button', class: 'btn2 st-add', dataset: { add: 'type' }, disabled: full, onClick: () => add(true) }, '+ Add a settlement type'),
            h('button', { type: 'button', class: 'btn2 st-add', dataset: { add: 'tag' }, disabled: full, onClick: () => add(false) }, '+ Add an environment tag')),
        full ? h('p', { class: 'fine' }, `At most ${MARKET_LIMITS.records} market records.`) : null);
}

// Under the last of the three sections the pack has: a button for each one it lacks (a part is only drawn for keys the pack holds).
function missingNodes(section, ctx) {
    const content = contentOf(ctx);
    const present = SIBLINGS.filter(([key]) => content[key] !== undefined);
    const absent = SIBLINGS.filter(([key]) => content[key] === undefined);
    if (!absent.length || present.at(-1)?.[0] !== section.key) return null;
    return h('div', { class: 'addrow st-addkey' }, absent.map(([key, empty, label]) =>
        h('button', { type: 'button', class: 'btn2', dataset: { add: key }, onClick: () => ctx.commit([{ op: 'set', path: ['content', key], value: structuredClone(empty) }]) }, `+ Add ${label}`)));
}

/** `section`: `{ key: 'placeKinds' | 'routeKinds' | 'markets', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes:
 * the kind table or the market cards, or the read-only cards for a format 3 pack and a value that is not the right shape. */
export function editSection(section, ctx) {
    const editable = !ctx.legacy && typeof ctx.commit === 'function' && typeof ctx.keep === 'function';
    if (editable && MAPS[section.key] && isObject(section.value)) return [kindMapNodes(section, ctx), missingNodes(section, ctx)].filter(Boolean);
    if (editable && section.key === 'markets' && Array.isArray(section.value)) return [marketNodes(section, ctx), missingNodes(section, ctx)].filter(Boolean);
    return [renderSection(section, ctx)];
}
