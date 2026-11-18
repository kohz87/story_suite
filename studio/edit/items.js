// The items and foes editor (views/route.js EDITORS: items, foes). Each list gets a search, filters and a "New" button, and one record
// gets its page (mock MK-1). An item has name, id, other names, kind, rarity, value and note; how it stacks, weighs and adds to carry;
// what it gives worn (slot, bonus, soak, stats); its effect and tags; and the price effects that name its tags. A foe has name, id,
// other names, tier, level, a line about it and tags. Both end with the JSON row. A record opens with Go to (focus "items.<n>" or "foes.<n>"),
// so the redraw and the back button keep working. While a record is open the other list is not drawn. A world pack that has only one
// of the two lists can start the other from the first one's page.

import { h } from '../../ui/kit/dom.js';
import { ITEM_FIELDS, ITEM_KINDS, RARITIES, STAT_NAME, ITEM_CARRY, ITEM_BONUS, ITEM_SOAK, ITEM_WEIGHT, FOE_FIELDS, FOE_TIERS, FOE_LIMITS, LIMITS, RECORD_LIMITS } from '../../packs/limits.js';
import { slugify } from '../../packs/validate/core-parts/record-ids.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { renderSection } from '../views/records.js';
import { jsonRow } from '../views/json-row.js';

const PART = 'items';
const SHOWN = 40;
const PICK = '(pick a tier)';
const VALUE = { min: 0 };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const contentOf = ctx => (isRecord(ctx.doc?.doc?.content) ? ctx.doc.doc.content : (isRecord(ctx.doc?.content) ? ctx.doc.content : {}));
const slugOf = record => (typeof record?.slug === 'string' ? record.slug : slugify(record?.name));

// What differs between the two lists. `facet` is what the filter chips and the row's tag show.
const KINDS = {
    items: { key: 'items', other: 'foes', noun: 'item', a: 'An item', title: 'Items', one: 'Item', fresh: 'New item', fields: ITEM_FIELDS, facets: ITEM_KINDS,
        facet: item => item.kind ?? 'goods', blank: name => ({ name, kind: 'goods' }), start: 'Start the item list', startHint: 'Named items the story can find, buy and use',
        sub: item => [item.kind ?? 'goods', item.rarity && item.rarity !== 'common' ? item.rarity : null, typeof item.value === 'number' ? `value ${item.value}` : null, item.slot ? `worn: ${item.slot}` : null].filter(Boolean).join(' · ') },
    foes: { key: 'foes', other: 'items', noun: 'foe', a: 'A foe', title: 'Foes', one: 'Foe', fresh: 'New foe', fields: FOE_FIELDS, facets: FOE_TIERS,
        facet: foe => (typeof foe.tier === 'string' ? foe.tier.trim().toLowerCase() : ''), blank: name => ({ name, tier: 'standard' }), start: 'Start the bestiary', startHint: 'Foes the fight check knows by name, with their tier and level',
        sub: foe => [foe.tier || 'no tier', typeof foe.level === 'number' ? `level ${foe.level}` : null, foe.about ? String(foe.about).slice(0, 60) + (String(foe.about).length > 60 ? '…' : '') : null].filter(Boolean).join(' · ') },
};

const inRecord = (problem, key, index) => { const at = `content.${key}[${index}]`; return problem.path === at || [`${at}.`, `${at}[`].some(start => String(problem.path).startsWith(start)); };

// The open record, from the focus: { key, index } when it names a record of either list that exists, else null.
function openOf(ctx) {
    const match = /^(items|foes)\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    if (!match) return null;
    const list = contentOf(ctx)[match[1]];
    return Array.isArray(list) && Number(match[2]) < list.length ? { key: match[1], index: Number(match[2]) } : null;
}

// A name whose slug no record of the list has yet ("New item", "New item 2"…), so the checker finds no duplicate.
function freshName(list, base) {
    const taken = new Set(list.map(slugOf));
    for (let n = 1; ; n++) if (!taken.has(slugify(n === 1 ? base : `${base} ${n}`))) return n === 1 ? base : `${base} ${n}`;
}

