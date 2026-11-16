// Draws a map of numbers as value-and-bar rows (top known, the rest folded) and builds those rows from a definition.
import { h, humanize } from '../../view/widgets/dom.js';
import { dmNameOf } from '../../data-modules/schema.js';
import { fill } from '../../../../../../core/strings.js';
import { V, pencilFor } from './shared-chrome.js';
import { barNode } from './shared-bar.js';

// ---- a map of numbers --------------------------------------------------------------------------------------------------------------------

const signed = (value, min) => (min < 0 && value > 0 ? `+${value}` : String(value));

const TOP_KNOWN = 3;

/** A signed range's scale, shown once under the first row: the field's own names for its ends and middle, else "−100 … 0 … +100". */
function scaleNode(doc, row) {
    const named = value => (row.names ? dmNameOf({ type: 'int', names: row.names }, value) : null);
    const out = h(doc, 'li', 'ss-rm-scale');
    for (const value of [row.min, 0, row.max]) out.appendChild(h(doc, 'span', '', named(value) ?? (value < 0 ? `\u2212${-value}` : value > 0 ? `+${value}` : '0')));
    return out;
}

/**
 * rows: [{ key, name, value, min, max, def, names, payload, label }] (`payload` is the dm.set payload minus value; null = not editable).
 * The top three known rows (highest first) show; the other known ones and the rows at a default of 0 (or the minimum) fold into one row,
 * "N more known · Not known yet (N)", that opens in place. A signed range (min < 0) runs its bar from a centre line (red below 0, green above) and
 * shows its scale once under the first row. Pencils are hidden until the section's Edit button is pressed (kept in `env.memory` only).
 */
export function drawNumberMap(env, parent, { title, rows, memoryKey }) {
    const { doc } = env;
    const section = h(doc, 'section', 'ss-b-map'); parent.appendChild(section);
    section.setAttribute('data-map', memoryKey);
    const editKey = `${memoryKey}:editing`;
    if (rows.some(row => row.payload)) {
        const head = h(doc, 'div', 'ss-rm-head'); section.appendChild(head);
        if (title) head.appendChild(h(doc, 'h4', 'ss-section-label', title));
        const edit = h(doc, 'button', 'ss-rm-edit-btn ss-tap-pill', V.edited);   // a slim pill (the mockup's), a 44px tap area (size.css)
        edit.setAttribute('type', 'button');
        const reflect = on => { section.classList.toggle('ss-rm-editing', on); edit.setAttribute('aria-pressed', String(on)); };
        reflect(env.memory.get(editKey) === true);
        edit.addEventListener('click', () => { const on = !section.classList.contains('ss-rm-editing'); env.memory.set(editKey, on); reflect(on); });
        head.appendChild(edit);
    } else if (title) section.appendChild(h(doc, 'h4', 'ss-section-label', title));
    // A row is "not known yet" when it sits at a default that means nothing (0 or the minimum); a default of 40 is a value that is known.
    const unknown = row => row.value === row.def && (row.def === 0 || row.def === row.min);
    const known = rows.filter(row => !unknown(row)), rest = rows.filter(unknown);
    section.appendChild(h(doc, 'p', 'ss-b-sub', fill(V.known, { n: known.length, total: rows.length })));
    const box = h(doc, 'div', 'ss-glass ss-b-box'); section.appendChild(box);
    const pencil = (li, row) => {
        if (!row.payload) return;
        const mark = { module: row.payload.module, field: row.payload.field, key: row.payload.key ?? '', who: row.payload.who ?? '' };
        pencilFor(env, li, { kind: 'number', min: row.min, max: row.max, label: row.label ?? row.name, command: 'dm.set', payload: row.payload }, mark);
    };
    const knownRow = (list, row) => {
        const li = h(doc, 'li', 'ss-b-row'); list.appendChild(li);
        li.setAttribute('data-key', row.key);
        li.appendChild(h(doc, 'span', 'ss-b-name', row.name));
        const word = row.names ? dmNameOf({ type: 'int', names: row.names }, row.value) : null;
        const value = h(doc, 'span', `ss-b-val${row.min < 0 && row.value !== 0 ? (row.value < 0 ? ' ss-rm-neg' : ' ss-rm-pos') : ''}`, word ?? signed(row.value, row.min));
        if (word) value.setAttribute('title', String(row.value));
        li.appendChild(value);
        pencil(li, row);
        li.appendChild(barNode(doc, row.value, row.min, row.max));
    };
    const list = h(doc, 'ul', 'ss-b-list'); box.appendChild(list);
    const sorted = known.map((row, at) => ({ row, at })).sort((a, b) => b.row.value - a.row.value || a.at - b.at).map(entry => entry.row);
    sorted.slice(0, TOP_KNOWN).forEach((row, at) => { knownRow(list, row); if (at === 0 && row.min < 0) list.appendChild(scaleNode(doc, row)); });
    const more = sorted.slice(TOP_KNOWN);
    if (more.length || rest.length) {
        const fold = h(doc, 'details', 'ss-b-fold ss-rm-fold');
        const label = `${memoryKey}:unknown`;
        if (env.memory.get(label) === true) fold.setAttribute('open', '');
        fold.addEventListener('toggle', () => env.memory.set(label, fold.open === true));
        fold.appendChild(h(doc, 'summary', '', [more.length ? fill(V.moreKnown, { n: more.length }) : '', rest.length ? fill(V.unknown, { n: rest.length }) : ''].filter(Boolean).join(' \u00b7 ')));
        const inner = h(doc, 'ul', 'ss-b-list'); fold.appendChild(inner);
        for (const row of more) knownRow(inner, row);
        for (const row of rest) {
            const li = h(doc, 'li', 'ss-b-row ss-b-row-plain'); inner.appendChild(li);
            li.setAttribute('data-key', row.key);
            li.appendChild(h(doc, 'span', 'ss-b-name', row.name));
            pencil(li, row);
        }
        box.appendChild(fold);
    }
    return section;
}

/** The rows of a map field (or of number fields listed together) of a definition and the values it holds now. */
export function numberRows({ definition, module, who, values, field, fields, names = {} }) {
    const state = definition.state;
    const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
    const nameOf = (key, fallback) => (typeof names[key] === 'string' && names[key] ? names[key] : cap(fallback));
    if (fields === undefined || field !== undefined) {
        const schema = state[field];
        return schema.keys.map(key => {
            const raw = values?.[field]?.[key];
            const value = Number.isFinite(raw) ? raw : schema.values.default;
            return { key, name: nameOf(key, humanize(key)), value, min: schema.values.min, max: schema.values.max, def: schema.values.default, names: schema.values.names ?? null,
                payload: schema.edit === false || schema.values.edit === false ? null : { module, field, ...(who ? { who } : {}), key } };
        });
    }
    return fields.map(name => {
        const schema = state[name], raw = values?.[name];
        const value = Number.isFinite(raw) ? raw : schema.default;
        return { key: name, name: nameOf(name, schema.label ?? humanize(name)), value, min: schema.min, max: schema.max, def: schema.default, names: schema.names ?? null,
            payload: schema.edit === false ? null : { module, field: name, ...(who ? { who } : {}) } };
    });
}
