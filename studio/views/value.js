// How the Studio's read-only views draw a value and a record: text as written, short lists inline, anything nested as JSON.

import { h } from '../../ui/kit/dom.js';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isPlain = value => value === null || ['string', 'number', 'boolean'].includes(typeof value);

/** One value: a string or number as text, a list of plain values joined, an object of plain values as rows, else JSON. */
export function valueNode(value) {
    if (typeof value === 'string') return h('div', { class: 'st-val' }, value);
    if (isPlain(value)) return h('div', { class: 'st-val' }, String(value));
    if (Array.isArray(value) && value.every(isPlain)) return h('div', { class: 'st-val' }, value.length ? value.map(String).join(', ') : '(none)');
    if (isObject(value) && Object.values(value).every(isPlain)) {
        return h('dl', { class: 'st-kv' }, Object.entries(value).map(([key, item]) => [h('dt', key), h('dd', String(item))]));
    }
    return h('pre', { class: 'sent st-json' }, JSON.stringify(value, null, 2));
}

/** One labelled field: a short plain value sits at the row's right, anything longer under its label. */
export function fieldRow(label, value) {
    if (isPlain(value) && String(value).length <= 40) return h('div', { class: 'srow' }, h('div', { class: 'lb' }, h('b', label)), h('div', { class: 'ctl' }, valueNode(value)));
    return h('div', { class: 'srow wide' }, h('div', { class: 'lb' }, h('b', label)), valueNode(value));
}

/**
 * One record as a card: `{ rec, title, sub, flags: [names set true], fields: [[label, value]], aside }`. `rec` ("cast.3") is what
 * Go to looks for; the card can take focus so Go to can move the reader to it.
 */
export function recordCard({ rec, title, sub = '', flags = [], fields = [], aside = null }) {
    return h('section', { class: 'sgrp st-rec', dataset: { rec }, tabindex: '-1', 'aria-label': String(title) },
        h('div', { class: 'st-rh' },
            aside,
            h('div', { class: 'st-rt' }, h('b', String(title)), sub ? h('small', sub) : null),
            flags.length ? h('span', { class: 'st-flags' }, flags.map(flag => h('span', { class: 'tg2' }, flag))) : null),
        fields.map(([label, value]) => fieldRow(label, value)));
}