/** `section`: `{ key: 'items' | 'foes', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the list, or the open record's page. */
export function editSection(section, ctx) {
    const spec = KINDS[section.key];
    const list = Array.isArray(section.value) ? section.value : null;
    // a section that is not a clean list of records stays readable and editable as JSON
    if (!spec || !list || !list.every(isRecord) || ctx.legacy || typeof ctx.commit !== 'function') return [renderSection(section, ctx)];
    const open = openOf(ctx);
    if (open && open.key !== spec.key) return [];
    const bad = list.map((_, index) => (ctx.problems ?? []).filter(problem => inRecord(problem, spec.key, index)));
    const root = h('div', { class: 'st-sec st-items', dataset: { key: spec.key } });
    root.append(...(open ? recordView(spec, list, open.index, bad[open.index], ctx) : listView(spec, list, bad, ctx)));
    return [root];
}

function listView(spec, list, bad, ctx) {
    const state = ctx.keep?.(`items:${spec.key}`) ?? {};
    const passes = (record, index, key, query) => {
        if (key === 'problems' && !bad[index].length) return false;
        if (key !== 'all' && key !== 'problems' && spec.facet(record) !== key) return false;
        const needle = String(query ?? '').trim().toLowerCase();
        return !needle || [record.name, record.slug, ...(Array.isArray(record.aliases) ? record.aliases : []), ...(Array.isArray(record.tags) ? record.tags : [])].join(' ').toLowerCase().includes(needle);
    };
    const rows = h('div', { class: 'st-list' });
    const fill = () => {
        const found = list.map((record, index) => ({ record, index })).filter(({ record, index }) => passes(record, index, state.filter ?? 'all', state.q));
        const shown = state.all ? found : found.slice(0, SHOWN);
        rows.replaceChildren(...shown.map(({ record, index }) => h('button', { type: 'button', class: 'sgrp st-rec st-itemrow', dataset: { rec: `${spec.key}.${index}` }, onClick: () => ctx.go(PART, `${spec.key}.${index}`) },
            h('div', { class: 'st-rh' },
                h('div', { class: 'st-rt' }, h('b', String(record.name ?? `#${index + 1}`)), h('small', spec.sub(record))),
                h('span', { class: 'st-flags' }, h('span', { class: 'tg2' }, spec.facet(record) || 'no tier'), bad[index].length ? h('span', { class: 'st-bad' }, `✕ ${bad[index].length}`) : null)))),
        found.length ? null : h('p', { class: 'fine' }, list.length ? `No ${spec.noun} matches.` : `No ${spec.noun}s yet.`),
        !state.all && found.length > SHOWN ? h('button', { type: 'button', class: 'btn2 st-more', onClick: () => { state.all = true; fill(); } }, `Show all ${found.length}`) : null);
    };
    const search = h('input', { class: 'txt2 st-search', placeholder: `Search ${spec.noun}s…`, 'aria-label': `Search ${spec.noun}s` });
    search.value = state.q ?? '';
    search.addEventListener('input', () => { state.q = search.value; state.all = false; fill(); });
    const facets = spec.facets.filter(value => list.some(record => spec.facet(record) === value));
    const nBad = bad.filter(found => found.length).length;
    const filters = [['all', 'All'], ...facets.map(value => [value, value]), ...(nBad ? [['problems', `Problems · ${nBad}`]] : [])];
    if (!filters.some(([key]) => key === (state.filter ?? 'all'))) state.filter = 'all';
    const on = state.filter ?? 'all';
    const chips = h('div', { class: 'st-filters' }, ...filters.map(([key, label]) => h('button', { type: 'button', class: 'tg2 st-filter', dataset: { filter: key }, 'aria-pressed': String(on === key),
        onClick: () => { state.filter = key; state.all = false; chips.querySelectorAll('.st-filter').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.filter === key))); fill(); } }, label)));
    const add = () => {
        const made = ctx.commit([{ op: 'insert', path: ['content', spec.key, list.length], value: spec.blank(freshName(list, spec.fresh)) }]);
        if (made?.ok) ctx.go(PART, `${spec.key}.${list.length}`);
    };
    fill();
    const counts = spec.facets.map(value => [value, list.filter(record => spec.facet(record) === value).length]).filter(([, n]) => n).map(([value, n]) => `${n} ${value}`);
    return [h('div', { class: 'secl2' }, `${spec.title} · ${list.length}`),
        h('p', { class: 'fine st-counts' }, [plural(list.length, spec.noun), ...counts].join(' · ')),
        h('div', { class: 'st-bar' }, search, chips, h('button', { type: 'button', class: 'btn2 pri st-new', onClick: add }, spec.fresh)),
        rows, startOther(spec, ctx)];
}

