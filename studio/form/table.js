// The Studio's table editors (mock MK-7): a row table (numbered rows of typed cells with move, remove and an add bar: months, seasons, holidays,
// coins, ranks, a weather cell's lines) and a grid (rows × columns of cells to open: the climate × season weather grid). On a phone the row
// table puts each cell after the first on a labelled line of its own, and the grid shows one column at a time behind a switch.
// The editor owns the document: every edit is a callback, and the editor draws the table again from the new document.

import { h } from '../../ui/kit/dom.js';
import { segmented } from '../../ui/kit/controls.js';

const TRACK = { text: 'minmax(0, 2fr)', number: 'minmax(88px, auto)', select: 'minmax(0, 1fr)', tag: 'minmax(0, 1fr)', static: 'minmax(0, 1fr)', chips: 'minmax(0, 3fr)', custom: 'minmax(0, 1fr)' };
const isBlank = value => value === null || value === undefined || value === '';
const numberOf = text => (String(text).trim() === '' ? null : Number.isFinite(Number(text)) ? Number(text) : undefined);

// One cell's control. `emit(value)` runs on a committed change: text on change, a number on change (blank is null, a bad number is ignored),
// a select on change, chips with the whole new list.
function control(col, value, label, emit, bad) {
    const aria = `${label}: ${col.label}`;
    const invalid = bad ? 'true' : null;
    if (col.type === 'number') {
        const input = h('input', { type: 'number', value: value ?? '', placeholder: col.placeholder ?? '', 'aria-label': aria, 'aria-invalid': invalid, min: col.min ?? null, max: col.max ?? null, step: col.step ?? null });
        input.addEventListener('change', () => { const n = numberOf(input.value); if (n !== undefined) emit(n); });
        return h('span', { class: 'num' }, input, col.unit ? h('span', null, col.unit) : null);
    }
    if (col.type === 'select') {
        const options = [...(col.options ?? [])];
        if (!isBlank(value) && !options.includes(value)) options.unshift(value);
        const select = h('select', { class: 'sel2', 'aria-label': aria, 'aria-invalid': invalid }, options.map(option => h('option', { value: option, selected: option === value }, option === '' ? (col.placeholder ?? '—') : option)));
        select.addEventListener('change', () => emit(select.value));
        return select;
    }
    if (col.type === 'tag') return isBlank(value) ? h('span', { class: 'st-tnone' }, col.placeholder ?? '—') : h('span', { class: 'tg2' }, String(value));
    if (col.type === 'static') return h('span', { class: 'st-tstatic' }, isBlank(value) ? (col.placeholder ?? '—') : String(value));
    if (col.type === 'chips') return chips(col, Array.isArray(value) ? value : [], aria, emit);
    if (col.type === 'custom') return col.render?.(value, emit) ?? null;
    const input = h('input', { type: 'text', class: 'txt2', value: value ?? '', placeholder: col.placeholder ?? '—', 'aria-label': aria, 'aria-invalid': invalid, maxlength: col.max ?? null });
    input.addEventListener('change', () => emit(input.value));
    return input;
}

// The chips of one cell (the chip-list look): × takes one out, the box adds one on Enter or blur; a value already there is not added twice.
function chips(col, values, aria, emit) {
    const add = h('input', { class: 'txt2 kadd', placeholder: col.placeholder ?? 'Add…', 'aria-label': `${aria}: add` });
    const take = () => {
        const text = add.value.trim();
        add.value = '';
        if (text && !values.includes(text)) emit([...values, text]);
    };
    add.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault?.(); take(); } });
    add.addEventListener('change', take);
    return h('span', { class: 'chips3 st-tchips' },
        values.map((value, at) => h('span', { class: 'kc' }, value, h('button', { type: 'button', 'aria-label': `Remove ${value}`, onClick: () => emit(values.filter((_, i) => i !== at)) }, '×'))),
        add);
}

