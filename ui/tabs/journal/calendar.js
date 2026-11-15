// Builds the Calendar card: search, month grid with a month and year picker, and the picked day beside or below it.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { dayPanel, dayRecord, dueOn } from './day.js';

const LEGEND = [['rec', 'a day you have a record of'], ['warn', 'quest due'], ['info', 'event'], ['bad', 'overdue']];

function cmp(a, b) {
  return a.month - b.month || a.day - b.day;
}

function dayText(d) {
  const q = d.quests ?? {};
  const parts = [d.date, d.line, ...(d.happened ?? []), ...(d.places ?? []), ...(q.taken ?? []), ...(q.done ?? []), ...(q.failed ?? []), ...(q.dropped ?? []), ...(d.met ?? []), ...(d.world ?? [])];
  for (const s of d.stageMoves ?? []) parts.push(s.who, s.meter, s.from, s.to);
  return parts.join(' ').toLowerCase();
}

function pb(label, text, disabled, onClick) {
  return h('button', { type: 'button', class: 'pb', 'aria-label': label, disabled, onClick }, text);
}

function dayCell(journal, state, month, day) {
  const cal = journal.calendar;
  const here = { month, day };
  const c = cmp(here, cal.today);
  const pre = cal.start && cmp(here, cal.start) < 0;
  const rec = dayRecord(journal, month, day);
  const due = dueOn(journal, month, day);
  const dots = [rec ? h('i', { class: 'dot-rec' }) : null, ...due.map(u => h('i', { class: `dot-${u.tone}` }))];
  const name = cal.months[month].name;
  return h(
    'button',
    {
      type: 'button',
      class: ['cd', c === 0 ? 'today' : null, state.sel.month === month && state.sel.day === day ? 'sel' : null, c < 0 ? 'past' : null, pre ? 'pre' : null],
      dataset: { sel: `${month},${day}` },
      'aria-label': `${name} ${day}${rec ? ', a record' : ''}${due.length ? ', something due' : ''}`,
      onClick: () => state.pick(month, day),
    },
    h('b', null, day),
    h('span', { class: 'ds' }, dots),
  );
}

function monthGrid(journal, state) {
  const cal = journal.calendar;
  const m = cal.months[state.month];
  const cells = [];
  for (let i = 0; i < m.firstWeekday; i += 1) cells.push(h('span'));
  for (let d = 1; d <= m.length; d += 1) cells.push(dayCell(journal, state, state.month, d));
  const wds = cal.weekdays.map(w => h('span', { class: 'wd', title: w.name, 'aria-label': w.name }, w.short));
  const legend = LEGEND.map(([k, t]) => h('span', null, h('i', { class: `dot-${k}` }), t));
  return [h('div', { class: 'cgrid' }, wds, cells), h('div', { class: 'clegend' }, legend)];
}

function picker(journal, state) {
  const cal = journal.calendar;
  const years = cal.months.map(m => m.year);
  const [lo, hi] = [Math.min(...years), Math.max(...years)];
  const first = cal.months.findIndex(m => m.year === state.year);
  const perYear = cal.months.filter(m => m.year === state.year).length;
  const tiles = [];
  for (let i = 0; i < perYear; i += 1) {
    const idx = first + i;
    const hasData = journal.days.some(d => d.month === idx) || journal.upcoming.some(u => u.month === idx);
    tiles.push(h('button', {
      type: 'button',
      class: ['mo', idx === state.month ? 'cur' : null, idx === cal.today.month ? 'now' : null, cal.start && idx < cal.start.month ? 'pre' : null],
      dataset: { gotoMonth: idx },
      onClick: () => state.jump(idx),
    }, h('b', null, cal.months[idx].name), hasData ? h('i') : null));
  }
  return h(
    'div',
    { class: 'mpick' },
    h('div', { class: 'ystep' }, pb('Previous year', '‹', state.year <= lo, () => state.setYear(state.year - 1)), h('b', null, `${cal.era} ${state.year}`), pb('Next year', '›', state.year >= hi, () => state.setYear(state.year + 1))),
    h('div', { class: 'mgrid' }, tiles),
    h('p', { class: 'fine' }, 'Months come from the pack’s calendar. Dimmed: before the story began.'),
  );
}

function results(journal, state, query) {
  const hits = journal.days.filter(d => dayText(d).includes(query));
  return h(
    'div',
    { class: 'cal-hits' },
    h('div', { class: 'secl2' }, `Found on ${hits.length} day${hits.length === 1 ? '' : 's'}`),
    hits.length ? hits.map(d => h('button', { type: 'button', class: 'hit', dataset: { sel: `${d.month},${d.day}` }, onClick: () => state.pick(d.month, d.day) }, h('b', null, d.date), h('span', null, d.line))) : h('p', { class: 'fine' }, 'Nothing found.'),
  );
}

/** Builds the Calendar card; the returned element has `selectDay(month, day)` for the Coming up rows. */
export function calendarCard(journal) {
  const cal = journal.calendar;
  const state = { month: cal.today.month, sel: { ...cal.today }, year: cal.months[cal.today.month].year, picking: false, query: '' };
  const body = h('div', { class: 'cal-body' });
  const input = h('input', { class: 'psrch', type: 'search', placeholder: 'Search every day: a place, a quest, a name…', 'aria-label': 'Search the journal' });
  const root = h('section', { class: 'card glass calcard', dataset: { card: 'calendar' } }, input, body);

  function draw() {
    const query = state.query.trim().toLowerCase();
    if (query) {
      body.replaceChildren(results(journal, state, query));
      return;
    }
    const m = cal.months[state.month];
    const off = state.month !== cal.today.month || state.sel.month !== cal.today.month || state.sel.day !== cal.today.day;
    const head = h(
      'div',
      { class: 'mhead' },
      pb('Previous month', '‹', state.month === 0, () => { state.month -= 1; draw(); }),
      h('button', { type: 'button', class: 'mtitle', 'aria-expanded': String(state.picking), dataset: { pick: '1' }, onClick: () => { state.picking = !state.picking; state.year = m.year; draw(); } }, m.name, ' ', h('small', null, `${cal.era} ${m.year}`), ' ', h('i', null, '▾')),
      off ? button({ label: 'Today', className: 'tdy', dataset: { today: '1' }, onClick: () => { state.month = cal.today.month; state.sel = { ...cal.today }; state.picking = false; draw(); } }) : null,
      pb('Next month', '›', state.month >= cal.months.length - 1, () => { state.month += 1; draw(); }),
    );
    const column = h('div', { class: 'calcol' }, head, state.picking ? picker(journal, state) : monthGrid(journal, state));
    body.replaceChildren(h('div', { class: 'calsplit' }, column, h('div', { class: 'dwrap' }, dayPanel(journal, state.sel.month, state.sel.day))));
  }

  state.pick = (month, day) => { state.sel = { month, day }; state.month = month; state.query = ''; state.picking = false; input.value = ''; draw(); };
  state.jump = idx => { state.month = idx; state.picking = false; draw(); };
  state.setYear = y => { state.year = y; draw(); };
  input.addEventListener('input', () => { state.query = input.value ?? ''; draw(); });
  root.selectDay = state.pick;
  draw();
  return root;
}
