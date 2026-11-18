// The Dry run result's head (MK-5): the collapsed form line (Seed · tempo · days, with Change and Run again), the engine's warnings and the "What happened" tiles.

import { h } from '../../../ui/kit/dom.js';
import { dateOf } from './days.js';
import { holdSpans } from './series.js';

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const tile = (n, label, bad = false) => h('div', { class: 'st-tile', dataset: { bad: String(bad && n > 0) } }, h('b', String(n)), h('small', label));

/** `headNodes(ctx, st, on)`: `on`: `{ change, again, warns }`. The summary line, then the tiles. Run again is held while the pack has errors. */
export function headNodes(ctx, st, on) {
    const { result } = st;
    const rows = result.rows ?? [];
    const count = key => rows.reduce((sum, day) => sum + day[key].length, 0);
    const kinds = rows.flatMap(day => day.journal);
    const first = dateOf(result, st.calendar, 1);
    const last = dateOf(result, st.calendar, Math.max(result.days, 1));
    const stale = st.ranOn !== ctx.doc ? ' The pack has changed since: run it again to see the change.' : '';
    const sub = `${first ? `${first} to ${last} · ` : 'From day 1, since the world gives no start date · '}on ${st.against}.${stale}`;
    const head = h('div', { class: 'srow wide st-dry-result', dataset: { stale: String(Boolean(stale)) } },
        h('div', { class: 'lb' }, h('b', `Seed ${result.seed} · tempo ${result.tempo} · ${plural(result.days, 'day')}: ${plural(count('fired'), 'event')} fired`), h('small', sub)),
        h('div', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-dry-change', onClick: on.change }, 'Change'), h('button', { type: 'button', class: 'btn2 st-dry-again', disabled: (ctx.check?.errors?.length ?? 0) > 0, onClick: on.again }, 'Run again')));
    const said = result.warnings ?? [];
    const note = text => h('div', { class: 'srow st-dry-warn', dataset: { level: 'warning' } }, h('div', { class: 'lb' }, h('b', h('span', { class: 'st-mark', 'aria-hidden': 'true' }, '! '), text)));
    const warns = said.length ? [h('div', { class: 'srow st-dry-warnhead', dataset: { level: 'warning' } }, h('div', { class: 'lb' },
        h('b', h('span', { class: 'st-mark', 'aria-hidden': 'true' }, '! '), `The engine said ${plural(said.length, 'thing')} about the pack`), h('small', 'Open templates get no AI answer in a dry run, so most of these are expected.')),
        h('div', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-dry-warnshow', onClick: on.warns }, st.warnsOpen ? 'Hide' : 'Show'))), ...(st.warnsOpen ? said.map(note) : [])] : [];
    const tiles = h('section', { class: 'sgrp st-dry-tiles' }, h('div', { class: 'gt' }, `What happened in ${plural(result.days, 'day')}`),
        h('div', { class: 'st-tiles' }, tile(count('fired'), 'events fired'), tile(kinds.filter(e => !e.fired && !e.ended && String(e.by ?? '').startsWith('template:')).length, 'template moves'),
            tile(holdSpans(rows).length, 'conditions held'), tile(count('moves'), 'moves'), tile(count('deaths'), 'deaths', true), tile(kinds.filter(e => e.ended).length, 'events ended')));
    return [head, ...warns, tiles];
}