// A row's problem line: text, or { text, level: 'warning', fix: { label, run } } (the fix is a link-like button after the text).
function problemLine(problem) {
    if (!problem) return null;
    const item = typeof problem === 'string' ? { text: problem } : problem;
    return h('small', { class: `st-tprob${item.level === 'warning' ? ' warn' : ''}`, role: 'alert' }, `${item.level === 'warning' ? '!' : '✕'} ${item.text}`,
        item.fix ? h('button', { type: 'button', class: 'lnk st-tfix', onClick: () => item.fix.run?.() }, item.fix.label) : null);
}

/**
 * A row table. `spec`: { key, title, noun, columns: [{ key, label, type: 'text' | 'number' | 'select' | 'tag' | 'static' | 'chips' | 'custom', width, placeholder,
 * unit, min, max, step, options, render(value, emit), phone: false (left off on a phone) }], rows: [{ values: { <col>: value }, label, number, problem, bad: [col] }],
 * move (default true), remove (default true), max, addLabel, empty, foot, focus: { row, col } }. `on`: { change(index, col, value), add(), move(index, step), remove(index) }.
 * The title reads "<title> · <rows>"; the foot reads `foot`, else "<rows> of <max>"; add is off at `max`. A row's `problem` shows under it; `bad` marks its cells invalid.
 */
export function rowTable(spec, on = {}) {
    const cols = spec.columns ?? [];
    const rows = spec.rows ?? [];
    const move = spec.move !== false && typeof on.move === 'function';
    const remove = spec.remove !== false && typeof on.remove === 'function';
    const tracks = ['28px', ...cols.map(col => col.width ?? TRACK[col.type] ?? TRACK.text), (move || remove) ? 'auto' : null].filter(Boolean).join(' ');
    const head = h('div', { class: 'st-thead', 'aria-hidden': 'true' }, h('span', null, '#'), cols.map(col => h('span', { class: col.phone === false ? 'st-nophone' : null }, col.label)), (move || remove) ? h('span') : null);
    const body = rows.map((row, at) => {
        const label = row.label ?? (typeof row.values?.[cols[0]?.key] === 'string' && row.values[cols[0].key].trim() ? row.values[cols[0].key] : `${spec.noun ?? 'row'} ${at + 1}`);
        const bad = new Set(row.bad ?? []);
        const cells = cols.map((col, c) => {
            const node = control(col, row.values?.[col.key], label, value => on.change?.(at, col.key, value), bad.has(col.key));
            const cell = h('span', { class: ['st-tc', c ? 'rest' : 'first', bad.has(col.key) ? 'bad' : null, col.phone === false ? 'st-nophone' : null], dataset: { col: col.key } },
                c ? h('span', { class: 'st-tlab' }, col.label) : null, node);
            if (spec.focus?.row === at && spec.focus.col === col.key) cell.querySelector('input,select,textarea')?.classList.add('st-at');
            return cell;
        });
        const acts = (move || remove) ? h('span', { class: 'st-tacts' },
            move ? h('button', { type: 'button', class: 'btn2 st-up', 'aria-label': `Move ${label} up`, disabled: at === 0, onClick: () => on.move(at, -1) }, '↑') : null,
            move ? h('button', { type: 'button', class: 'btn2 st-down', 'aria-label': `Move ${label} down`, disabled: at === rows.length - 1, onClick: () => on.move(at, 1) }, '↓') : null,
            remove ? h('button', { type: 'button', class: 'btn2 st-remove', 'aria-label': `Remove ${label}`, onClick: () => on.remove(at) }, '×') : null) : null;
        return h('div', { class: ['st-trow', row.problem ? 'bad' : null], dataset: { row: String(at) }, role: 'group', 'aria-label': label },
            h('span', { class: 'st-tn' }, String(row.number ?? at + 1)), cells, acts, problemLine(row.problem));
    });
    const full = Number.isInteger(spec.max) && rows.length >= spec.max;
    const foot = spec.foot ?? (Number.isInteger(spec.max) ? `${rows.length} of ${spec.max}` : '');
    return h('section', { class: 'sgrp st-table', dataset: { key: spec.key ?? '' }, style: { '--st-cols': tracks } },
        spec.title ? h('div', { class: 'gt' }, `${spec.title} · ${rows.length}`) : null,
        spec.note ? h('p', { class: 'fine st-tnote' }, spec.note) : null,
        rows.length ? head : null,
        rows.length ? body : h('p', { class: 'st-tempty' }, spec.empty ?? 'Nothing here yet.'),
        h('div', { class: 'addrow st-tfoot' },
            typeof on.add === 'function' ? h('button', { type: 'button', class: 'btn2 st-tadd', disabled: full, onClick: () => { if (!full) on.add(); } }, spec.addLabel ?? '+ Add') : null,
            foot ? h('small', { class: 'st-tcount' }, foot) : null));
}