// The card that starts the other list when the pack has none (the part only shows the lists a pack has).
function startOther(spec, ctx) {
    const other = KINDS[spec.other];
    if (contentOf(ctx)[other.key] !== undefined) return null;
    const start = () => { if (ctx.commit([{ op: 'set', path: ['content', other.key], value: [other.blank(other.fresh)] }])?.ok) ctx.go(PART, `${other.key}.0`); };
    return h('section', { class: 'sgrp st-start-other' }, h('div', { class: 'gt' }, other.title),
        h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', `No ${other.noun}s in this pack`), h('small', other.startHint)),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-start', onClick: start }, other.start))));
}

// "STR +2" ⇄ ["STR", 2]; "heal 20" ⇄ ["heal", 20] (a number, true or false, else the words as written).
const statChip = ([name, n]) => `${name} ${n >= 0 ? '+' : ''}${n}`;
const readStat = text => { const m = /^([A-Za-z]{2,12})\s*([+-]?\d+)$/.exec(text.trim()); return m && STAT_NAME.test(m[1].toUpperCase()) ? [m[1].toUpperCase(), Number(m[2])] : null; };
const effectChip = ([name, value]) => `${name} ${value}`;
const readEffect = text => {
    const m = /^(\S+)\s+(.+)$/.exec(text.trim());
    if (!m) return null;
    const raw = m[2].trim();
    return [m[1], raw === 'true' ? true : raw === 'false' ? false : (/^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw)];
};

