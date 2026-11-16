// Turns recorded Director query answers into the Journal tab view-model (gaps come back null, empty or zero).

// Reads: director.threads (SD/tracker/domain.js:346), director.goal (SD/screens/queries.js:72), director.world (SD/world/known.js:399),
// director.world.leads (SD/world/index.js:52), director.journal (SD/world/journal.js:284), director.calendar (SD/tracker/domain.js:340),
// director.time (SD/tracker/domain.js:322). `read(name, args)` returns the recorded answer, or null/undefined when the query is absent.

const list = value => (Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : []);
const text = value => (typeof value === 'string' ? value.trim() : '');
const strings = value => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
const asNumber = value => (Number.isFinite(value) ? value : 0);
const isOffer = thread => Boolean(thread.offer) && !thread.taken;

// A tracker outcome (SD/tracker/convert.js:18) as the Journal's closed outcome; an unknown word is left out.
const OUTCOMES = { done: 'done', failed: 'failed', abandoned: 'gaveup', declined: 'declined', superseded: 'lapsed' };
const KIND_WORDS = { quest: 'quest due', event: 'event you heard of', hook: 'event you heard of', holiday: 'holiday' };
const GLYPHS = { quest: '⚑', event: '✦', hook: '✦', holiday: '✧' };

// The month and day a date text names on this calendar ("Goldwane 12", "CY 611, Goldwane 12"), else null.
function parseDate(when, months) {
  const line = text(when).toLowerCase();
  for (let i = 0; i < months.length; i += 1) {
    const name = months[i].name.toLowerCase();
    const at = line.indexOf(name);
    if (at < 0) continue;
    const day = /^\s*(\d+)/.exec(line.slice(at + name.length));
    if (day) return { month: i, day: Number(day[1]) };
  }
  return null;
}

// The calendar of the current year, or null while the config or the story clock is missing. firstWeekday comes from director.time's firstWeekdays (0 when it has none).
export function calendarOf(config, time) {
  const parts = time?.parts;
  const months = list(config?.months);
  if (!months.length || !parts || !Number.isInteger(parts.month) || !Number.isInteger(parts.day)) return null;
  return {
    months: months.map((m, i) => ({ name: text(m.name), length: asNumber(m.days), firstWeekday: weekdayAt(time.firstWeekdays, i), year: asNumber(parts.year) })),
    weekdays: (Array.isArray(config.week) ? config.week : []).map(name => ({ short: text(name).slice(0, 1), name: text(name) })),
    era: text(config.era),
    today: { month: parts.month - 1, day: parts.day },
    start: null, // set by selectJournal from the oldest day the Journal knows
  };
}

const weekdayAt = (list, i) => (Array.isArray(list) && Number.isInteger(list[i]) && list[i] >= 0 ? list[i] : 0);

const groupOf = row => (row.overdue ? 'late' : row.inDays <= 1 ? 'soon' : row.inDays <= 7 ? 'week' : 'later');

function upcomingOf(world, months) {
  return list(world?.upcoming).map(row => {
    const at = parseDate(row.when, months) ?? { month: 0, day: 0 };
    const group = groupOf(row);
    const tone = group === 'late' ? 'bad' : row.kind === 'quest' && group !== 'later' ? 'warn' : 'info';
    return {
      group, name: text(row.name), date: text(row.when), month: at.month, day: at.day, rel: text(row.label),
      kind: KIND_WORDS[row.kind] ?? text(row.kind), glyph: GLYPHS[row.kind] ?? '✦', tone,
    };
  });
}

function dueOf(thread, upcoming) {
  const row = upcoming.find(u => u.kind === 'quest due' && u.name === text(thread.key));
  if (row) return { date: row.date, rel: row.rel, state: row.group === 'late' ? 'late' : row.group === 'soon' ? 'soon' : '' };
  const due = text(thread.fields?.due);
  return due ? { date: due, rel: '', state: '' } : null;
}

// xp and the planned trip are GAPs (nothing stores a quest's XP; the story describes it); steps come from the thread's trail, difficulty from its label.
const DIFFICULTIES = ['easy', 'normal', 'hard'];
function questOf(thread, rpg, upcoming) {
  const fields = thread.fields ?? {};
  const step = text(fields.step);
  const trail = strings(thread.steps);
  const steps = trail.length ? trail : step ? [step] : [];
  const difficulty = text(fields.difficulty).toLowerCase();
  return {
    id: text(thread.id), title: text(thread.key), summary: text(fields.goal) || text(thread.summary),
    step, stepIndex: Math.max(0, steps.length - 1), stepCount: steps.length, steps,
    giver: { personId: null, name: text(fields.giver) },
    due: dueOf(thread, upcoming), place: text(fields.place) || null, trip: null,
    reward: rpg ? text(fields.reward) || null : null, xp: null, difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : null,
  };
}

function dayOf(day, months, today) {
  const at = parseDate(day.date, months) ?? { month: today, day: 0 };
  const short = text(day.short);
  const date = text(day.date);
  return {
    month: at.month, day: at.day, date, line: short ? `${date}: ${short}` : date,
    happened: strings(day.happened),
    places: [], quests: { taken: [], done: [], failed: [], dropped: [] }, fights: 0, money: { in: null, out: null }, // GAP: not in the day entry
    stageMoves: [], // GAP: structured stage moves
    met: strings(day.met),
    world: strings(day.world),
  };
}

export function selectJournal(read, opts = {}) {
  const rpg = opts.rpg !== false;
  const world = read('director.world', {});
  const calendar = calendarOf(read('director.calendar', {}), read('director.time', {}));
  const months = calendar?.months ?? [];
  const upcoming = upcomingOf(world, months);
  const open = list(read('director.threads', { kind: 'quest', status: 'active', open: true })).filter(t => !isOffer(t));
  const goalId = text(read('director.goal', {})?.id);
  const wanted = text(opts.focusId);
  const focusId = [wanted, goalId].find(id => id && open.some(t => t.id === id)) ?? null;
  const quests = open.map(t => questOf(t, rpg, upcoming)).sort((a, b) => (b.id === focusId) - (a.id === focusId));
  const closed = list(read('director.threads', { kind: 'quest', status: 'resolved' })).reverse().flatMap(t => {
    const outcome = OUTCOMES[t.ended?.outcome];
    return outcome ? [{ title: text(t.key), outcome, detail: text(t.ended?.reason), paid: null }] : [];
  });
  const leads = list(read('director.world.leads', {})?.rows).map(r => ({ title: text(r.name), from: '', where: text(r.where), lapses: text(r.lapses) }));
  const journal = read('director.journal', {});
  const days = journal?.on === true ? list(journal.days).map(d => dayOf(d, months, calendar?.today.month ?? 0)) : [];
  // The story's start: the oldest day the Journal knows (days run newest first).
  const first = days.at(-1);
  if (calendar && first) calendar.start = { month: first.month, day: first.day };
  return { rpg, quests, focusId, leads, closed, calendar, days, planned: [], upcoming };
}
