// Builds the trip card and one-line trip summary, and words travel times (8-hour travel days, no half-day rounding).
import { h } from '../../kit/dom.js';

const DAY_HOURS = 8;
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Words a duration in minutes: hours and minutes within a travel day, days and nights on the road beyond it. */
export function timeWords(minutes) {
  const min = Math.round(Number(minutes) || 0);
  if (min <= DAY_HOURS * 60) {
    const hours = Math.floor(min / 60);
    const rest = min % 60;
    return [hours ? plural(hours, 'hour') : '', rest ? plural(rest, 'minute') : ''].filter(Boolean).join(' ') || '0 minutes';
  }
  let days = Math.floor(min / (DAY_HOURS * 60));
  let hours = Math.round((min - days * DAY_HOURS * 60) / 60);
  if (hours >= DAY_HOURS) {
    days += 1;
    hours = 0;
  }
  const nights = Math.ceil(min / (DAY_HOURS * 60)) - 1;
  return plural(days, 'day') + (hours ? ` and ${plural(hours, 'hour')}` : '')
    + (nights ? ` · ${nights > 1 ? `${nights} nights` : 'night'} on the road` : '');
}

function parseClock(text) {
  const m = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(String(text ?? ''));
  if (!m) return null;
  return ((Number(m[1]) % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0)) * 60 + Number(m[2]);
}

function clockWords(total) {
  const hour = Math.floor(total / 60) % 24;
  const minute = Math.round(total % 60);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}

const destination = trip => trip.legs[trip.legs.length - 1]?.to ?? 'the destination';
const STATE_WORDS = { planned: 'planned', road: 'on the road', arrived: 'arrived' };

/** Builds the one-line trip summary shown above the map on narrow screens, or null without a trip. */
export function tripSummary(trip) {
  if (!trip || !Array.isArray(trip.legs) || !trip.legs.length) return null;
  return h(
    'div',
    { class: 'tripsum', dataset: { trip: 'summary' } },
    h('b', null, `Trip to ${destination(trip)} · ${STATE_WORDS[trip.state] ?? trip.state}`),
    h('span', null, [`${trip.legs.length} ${trip.legs.length === 1 ? 'leg' : 'legs'}`, trip.mode, trip.arrive ? `arrive ${trip.arrive.replace(/^about /, '')}` : null].filter(Boolean).join(' · ')),
  );
}

function legRow(leg, index, status, eta, rpg) {
  return h(
    'div',
    { class: ['leg', status], dataset: { leg: index + 1 } },
    h('span', { class: 'n' }, index + 1),
    h('span', null,
      h('b', null, `${leg.from} → ${leg.to}`),
      h('small', null, [leg.km ? `${leg.km} km` : null, timeWords(leg.minutes), [leg.note, rpg ? leg.risk : null].filter(Boolean).join(', ')].filter(Boolean).join(' · '))),
    h('span', { class: 'eta' }, eta),
  );
}

/** Builds the trip card (legs, progress, arrival) from the world's trip; `side` styles it for the wide layout. Null without a trip. */
export function tripCard(trip, { side = false, rpg = true } = {}) {
  if (!trip || !Array.isArray(trip.legs) || !trip.legs.length) return null;
  const road = trip.state === 'road';
  const arrived = trip.state === 'arrived';
  const total = trip.legs.reduce((sum, leg) => sum + (Number(leg.minutes) || 0), 0);
  const doneCount = arrived ? trip.legs.length : (road ? trip.legs.length - 1 : 0);
  const doneMin = trip.legs.slice(0, doneCount).reduce((sum, leg) => sum + (Number(leg.minutes) || 0), 0);
  const pct = total ? Math.round((doneMin / total) * 100) : 0;
  const km = trip.legs.reduce((sum, leg) => sum + (Number(leg.km) || 0), 0);
  const start = parseClock(trip.leave);
  let elapsed = 0;
  const rows = trip.legs.map((leg, i) => {
    elapsed += Number(leg.minutes) || 0;
    const status = i < doneCount ? 'done' : (road && i === doneCount ? 'cur' : '');
    const eta = status === 'done' ? 'done' : (status === 'cur' ? 'now' : (start === null ? `after ${timeWords(elapsed)}` : clockWords(start + elapsed)));
    return legRow(leg, i, status, eta, rpg);
  });
  const pace = [trip.mode, trip.pace].filter(Boolean).join(', ');
  const target = [destination(trip), trip.arriveOn, trip.arrive?.replace(/^about /, '')].filter(Boolean).join(', ');
  const when = arrived ? h('span', null, `Arrived ${trip.arrive ?? ''}`.trim())
    : h('span', null,
      `${road ? 'Set out' : 'Leave'} ${trip.leave ?? 'soon'}${!road && trip.leaveNote ? `, ${trip.leaveNote}` : ''}${pace ? ` · ${pace}` : ''}`,
      trip.arrive ? [' · arrive ', h('b', null, target)] : null);
  return h(
    'section',
    { class: ['card', 'glass', 'tripc', side ? 'side' : null], dataset: { card: 'trip' } },
    h('div', { class: 'th' },
      h('b', null, `Trip to ${destination(trip)}`),
      h('small', null, road ? `on the road · leg ${doneCount + 1} of ${trip.legs.length}` : (arrived ? 'arrived' : 'planned · not set out'))),
    h('div', { class: 'last' }, when),
    h('div', { class: 'tbar', role: 'img', 'aria-label': `Trip progress ${pct}%` },
      h('i', null, h('b', { style: { width: `${pct}%` } })),
      h('small', null, road || arrived ? `${pct}% done` : `0 of ${km} km`)),
    rows,
  );
}
