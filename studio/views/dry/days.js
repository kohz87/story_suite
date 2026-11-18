// The Dry run result's Timeline tab (MK-5): the kind filters, Jump to, and the days with something as dated cards with "N quiet days" between them,
// each line with Go to into the record it came from. The lines per day come from the run's journal, moves, deaths and holds.

import { h } from '../../../ui/kit/dom.js';
import { calendarConfig } from '../../../modules/time/tracker/time.js';
import { makeCalendar } from '../../../modules/time/calendar.js';

export const STEP = 30;
const DAY = 1440;
const FILTERS = [['all', 'All'], ['events', 'Events'], ['templates', 'Templates'], ['holds', 'Holds'], ['cast', 'Cast']];
const GROUP = { fired: 'events', ended: 'events', news: 'events', happens: 'templates', holds: 'holds', move: 'cast', death: 'cast' };
const TAG = { fired: 'Event', ended: 'Ended', news: 'News', happens: 'Template', holds: 'Holds', move: 'Move', death: 'Death' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** `dateOf(result, calendar, day)` → "1 October 611", or '' when the world gives no start date. */
export function dateOf(result, calendar, day) {
    if (!result.start?.date) return '';
    const cal = makeCalendar(calendarConfig(null, calendar));
    const at = cal.fromAbs((result.start.day + day - 1) * DAY);
    return `${at.day} ${cal.config.months[at.month]?.name ?? ''} ${at.year}`.replace('  ', ' ');
}

/** `jumpTo(st, busy, text)` → the day to show: the first day with news at or after the number typed, or 0 for none. */
export function jumpTo(busy, text) {
    const day = Math.round(Number(String(text).replace(/^day\s*/i, '')));
    return Number.isFinite(day) && day >= 1 ? (busy.find(item => item.day >= day)?.day ?? 0) : 0;
}

/** `dayList(ctx, st, busy, goButton)` → the tab's nodes. `busy`: `[{ day, lines: [{ kind, text, target }] }]`; `st`: `{ result, calendar, kind, shown, jump }`. */
export function dayList(ctx, st, busy, goButton) {
    const kind = st.kind ?? 'all';
    const counts = Object.fromEntries(FILTERS.map(([key]) => [key, busy.reduce((sum, item) => sum + item.lines.filter(line => key === 'all' || GROUP[line.kind] === key).length, 0)]));
    const chips = h('div', { class: 'st-dfilters' }, FILTERS.map(([key, label]) => h('button', { type: 'button', class: 'tg2 st-dchip st-dry-filter', dataset: { filter: key }, 'aria-pressed': String(kind === key),
        onClick: () => { st.kind = key; st.shown = STEP; ctx.go('timeline'); } }, key === 'all' ? label : `${label} · ${counts[key]}`)));
    const list = busy.map(item => ({ ...item, lines: item.lines.filter(line => kind === 'all' || GROUP[line.kind] === kind) })).filter(item => item.lines.length);
    const firstDeath = busy.find(item => item.lines.some(line => line.kind === 'death'));
    const input = h('input', { type: 'text', class: 'txt2 st-dry-jump', placeholder: 'A day number…', 'aria-label': 'Jump to a day' });
    input.addEventListener('change', () => {
        const day = jumpTo(list, input.value);
        if (!day) return;
        st.shown = Math.max(st.shown, list.findIndex(item => item.day === day) + 1);
        (st.folds ??= {})[day] = true;
        st.jump = day;
        ctx.go('timeline');
    });
    const jump = h('div', { class: 'srow st-dry-jumprow' }, h('div', { class: 'lb' }, h('b', 'Jump to'), h('small', 'Days with a death, or a day number')),
        h('div', { class: 'ctl' }, firstDeath ? h('button', { type: 'button', class: 'lnk st-dry-death', onClick: () => { (st.folds ??= {})[firstDeath.day] = true; st.jump = firstDeath.day; st.kind = 'all'; st.shown = Math.max(st.shown, busy.indexOf(firstDeath) + 1); ctx.go('timeline'); } }, `Day ${firstDeath.day} · death ›`) : null, input));
    const shown = list.slice(0, st.shown);
    let before = 0;
    const cards = [];
    for (const item of shown) {
        const gap = item.day - before - 1;
        if (gap > 0) cards.push(h('div', { class: 'st-quiet', dataset: { gap: String(gap) } }, `${plural(gap, 'quiet day')}`));
        before = item.day;
        const date = dateOf(st.result, st.calendar, item.day);
        const open = st.folds?.[item.day] ?? shown.indexOf(item) < 2;
        const toggle = () => { (st.folds ??= {})[item.day] = !open; ctx.go('timeline'); };
        cards.push(h('div', { class: 'srow wide st-day', dataset: { day: String(item.day), open: String(open) } },
            h('button', { type: 'button', class: 'st-dayhead', 'aria-expanded': String(open), onClick: toggle }, h('span', { class: 'st-chev', 'aria-hidden': 'true' }, open ? '⌄' : '›'), h('b', date || `Day ${item.day}`), date ? h('small', ` day ${item.day}`) : null, h('small', { class: 'st-lines' }, plural(item.lines.length, 'line'))),
            open ? item.lines.map(line => h('div', { class: 'st-line', dataset: { kind: line.kind } }, h('span', { class: 'st-tag' }, TAG[line.kind] ?? line.kind), h('span', { class: 'st-lt' }, line.text, line.target ? ' ' : null, goButton(ctx, line.target, 'Go to ›'))))
                : h('div', { class: 'st-peek' }, item.lines[0].text)));
    }
    const more = list.length > shown.length ? h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-dry-more', onClick: () => { st.shown += STEP; ctx.go('timeline'); } }, `Show the next ${STEP} days with something`),
        h('small', ` ${list.length - shown.length} more of ${list.length}`)) : null;
    if (st.jump) { const day = st.jump; st.jump = 0; setTimeout(() => globalThis.document?.querySelector?.(`.st-day[data-day="${day}"]`)?.scrollIntoView?.({ block: 'start' }), 0); }
    const none = list.length ? null : h('div', { class: 'srow st-dry-quiet' }, h('div', { class: 'lb' }, h('b', 'Nothing happened.'), h('small', 'No event fired, no one moved and no condition began or ended in these days.')));
    return [h('section', { class: 'sgrp st-dry-days' }, chips, jump, none, cards, more)];
}
