// Builds the World and time page's rows from Story Director's stored settings and the feature list; the row keys and words are port/world-keys.js.
import { WORLD_KEYS, WORLD_IDS, fromStored } from '../port/world-keys.js';

const SAME = 'Same switch as Director › ';
// [row key, group, label, extras]: the mock's order. A row the engine has no setting for is not drawn (see the report).
const ROWS = [
  ['world.calendar', 'Calendar', 'Calendar', { hint: 'From the pack, or a preset', tags: ['merged:D4'] }],
  ['world.era', 'Calendar', 'Era', { hint: 'Written before the year', custom: true }],
  ['world.months', 'Calendar', 'Months', { hint: 'Name: days, separated by commas', wide: true, custom: true }],
  ['world.weekdays', 'Calendar', 'Weekdays', { hint: 'Separated by commas; empty for none', wide: true, custom: true }],
  ['world.leapYears', 'Calendar', 'Leap years', { custom: true }],
  ['world.weather', 'Weather', 'Weather comes from', { hint: `${SAME}Weather from the calendar. Rolled from the calendar is on; The story only is off`, tags: ['merged:D7'] }],
  ['world.northIs', 'Map', 'North is', {}],
  ['world.eastIs', 'Map', 'East is', {}],
  ['world.kmPerMapUnit', 'Map', 'Km per map unit', { unit: 'km' }],
  ['world.roadsWind', 'Map', 'Roads wind', { hint: '× the straight line' }],
  ['world.waterAndAirSpeeds', 'Map', 'Water and air speeds', { hint: 'Boats, ships and flights for the era. Land travel comes from the party pace (Bag), not from this' }],
  ['world.clock', 'Time', 'The story clock', { type: 'info', hint: 'Always on, not a switch: dates, deadlines, drift, the cast and the digest use it' }],
  ['world.longestTimeJump', 'Time', 'Longest time jump', { unit: 'story days' }],
  ['world.whileAwayRecapAfterAJump', 'Time', 'While-away recap after a jump of', { unit: 'story hours' }],
  ['world.deadlinesSlipOrLapseAsTi', 'Time', 'Deadlines slip or lapse as time passes', {}],
  ['world.quietAfter', 'Time', 'Quiet after', { hint: 'A thread rests after this long untouched (whichever comes first)', unit: 'replies' }],
  ['world.quietAfterStoryDays', 'Time', 'Quiet after (story days)', { unit: 'story days' }],
  ['world.dueSoon', 'Time', 'Due soon within', { unit: 'story days' }],
  ['world.daysWhole', 'Time', 'Days kept whole', { hint: 'Older days keep a short record', unit: 'days', feature: WORLD_IDS.digest }],
  ['world.daysAll', 'Time', 'Days kept in all', { hint: 'Older ones are dropped', unit: 'days', feature: WORLD_IDS.digest }],
  ['world.remindTheStoryOfTheLastD', 'Time', 'Remind the story of the last day after a time skip', { feature: WORLD_IDS.digest }],
  ['world.worldEvents', 'Time', 'World events', { hint: `${SAME}World events. The world keeps its own news, conditions and events while the story goes on. Off: the story runs as before` }],
  ['world.tempo', 'Time', 'Tempo', { hint: 'How fast the world moves: 2 = seasons last twice as long', feature: WORLD_IDS.events }],
  ['world.directorCalls', 'Time', 'Director calls this game year', { type: 'info', hint: 'Read only. How many times the Director was asked to write something for the world', feature: WORLD_IDS.events }],
];
const TYPES = { choice: 'seg', weather: 'seg', text: 'txt', months: 'txt', bool: 'sw', feature: 'sw', int: 'num', scale: 'num' };

/** Returns the World and time rows: `values` is `sdk.settings('story-director')`, `features` the feature list (the weather and digest switches). */
export function worldRows(values, features = [], calls = 0) {
  const on = id => features.find(f => f.id === id)?.on === true;
  const v = values && typeof values === 'object' ? values : {};
  const rows = [];
  const custom = fromStored('world.calendar', v[WORLD_KEYS['world.calendar'].key]) === 'Custom';
  const hidden = new Set();
  for (const [key, group, label, extra] of ROWS) {
    if (extra.custom && !custom) continue;
    if (extra.feature && !on(extra.feature)) { hidden.add(extra.feature); continue; }
    const def = WORLD_KEYS[key] ?? {};
    const info = extra.type === 'info';
    const type = info ? 'info' : TYPES[def.kind];
    const value = key === 'world.directorCalls' ? String(Number.isInteger(calls) && calls > 0 ? calls : 0) : info ? 'always on' : fromStored(key, def.kind === 'weather' ? on(WORLD_IDS.weather) : def.kind === 'feature' ? on(def.feature) : v[def.key]);
    const base = { key, group, type, label, hint: extra.hint ?? null, value, default: null, options: null, unit: extra.unit ?? null, tags: extra.tags ?? [], wide: extra.wide === true };
    rows.push(def?.labels ? { ...base, options: def.labels } : base);
  }
  // Where rows are hidden because their switch is off, one line says which switch brings them back.
  const note = (key, after, text) => { const at = rows.findIndex(r => r.key === after); rows.splice(at + 1, 0, { key, group: 'Time', type: 'info', label: 'Hidden rows', hint: text, value: '', default: null, options: null, unit: null, tags: [], wide: false }); };
  if (hidden.has(WORLD_IDS.digest)) note('world.digestOff', 'world.dueSoon', 'Days kept whole, Days kept in all and the last-day reminder show when Day digest is on');
  if (hidden.has(WORLD_IDS.events)) note('world.eventsOff', 'world.worldEvents', 'Tempo and Director calls show when World events is on');
  return rows;
}
