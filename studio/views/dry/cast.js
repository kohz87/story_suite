// The Dry run's Cast tab (MK-5): the deaths, the moves and the status changes of the run as sections, each with Go to into the person's record, and the people who began and did not change.

import { h } from '../../../ui/kit/dom.js';

const section = (cls, title, ...children) => h('section', { class: `sgrp st-dry-cast ${cls}` }, h('div', { class: 'gt' }, title), ...children);
const person = (doc, id) => (doc?.content?.cast ?? []).find(item => item?.id === id)?.name ?? id;
const line = (kind, title, sub, ...links) => h('div', { class: 'srow st-cast', dataset: { kind } }, h('div', { class: 'lb' }, h('b', title), sub ? h('small', sub) : null), links.length ? h('div', { class: 'ctl' }, links) : null);

/** `castGroup(ctx, rows, { go, castTarget, eventTarget, date })` → the sections' nodes: `go(ctx, target, label)` is the Go to button, `eventTarget(by)` the record of an event or template, `date(day)` the day's date or ''. */
export function castGroup(ctx, rows, { go, castTarget, eventTarget, date }) {
    const when = day => `${date(day) || `Day ${day}`} · day ${day}`;
    const deaths = rows.flatMap(day => day.deaths.map(item => ({ day: day.day, ...item })));
    const moves = rows.flatMap(day => day.moves.map(item => ({ day: day.day, ...item })));
    const status = rows.flatMap(day => (day.statuses ?? []).map(item => ({ day: day.day, ...item })));
    const out = [];
    const links = (id, by) => [by ? go(ctx, eventTarget(by), 'Event ›') : null, go(ctx, castTarget(ctx.doc, id), 'Person ›')];
    if (deaths.length) out.push(section('st-dry-deaths', `Deaths · ${deaths.length}`, deaths.map(item => line('death', `${person(ctx.doc, item.id)} dies`, `${when(item.day)} · by ${item.by}`, ...links(item.id, item.by)))));
    if (moves.length) out.push(section('st-dry-moves', `Moves · ${moves.length}`, moves.map(item => line('move', `${person(ctx.doc, item.id)} goes to ${item.to}${item.routine ? `: ${item.routine}` : ''}`, `${when(item.day)}${item.until ? ` · until ${item.until}` : ''}${item.by ? ` · by ${item.by}` : ''}`, ...links(item.id, item.by)))));
    if (status.length) out.push(section('st-dry-status-changes', `Status changes · ${status.length}`, status.map(item => line('status', person(ctx.doc, item.id), `${when(item.day)} · “${item.status}”`, ...links(item.id, null)))));
    if (!deaths.length && !moves.length && !status.length) out.push(section('st-dry-quiet-cast', 'The cast', line('quiet', 'No one moved or died.', 'The cast stayed where the pack starts them.')));
    const touched = new Set([...deaths, ...moves, ...status].map(item => item.id));
    const stayed = (ctx.doc?.content?.cast ?? []).filter(item => item?.id && !touched.has(item.id)).map(item => item.name ?? item.id);
    if (stayed.length) out.push(section('st-dry-began', `As they began · ${stayed.length}`, h('div', { class: 'srow wide' }, h('div', { class: 'lb' }, h('small', stayed.join(', '))))));
    return out;
}