function recordView(spec, list, index, bad, ctx) {
    const record = list[index];
    const where = ['content', spec.key, index];
    const rec = `${spec.key}.${index}`;
    const state = ctx.keep?.(`items:${rec}`) ?? {};
    const note = h('small', { class: 'st-problem', role: 'status' });
    const say = result => { if (result && !result.ok) note.textContent = result.refusal ?? 'The change was not made.'; return result; };
    const focusKey = ctx.focus?.rec === rec ? ctx.focus.path?.[0] : null;
    const problemOf = key => bad.find(problem => problem.path === `content.${spec.key}[${index}].${key}` || String(problem.path).startsWith(`content.${spec.key}[${index}].${key}[`))?.message ?? '';
    const put = (key, value, drop = false) => {
        if (drop) return Object.hasOwn(record, key) ? say(ctx.commit([{ op: 'remove', path: [...where, key] }])) : null;
        return say(ctx.commit([{ op: 'set', path: [...where, key], value }]));
    };
    const mark = row => {
        if (focusKey && row.dataset?.key === focusKey) { const control = row.querySelector('input,textarea,select'); if (control) { control.classList.add('st-at'); control.dataset.at = '0'; } }
        return row;
    };
    const field = (def, drop, change) => mark(fieldRow({ problem: problemOf(def.key), ...def }, change ?? ((key, value) => put(key, value, drop?.(value)))));
    const edit = patches => say(ctx.commit(patches.map(patch => ({ ...patch, path: [...where, ...patch.path] }))));
    const group = (title, ...rows) => h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, title), ...rows.filter(Boolean));
    // A whole number in its bounds; blank takes the field out.
    const num = (key, label, hint, bounds) => {
        const row = mark(fieldRow({ type: 'number', key, label, hint, value: record[key] ?? null, problem: problemOf(key) }, (_, value) => {
            if (value === null) { setProblem(row, ''); return put(key, null, true); }
            const fits = Number.isInteger(value) && value >= bounds.min && (bounds.max === undefined || value <= bounds.max);
            setProblem(row, fits ? '' : `${label} must be a whole number ${bounds.max === undefined ? `of ${bounds.min} or more` : `from ${bounds.min} to ${bounds.max}`}.`);
            return fits ? put(key, value) : null;
        }));
        return row;
    };
    // A chip list of short texts with a limit on how many and how long; an empty list takes the field out.
    const words = (key, label, hint, placeholder, { most, longest }) => {
        const row = mark(chipList({ key, label, hint, values: Array.isArray(record[key]) ? record[key] : [], placeholder }, (_, values) => {
            const long = values.find(value => value.length > longest);
            const wrong = most !== undefined && values.length > most ? `At most ${most} ${label.toLowerCase()}.` : (long ? `"${long}" is longer than ${longest} characters.` : '');
            setProblem(row, wrong);
            if (!wrong) put(key, values, !values.length);
        }));
        if (problemOf(key)) setProblem(row, problemOf(key));
        return row;
    };
    // A chip list that is an object of name → value; a chip that does not read is refused with `wrong`.
    const pairs = (key, label, hint, placeholder, show, read, wrong) => {
        const value = record[key];
        if (value !== undefined && (!isRecord(value) || Object.values(value).some(item => item !== null && typeof item === 'object'))) {
            return mark(h('div', { class: 'srow wide', dataset: { key } }, h('span', { class: 'lb' }, h('b', label), h('small', 'Written in a shape the form does not draw: edit it in the JSON below.'))));
        }
        const row = mark(chipList({ key, label, hint, values: Object.entries(value ?? {}).map(show), placeholder }, (_, values) => {
            const entries = values.map(read);
            const unread = values.find((_, at) => !entries[at]);
            setProblem(row, unread ? `"${unread}" ${wrong}` : '');
            if (!unread) put(key, Object.fromEntries(entries), !values.length);
        }));
        if (problemOf(key)) setProblem(row, problemOf(key));
        return row;
    };
    const nameRow = mark(fieldRow({ type: 'text', key: 'name', label: 'Name', hint: 'Shown in lists; the story finds it by this or another name', value: record.name ?? '', problem: problemOf('name') }, (_, value) => {
        const next = String(value).trim();
        const wrong = !next ? `${spec.a} needs a name.` : (next.length > LIMITS.name ? `A name is at most ${LIMITS.name} characters.` : '');
        setProblem(nameRow, wrong);
        if (!wrong && next !== record.name) put('name', next);
    }));
    const idRow = mark(fieldRow({ type: 'text', key: 'slug', label: 'Id', hint: `Blank: made from the name (${slugify(record.name) || 'none yet'})`, value: record.slug ?? '', problem: problemOf('slug') }, (_, value) => {
        const next = String(value).trim();
        const clash = next && list.some((other, at) => at !== index && slugOf(other) === next);
        setProblem(idRow, clash ? `Another ${spec.noun} has the id "${next}".` : '');
        if (!clash && next !== (record.slug ?? '')) put('slug', next, !next);
    }));
    const head = h('div', { class: 'st-bar' },
        h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, `‹ ${spec.title}`),
        h('span', { class: 'st-acts' },
            h('button', { type: 'button', class: 'btn2 st-dup', onClick: () => duplicate(spec, list, index, ctx) }, 'Duplicate'),
            state.confirm
                ? [h('button', { type: 'button', class: 'btn2 dng st-sure', onClick: () => { state.confirm = false; if (say(ctx.commit([{ op: 'remove', path: where }]))?.ok) ctx.go(PART); } }, `Delete this ${spec.noun}`),
                    h('button', { type: 'button', class: 'btn2 st-keep', onClick: () => { state.confirm = false; ctx.go(PART, rec); } }, 'Keep it')]
                : h('button', { type: 'button', class: 'btn2 dng st-del', onClick: () => { state.confirm = true; ctx.go(PART, rec); } }, 'Delete')));
    const whole = bad.filter(problem => problem.path === `content.${spec.key}[${index}]`).map(problem => problem.message).join(' ');
    if (whole) note.textContent = whole;
    const body = spec.key === 'items' ? itemGroups(record, { field, num, words, pairs, group, nameRow, idRow, edit }, ctx) : foeGroups(record, { field, num, words, group, nameRow, idRow, edit });
    const extra = Object.keys(record).filter(key => !spec.fields.includes(key));
    return [head,
        h('div', { class: 'st-rt st-entryhead', dataset: { rec }, tabindex: '-1' }, h('b', String(record.name ?? '(no name)')),
            h('small', `${spec.one} ${index + 1} of ${list.length}`), h('span', { class: 'tg2' }, spec.facet(record) || 'no tier')),
        note, ...body,
        extra.length ? h('p', { class: 'fine' }, `Also in this ${spec.noun}, only in the JSON below: ${extra.join(', ')}.`) : null,
        jsonRow({ value: record, steps: where, noun: spec.noun, problems: bad, focus: focusKey && !spec.fields.includes(focusKey) ? ctx.focus : null, state: ctx.keep?.(`json:${rec}`) ?? {} }, patches => ctx.commit(patches))].filter(Boolean);
}

