// Builds the day panel for one calendar day: a past day's record, today's plan, or what is due on a later day.
import { h } from '../../kit/dom.js';

/** Days from today to (month, day), counting month lengths from the pack calendar; negative means past. */
export function dayDistance(calendar, month, day) {
  const months = calendar?.months ?? [];
  const today = calendar?.today ?? { month: month, day };
  let diff = day - today.day;
  const step = month >= today.month ? 1 : -1;
  for (let m = today.month; m !== month; m += step) {
    const len = months[step > 0 ? m : m - 1]?.length ?? 30;
    diff += step * len;
  }
  return diff;
}

/** Finds the stored record for a day, or null. */
export function dayRecord(journal, month, day) {
  return (journal?.days ?? []).find(d => d.month === month && d.day === day) ?? null;
}

/** Lists what is due or expected on a day. */
export function dueOn(journal, month, day) {
  return (journal?.upcoming ?? []).filter(u => u.month === month && u.day === day);
}

function relWord(diff) {
  if (diff === 0) return 'today';
  if (diff === -1) return 'yesterday';
  if (diff === 1) return 'tomorrow';
  return diff < 0 ? `${-diff} days ago` : `in ${diff} days`;
}

function row(mark, text, tone) {
  return h('div', { class: 'dl2' }, h('span', { class: ['ic', tone ? `tone-${tone}` : null] }, mark), h('span', null, text), h('small', null));
}

function name(text) {
  return h('span', { class: 'nm' }, text);
}

function section(title, rows) {
  if (!rows.length) return null;
  return h('div', { class: 'dsec', dataset: { sec: title } }, h('div', { class: 'secl' }, title), rows);
}

function recordSections(r) {
  const q = r.quests ?? {};
  const quests = [
    ...(q.taken ?? []).map(n => row('+', ['Took up ', name(n)])),
    ...(q.done ?? []).map(n => row('✓', ['Finished ', name(n)])),
    ...(q.failed ?? []).map(n => row('✕', ['Failed ', name(n)])),
    ...(q.dropped ?? []).map(n => row('–', ['Gave up ', name(n)])),
  ];
  const money = [];
  if (r.money?.in) money.push(row('+', `${r.money.in} in`));
  if (r.money?.out) money.push(row('−', `${r.money.out} out`));
  const fights = r.fights ? [row('⚔', `${r.fights} ${r.fights === 1 ? 'fight' : 'fights'}`)] : [];
  return [
    section('What happened', (r.happened ?? []).map(t => row('•', t))),
    section('Places', (r.places ?? []).map(p => row('→', `Went to ${p}`))),
    section('Quests', quests),
    section('Fights', fights),
    section('Money', money),
    section('Stage moves', (r.stageMoves ?? []).map(s => row('↗', `${s.who} · ${s.meter}: ${s.from} → ${s.to}`))),
    section('Who you met', r.met?.length ? [row('★', r.met.join(', '))] : []),
    section('News', (r.world ?? []).map(n => row('!', ['Heard of ', name(n)]))),
  ];
}

/** Builds the panel for (month, day): header, then the record, plan and due lists in the order that fits past, today or future. */
export function dayPanel(journal, month, day) {
  const cal = journal?.calendar ?? {};
  const m = cal.months?.[month];
  const diff = dayDistance(cal, month, day);
  const weekday = cal.weekdays?.[(((m?.firstWeekday ?? 0) + day - 1) % (cal.weekdays?.length || 7))]?.name ?? '';
  const rec = dayRecord(journal, month, day);
  const due = dueOn(journal, month, day);
  const dueRows = due.map(u => h('div', { class: 'dl2' }, h('span', { class: ['ic', `tone-${u.tone}`] }, u.glyph), h('span', null, h('b', null, u.name), ` · ${u.kind}`), h('small', null)));
  const dueSec = section(diff < 0 ? 'Was due' : 'Due and expected', dueRows);
  const planSec = diff === 0 ? section('Planned', (journal?.planned ?? []).map(p => h('div', { class: 'dl2' }, h('span', { class: 'ic' }, p.glyph), h('span', null, h('b', null, p.title), h('br'), h('small', { class: 'wrap' }, p.detail)), h('small', null)))) : null;
  const recBlock = rec ? [h('p', { class: 'sum2' }, rec.line), ...recordSections(rec)] : [];
  const body = diff <= 0 ? [recBlock, planSec, dueSec] : [dueSec, recBlock];
  const start = cal.start;
  const before = start && (month < start.month || (month === start.month && day < start.day));
  let empty = null;
  if (!rec && !due.length && !planSec) {
    const text = before ? 'Before the story began.' : diff < 0 ? 'Nothing recorded on this day.' : diff === 0 ? 'Nothing yet today.' : 'Nothing known for this day yet.';
    empty = h('p', { class: 'fine' }, text);
  }
  const year = m && m.year !== cal.months?.[cal.today?.month]?.year ? ` · ${cal.era} ${m.year}` : '';
  return h(
    'div',
    { class: 'dpanel', dataset: { month, day } },
    h('div', { class: 'dph' }, h('b', null, `${m?.name ?? ''} ${day}`), h('small', null, `${weekday} · ${relWord(diff)}${year}`)),
    body,
    empty,
  );
}
