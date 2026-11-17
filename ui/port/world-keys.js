// Translates the World and time page's row keys and shown words to the real settings (Story Director's namespaced keys, one feature) and back.

/** The module the settings sit under and the two features the page reads. */
export const WORLD_IDS = Object.freeze({ director: 'story-director', weather: 'story-director.weather', digest: 'story-director.digest' });

const pair = (...list) => ({ labels: list.map(p => p[1]), values: list.map(p => p[0]) });
const num = key => ({ key, kind: 'int' });
const text = key => ({ key, kind: 'text' });
const flag = key => ({ key, kind: 'bool' });
const choice = (key, ...list) => ({ key, kind: 'choice', ...pair(...list) });
// The map's two scale settings are stored as text, as the old page stores them.
const scale = key => ({ key, kind: 'scale' });

/** The page's row key → how it is stored: `key` is the setting under story-director (null: the weather feature). */
export const WORLD_KEYS = Object.freeze({
  'world.calendar': choice('tracker.calendar.preset', ['pack', 'From the pack'], ['gregorian', 'Gregorian'], ['custom', 'Custom']),
  'world.era': text('tracker.calendar.era'),
  'world.months': { key: 'tracker.calendar.months', kind: 'months' },
  'world.weekdays': text('tracker.calendar.week'),
  'world.leapYears': flag('tracker.calendar.leapYears'),
  'world.weather': { key: null, kind: 'weather', ...pair([true, 'Rolled from the calendar'], [false, 'The story only']) },
  'world.northIs': choice('atlas.map.north', ['up', 'Up'], ['down', 'Down']),
  'world.eastIs': choice('atlas.map.east', ['right', 'Right'], ['left', 'Left']),
  'world.kmPerMapUnit': scale('atlas.map.kmPerUnit'),
  'world.roadsWind': scale('atlas.map.roadFactor'),
  'world.waterAndAirSpeeds': choice('atlas.map.era', ['pre-modern', 'Old world'], ['modern', 'Modern']),
  'world.longestTimeJump': num('tracker.maxJump'),
  'world.whileAwayRecapAfterAJump': num('time.recapHours'),
  'world.deadlinesSlipOrLapseAsTi': flag('time.lapses'),
  'world.quietAfter': num('tracker.dormantReplies'),
  'world.quietAfterStoryDays': num('tracker.dormantDays'),
  'world.dueSoon': num('tracker.dueSoonDays'),
  'world.daysWhole': num('chronicle.digestDays'),
  'world.daysAll': num('chronicle.digestKeep'),
  'world.remindTheStoryOfTheLastD': flag('chronicle.digestTail'),
});

/** Months as the page shows them: "January: 31, February: 28". */
const monthsText = list => (Array.isArray(list) ? list : []).map(m => `${m?.name}: ${m?.days}`).join(', ');

/** The text back as [{ name, days }], or null when a part is not "Name: Days" with whole days. */
function parseMonths(raw) {
  const parts = String(raw ?? '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const out = parts.map(p => { const at = p.lastIndexOf(':'); return { name: p.slice(0, at).trim(), days: Number(p.slice(at + 1)) }; });
  return out.length && out.every(m => m.name && Number.isInteger(m.days) && m.days >= 1) ? out : null;
}

/** What the page's value `value` for row `uiKey` is in the store (undefined: it cannot be stored). */
export function toStored(uiKey, value) {
  const def = WORLD_KEYS[uiKey];
  if (!def) return undefined;
  if (def.kind === 'choice' || def.kind === 'weather') { const i = def.labels.indexOf(value); return i < 0 ? undefined : def.values[i]; }
  if (def.kind === 'months') return parseMonths(value) ?? undefined;
  if (def.kind === 'scale') return Number.isFinite(value) ? String(value) : undefined;
  if (def.kind === 'int') return Number.isInteger(value) ? value : undefined;
  if (def.kind === 'bool') return typeof value === 'boolean' ? value : undefined;
  return typeof value === 'string' ? value : undefined;
}

/** The value the page shows for the stored `stored` (the weather feature's state for the weather row). */
export function fromStored(uiKey, stored) {
  const def = WORLD_KEYS[uiKey];
  if (def.kind === 'choice' || def.kind === 'weather') { const i = def.values.indexOf(stored); return i < 0 ? null : def.labels[i]; }
  if (def.kind === 'months') return monthsText(stored);
  if (def.kind === 'scale') { const n = Number(stored); return Number.isFinite(n) ? n : null; }
  return stored ?? null;
}