function itemGroups(item, { field, num, words, pairs, group, nameRow, idRow, edit }, ctx) {
    const kind = item.kind ?? 'goods';
    const equipment = kind === 'equipment';
    const worn = equipment || ['slot', 'bonus', 'soak', 'stats'].some(key => item[key] !== undefined);
    // Equipment never stacks, so a change to equipment takes a written `stack` out with it.
    const setKind = (_, value) => (value === kind ? null : edit([{ op: 'set', path: ['kind'], value }, ...(value === 'equipment' && Object.hasOwn(item, 'stack') ? [{ op: 'remove', path: ['stack'] }] : [])]));
    const uses = priceUses(item, ctx);
    return [
        group('Item', nameRow, idRow,
            words('aliases', 'Other names', 'What the story may call it instead', 'Add a name…', { longest: LIMITS.name }),
            field({ type: 'select', key: 'kind', label: 'Kind', hint: 'Equipment is worn; a consumable is used up', value: kind, options: [...ITEM_KINDS] }, null, setKind),
            field({ type: 'select', key: 'rarity', label: 'Rarity', hint: 'Without a bonus, gear gives its rarity\'s bonus', value: item.rarity ?? 'common', options: [...RARITIES] }, value => value === 'common' && item.rarity === undefined),
            num('value', 'Value', 'What it is worth, in the chat\'s currency', VALUE),
            field({ type: 'long', key: 'note', label: 'Note', hint: `What the story should know about it (at most ${RECORD_LIMITS.note} characters)`, value: item.note ?? '', rows: 3 }, value => !String(value).trim())),
        group('In the bag',
            equipment ? h('div', { class: 'srow', dataset: { key: 'stack' } }, h('span', { class: 'lb' }, h('b', 'Stacks'), h('small', 'Equipment never stacks: each piece is its own'))) :
                field({ type: 'toggle', key: 'stack', label: 'Stacks', hint: 'Off: each one is kept apart', value: item.stack !== false }, value => value === true),
            num('weight', 'Weight', `What one weighs in load (${ITEM_WEIGHT.min}–${ITEM_WEIGHT.max}). Blank: the default for its slot or kind`, ITEM_WEIGHT),
            num('carry', 'Adds carry', `Carry capacity it adds while owned${equipment ? ' (worn)' : ''} (${ITEM_CARRY.min}–${ITEM_CARRY.max}). Blank: none`, ITEM_CARRY)),
        worn ? group('Worn',
            field({ type: 'text', key: 'slot', label: 'Slot', hint: 'weapon, body, off-hand, head, cloak, feet or accessory', value: item.slot ?? '' }, value => !String(value).trim()),
            num('bonus', 'Bonus', `The gear bonus while worn (${ITEM_BONUS.min}–${ITEM_BONUS.max}). Blank: its rarity's`, ITEM_BONUS),
            num('soak', 'Soak', `Soak while worn (${ITEM_SOAK.min}–${ITEM_SOAK.max}); the slot may hold it lower`, ITEM_SOAK),
            pairs('stats', 'Stats', 'A stat and a whole number, like "STR +2"', 'STR +2', statChip, readStat, 'is not a stat: write a name in capitals and a whole number, like "STR +2".')) : null,
        group('Use',
            pairs('effect', 'Effect', 'What using it does, like "heal 20"', 'heal 20', effectChip, readEffect, 'is not an effect: write a name and a value, like "heal 20".'),
            words('tags', 'Tags', 'Short words; a condition\'s price effect may name one', 'Add a tag…', { longest: RECORD_LIMITS.word })),
        group('Used by', ...(uses.length ? uses.map(use => h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', use.name), h('small', `Price effect ${use.tag} ${use.factor}`)),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-goto', 'aria-label': `Go to ${use.name}`, onClick: () => ctx.go('conditions', `conditions.${use.index}`) }, 'Go to'))))
            : [h('p', { class: 'fine' }, 'No condition\'s price effect names its tags.')])),
    ];
}

