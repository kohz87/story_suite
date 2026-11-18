// The Dry run form (MK-5): the seed with New seed, the tempo, the days with 30 days / 1 year / 3 years, where the run starts and what it begins with,
// and the wide Run button. With an error in the pack the button is held and "Fix the N problems first" names the way to the first one.

import { h } from '../../../ui/kit/dom.js';
import { fieldRow } from '../../form/fields.js';
import { startDayOf, startOf } from '../../dryrun/start.js';

export const MAX_DAYS = 3650;
const CHIPS = [['30 days', 30], ['1 year', 365], ['3 years', 1095]];
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

const note = (title, text, ...ctl) => h('div', { class: 'srow st-dry-note' }, h('div', { class: 'lb' }, h('b', title), text ? h('small', text) : null), ctl.length ? h('div', { class: 'ctl' }, ctl) : null);
const dateText = date => `${date.day} ${date.month} ${date.year}`;

/** `formNodes(ctx, st, on)` → the form's rows. `on`: `{ run, cancel, redraw, reseed }`; `st` is the page's form state. */
export function formNodes(ctx, st, on) {
    const running = Boolean(st.job);
    const errors = ctx.check?.errors ?? [];
    const first = errors[0];
    const seed = fieldRow({ type: 'text', key: 'seed', label: 'Seed', hint: 'The same seed gives the same run. A chat draws its own seed, so a chat will not play out like this.', value: st.seed, size: 'short' }, (_, value) => { st.seed = value; });
    seed.querySelector('.ctl')?.append(h('button', { type: 'button', class: 'btn2 st-dry-newseed', onClick: on.reseed }, 'New seed'));
    const tempo = fieldRow({ type: 'number', key: 'tempo', label: 'Tempo', hint: 'How fast the world moves: 2 = seasons last twice as long. 0.25 to 4; 1 is as written.', value: st.tempo }, (_, value) => {
        if (Number.isFinite(value)) st.tempo = Math.min(Math.max(value, 0.25), 4);
    });
    const days = fieldRow({ type: 'number', key: 'days', label: 'Days', hint: `From 1 to ${MAX_DAYS.toLocaleString('en-US')} (ten years)`, value: st.days }, (_, value) => {
        if (Number.isFinite(value)) { st.days = Math.min(Math.max(Math.round(value), 1), MAX_DAYS); on.redraw(); }
    });
    days.querySelector('.ctl')?.append(...CHIPS.map(([label, count]) => h('button', { type: 'button', class: 'tg2 st-dchip st-dry-chip', 'aria-pressed': String(st.days === count), dataset: { days: String(count) }, onClick: () => { st.days = count; on.redraw(); } }, label)));
    const begin = startOf(ctx.doc);
    const facts = (begin.world?.set?.length ?? 0) + (begin.world?.facts?.length ?? 0);
    const game = ctx.other?.name || ctx.other?.id;
    const date = startDayOf(ctx.doc, ctx.other?.content?.calendar ?? null).date;
    const starts = note('Starts on', game ? `Dates, months and seasons come from the game pack, ${game}.` : 'No game pack is open, so the built-in calendar gives the dates.',
        h('span', { class: 'st-dry-date' }, date ? dateText(date) : 'Not set: the run begins on day 1'),
        h('button', { type: 'button', class: 'lnk', onClick: () => ctx.go('conditions', 'start') }, 'Start ›'));
    const begins = note('Begins with', facts ? `The world’s Start sets ${plural(begin.world?.set?.length ?? 0, 'condition')} and ${plural(begin.world?.facts?.length ?? 0, 'fact')} on the first day.` : 'The world’s Start sets nothing, so the run begins as the pack is written.',
        h('button', { type: 'button', class: 'lnk', onClick: () => ctx.go('conditions', 'start') }, 'Start ›'));
    const label = `Run ${plural(st.days, 'day')}`;
    const run = running
        ? h('button', { type: 'button', class: 'btn2 st-dry-cancel', onClick: on.cancel }, 'Cancel')
        : h('button', { type: 'button', class: 'btn2 pri st-dry-run', disabled: errors.length > 0, onClick: on.run }, label);
    const status = h('small', { class: 'st-dry-status' }, running ? on.progress() : 'Nobody plays: no one is met and nobody travels with the party, so only the world moves. Open templates get no AI answer, so each takes its fallback.');
    const blocked = errors.length && !running
        ? h('div', { class: 'st-dry-blocked', dataset: { level: 'error' } }, h('b', `✕ Fix the ${plural(errors.length, 'problem')} first.`), h('small', 'The dry run reads the pack as a chat would, and a chat does not load a pack with problems. Warnings don’t stop it.'))
        : null;
    const go = first ? h('button', { type: 'button', class: 'lnk st-dry-first', onClick: () => ctx.go(first.part, first.rec, first.field) }, 'Go to the first ›') : null;
    const act = h('div', { class: 'srow wide st-dry-act', dataset: { state: running ? 'running' : 'idle' } }, h('div', { class: 'lb' }, blocked ?? status), h('div', { class: 'ctl' }, run, go));
    const failed = st.error ? h('div', { class: 'srow st-dry-error', dataset: { level: 'error' } }, h('div', { class: 'lb' }, h('b', 'The dry run stopped.'), h('small', st.error))) : null;
    return [seed, tempo, days, starts, begins, act, failed];
}