/**
 * A grid. `spec`: { key, title, corner, columns: [{ key, label, warn }], rows: [{ key, label, sub, muted }], cell(rowKey, colKey) → { text, state: 'own' | 'built' | 'none' | 'off',
 * warn } | null, open: { row, col }, column (the phone's column; else the open one, else the first), legend: [{ state, text }] }.
 * `on`: { open(rowKey, colKey), column(colKey) }. A cell with state 'off' cannot be opened; the open cell is pressed.
 */
export function gridTable(spec, on = {}) {
    const cols = spec.columns ?? [];
    const rows = spec.rows ?? [];
    let shown = cols.some(col => col.key === spec.column) ? spec.column : cols.some(col => col.key === spec.open?.col) ? spec.open.col : cols[0]?.key;
    const cells = [];
    const mark = () => cells.forEach(cell => cell.classList.toggle('on', cell.dataset.col === shown));
    const lines = rows.map(row => h('div', { class: ['st-grow', row.muted ? 'muted' : null], dataset: { row: row.key } },
        h('span', { class: 'st-glab' }, h('b', row.label), row.sub ? h('small', row.sub) : null),
        cols.map(col => {
            const found = spec.cell?.(row.key, col.key) ?? { state: 'none' };
            const open = spec.open?.row === row.key && spec.open?.col === col.key;
            const state = found.state ?? 'none';
            const cell = h('button', { type: 'button', class: ['st-gcell', state, found.warn ? 'warn' : null], dataset: { row: row.key, col: col.key }, 'aria-pressed': String(open),
                disabled: state === 'off', 'aria-label': `${row.label} · ${col.label}: ${found.text ?? (state === 'none' ? 'not set' : state)}`, onClick: () => { if (state !== 'off') on.open?.(row.key, col.key); } },
            found.text ?? '—', found.warn ? h('span', { class: 'st-gwarn', 'aria-hidden': 'true' }, ' !') : null);
            cells.push(cell);
            return cell;
        })));
    const pick = cols.length > 1 ? segmented({ items: cols.map(col => [col.key, col.label]), value: shown, label: `${spec.title ?? 'Grid'}: column`, className: 'sseg2 st-gpick',
        onChange: key => { shown = key; mark(); on.column?.(key); } }) : null;
    mark();
    return h('section', { class: 'sgrp st-grid', dataset: { key: spec.key ?? '' }, style: { '--st-gcols': String(cols.length) } },
        spec.title ? h('div', { class: 'gt' }, spec.title) : null,
        pick,
        h('div', { class: 'st-ghead', 'aria-hidden': 'true' }, h('span', null, spec.corner ?? ''), cols.map(col => h('span', { class: col.warn ? 'warn' : null }, col.label, col.warn ? ' !' : ''))),
        lines,
        spec.legend?.length ? h('div', { class: 'st-glegend' }, spec.legend.map(item => h('span', null, h('i', { class: `st-gkey ${item.state}`, 'aria-hidden': 'true' }), item.text))) : null);
}