// The conditions whose price effect names one of the item's tags (a price effect names an item tag or a market category).
function priceUses(item, ctx) {
    const tags = new Set(Array.isArray(item.tags) ? item.tags : []);
    const conditions = contentOf(ctx).conditions;
    if (!tags.size || !Array.isArray(conditions)) return [];
    return conditions.flatMap((condition, index) => Object.entries(isRecord(condition?.effects?.prices) ? condition.effects.prices : {})
        .filter(([tag]) => tags.has(tag)).map(([tag, factor]) => ({ name: String(condition.name ?? `#${index + 1}`), index, tag, factor })));
}

function foeGroups(foe, { field, num, words, group, nameRow, idRow, edit }) {
    const tier = typeof foe.tier === 'string' ? foe.tier.trim().toLowerCase() : '';
    const about = h('small', { class: 'fine st-count' });
    const aboutRow = field({ type: 'long', key: 'about', label: 'About', hint: 'One line on what it is, for the story', value: foe.about ?? '', rows: 2 }, value => !String(value).trim());
    const counts = text => { about.textContent = `${String(text).length} of ${FOE_LIMITS.about} characters`; };
    counts(foe.about ?? '');
    aboutRow.querySelector('textarea')?.addEventListener('input', event => counts(event.target?.value ?? ''));
    aboutRow.append(about);
    return [
        group('Foe', nameRow, idRow,
            words('aliases', 'Other names', `Up to ${FOE_LIMITS.aliases}; a plural of any name also counts`, 'Add a name…', { most: FOE_LIMITS.aliases, longest: LIMITS.name })),
        group('In a fight',
            field({ type: 'select', key: 'tier', label: 'Tier', hint: 'How dangerous it is, from mob to apex', value: FOE_TIERS.includes(tier) ? tier : PICK, options: FOE_TIERS.includes(tier) ? [...FOE_TIERS] : [PICK, ...FOE_TIERS] },
                null, (_, value) => (value === PICK || value === foe.tier ? null : edit([{ op: 'set', path: ['tier'], value }]))),
            num('level', 'Level', `${FOE_LIMITS.level.min}–${FOE_LIMITS.level.max}. Blank: the fight check judges it`, FOE_LIMITS.level),
            h('p', { class: 'fine' }, 'When a typed attack names this foe (by a name, another name or a plural), the fight uses this tier and, when given, this level.')),
        group('Details', aboutRow,
            words('tags', 'Tags', `Up to ${FOE_LIMITS.tags} short words`, 'Add a tag…', { most: FOE_LIMITS.tags, longest: RECORD_LIMITS.word })),
    ];
}

// A copy right after the record, under a name no record has, and without the id (an id names one record).
function duplicate(spec, list, index, ctx) {
    const copy = JSON.parse(JSON.stringify(list[index]));
    copy.name = freshName(list, `${String(copy.name ?? spec.one)} copy`);
    delete copy.slug;
    if (ctx.commit([{ op: 'insert', path: ['content', spec.key, index + 1], value: copy }])?.ok) ctx.go(PART, `${spec.key}.${index + 1}`);
}
