// Turns recorded Director and data-module query answers into the Story tab view-model (gaps come back null, empty or false).

// Reads: pulse.view (SD/screens/director.js:128), director.arc (SD/arc/domain.js:88), director.plan (SD/screens/queries.js:314),
// director.cast.counts (SD/cast/queries.js:60), ripples.sway (SD/ripples/index.js:362), dataModules.setup (SB/data-modules/part/factory.js:60),
// dataModules.view (SB/data-modules/part/views.js:51), chronicle.events (news on the road), people.list (an agenda's owner). `read(name, args)` returns the recorded answer, or null/undefined when the query is absent.

import { BLOCK_STARTERS } from '../../modules/data-modules/block-starters.js';
import { makeCalendar } from '../../modules/time/calendar.js';

const MODES = ['off', 'quiet', 'lively'];
const list = value => (Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : []);
const text = value => (typeof value === 'string' ? value.trim() : '');
const number = value => (Number.isFinite(value) ? value : 0);

// Plan-gated lists carry their count always and their items only while the plan is shown (spoilers, decision 36.1).
const gate = (rows, shown, make) => ({ count: rows.length, items: shown ? rows.map(make) : [] });

// A pulse line begins with its own kind ("mundane interruption (noticed): the narrator invents it") that the row's title already says:
// shown once, "the narrator invents it · noticed".
function afterKind(kind, line) {
  const words = text(kind).toLowerCase();
  const said = text(line);
  if (!words || !said.toLowerCase().startsWith(words)) return said;
  const rest = /^\s*(?:\(([^)]*)\))?\s*:?\s*([\s\S]*)$/.exec(said.slice(words.length));
  return rest?.[2] ? `${rest[2]}${rest[1] ? ` · ${rest[1]}` : ''}` : said;
}

function pulseOf(view, shown) {
  if (!view || typeof view !== 'object') return { mode: 'off', quiet: false, latest: null, recent: [] };
  const now = view.now && typeof view.now === 'object' ? view.now : null;
  const quiet = view.quiet === true;
  const roll = now && !now.skipped && Number.isFinite(Number(now.die)) ? Number(now.die) : null;
  return {
    mode: MODES.includes(view.mode) ? view.mode : 'lively',
    quiet,
    latest: now && !quiet ? { roll, kind: shown ? text(now.label) || null : null, cause: shown ? text(now.effect) || afterKind(now.label, now.text) || null : null } : null,
    recent: list(view.recent).map(row => {
      const skipped = row.skipped === true;
      const open = shown || skipped;
      return {
        skipped,
        roll: skipped || row.die === undefined || row.die === null ? null : String(row.die),
        kind: open ? text(row.label) : 'Rolled',
        text: open ? afterKind(row.label, row.text) : '',
        effect: shown ? text(row.effect) || null : null,
      };
    }),
  };
}

// accepted: the date the current arc was accepted ('' when its time is unknown, null when no arc is running). The plan text is the arc's own and shows only with the plan.
// draft: the plan that waits for Accept or Discard (its text only with the plan shown); busy: the planner is being asked; error: why the last ask failed.
function arcOf(view, shown, calendar, status) {
  // (an arc the reader ended is over: the card shows no plan, no beats and no End button for it)
  const current = view?.current && typeof view.current === 'object' && view.current.active !== false ? view.current : null;
  const waiting = status?.draft && typeof status.draft === 'object' ? status.draft : null;
  const base = {
    accepted: current?.active ? acceptedOn(current.minutes, calendar) : null,
    draft: waiting ? { reason: text(waiting.reason), text: shown ? text(waiting.text) : '' } : null,
    busy: status?.busy === true, error: text(status?.error), open: Boolean(current),
  };
  if (!current || !shown) return { ...base, plan: null };
  const beats = current.beats ?? {};
  return { ...base, plan: { title: text(current.key), text: text(current.desc), summary: `${number(beats.done)} of ${number(beats.total)} beats` } };
}

function acceptedOn(minutes, config) {
  if (!Number.isSafeInteger(minutes)) return '';
  try { return makeCalendar(config).format(minutes); } catch { return ''; }
}

// A beat is "ready" while its row carries a `now` field; its `when` is the on/place condition (the plan row only has those fields).
const beatOf = row => ({
  title: text(row.key), state: text(row.fields?.now) ? 'ready' : 'wait', text: text(row.summary),
  when: text(row.fields?.on) || text(row.fields?.place), personId: null,
});
const clockOf = row => ({
  title: text(row.key), text: text(row.summary), due: text(row.fields?.due),
  shown: ['sign', 'warning'].includes(row.fields?.shown) ? row.fields.shown : 'none', overdue: row.overdue === true,
});
const hookOf = row => ({ title: text(row.key), text: text(row.summary), when: text(row.fields?.on) });
// An agenda is kept under its owner's name (the key), so `who` is the stored person of that name or alias (people.list), else '' and no id; toldThisReply is the plan row's `told`; the step line reads "step 2 of 3 · since Goldwane 12".
const ownerOf = people => row => {
  const key = text(row.key).toLowerCase();
  return list(people).find(p => [p.name, ...(Array.isArray(p.aliases) ? p.aliases : [])].some(n => text(n).toLowerCase() === key)) ?? null;
};
const agendaOf = owner => row => ({
  title: text(row.key), who: text(owner(row)?.name), whoId: text(owner(row)?.id) || null, text: text(row.summary), step: number(row.steps?.at), of: number(row.steps?.of),
  since: text(String(row.steps?.line ?? '').split('· since ')[1]), place: text(row.steps?.place) || text(row.fields?.where),
  next: text(row.fields?.then), why: '', toldThisReply: row.told === true,
});
// An open secret is told by its name alone (behindThread, queries.js:269); the person is whose stored dossier holds a secret of that title (people.secretOwners), else null.
const secretOf = owners => row => {
  const owner = owners?.[text(row.key).toLowerCase()];
  return { title: text(row.key), text: '', state: 'held', personId: owner?.id ?? null, ...(owner?.name ? { person: owner.name } : {}) };
};

// News still on the road: the open world-pulse rumours the story has not told yet (chronicle.events rows with `rumour` and no `heard`); it reaches the event's place, "rumour since <date>".
const onTheRoad = rows => list(rows).filter(row => typeof row.rumour === 'string' && row.heard !== true).map(row => ({
  title: text(row.name), text: text(row.summary), reaches: text(row.place), how: ['rumour', text(row.sinceText) && `since ${text(row.sinceText)}`].filter(Boolean).join(' '),
}));

function castOf(counts) {
  if (!counts || typeof counts !== 'object') return { total: 0, met: 0, unmet: 0, lastMoved: null };
  return { total: number(counts.total), met: number(counts.met), unmet: number(counts.unmet), lastMoved: null };
}

// One chat-scope module's fields (dataModules.view → { chat: { name: value } }; the types are the block's `state`): an int with a max is a bar.
// `key` is the field's name for dm.set; `edit` says how Edit changes it by hand (number, text or choice), none for a locked, list or map field.
function editOf(spec, value) {
  if (spec.edit === false || spec.list === true) return null;
  if (spec.type === 'int' && Number.isFinite(value)) return { edit: 'number', min: Number.isFinite(spec.min) ? spec.min : 0, max: Number.isFinite(spec.max) ? spec.max : null };
  if (spec.type === 'text' && typeof value === 'string') return { edit: 'text', max: Number.isFinite(spec.max) ? spec.max : null };
  if (spec.type === 'enum' && Array.isArray(spec.values) && spec.values.includes(value)) return { edit: 'choice', options: spec.values.map(String) };
  return null;
}

// A record value (standing by faction, fame by region) as one line: the entries that are not 0, "highmark +2 · guild 1", or "all 0"; a list as its items (owner, 20 Nov: it showed [object Object]).
function recordWords(value) {
  if (Array.isArray(value)) return value.map(item => (item && typeof item === 'object' ? recordWords(item) : String(item))).join(', ') || 'none';
  const rows = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== 0 && v !== '' && v !== false);
  if (!rows.length) return 'all 0';
  return rows.map(([k, v]) => `${k} ${v && typeof v === 'object' ? recordWords(v) : v}`).join(' · ');
}

function fieldsOf(definition, view) {
  const state = definition?.state ?? {};
  return Object.entries(view?.chat ?? {}).map(([key, value]) => {
    const spec = state[key] && typeof state[key] === 'object' ? state[key] : {};
    const label = text(spec.label) || key;
    if (value && typeof value === 'object') return { label, key, value: recordWords(value), kind: 'text' };
    const shown = spec.names && Object.hasOwn(spec.names, String(value)) ? spec.names[String(value)] : String(value);
    const edit = editOf(spec, value);
    const base = { label, key, value: shown, ...(edit ? { raw: String(value), ...edit } : {}) };
    if (spec.type === 'int' && Number.isFinite(value) && Number.isFinite(spec.max)) {
      const min = Number.isFinite(spec.min) ? spec.min : 0;
      const pct = spec.max > min ? Math.round(((value - min) / (spec.max - min)) * 100) : 0;
      return { ...base, kind: 'bar', pct: Math.max(0, Math.min(100, pct)) };
    }
    return { ...base, kind: typeof value === 'number' ? 'number' : 'text' };
  });
}

// Pinned chat blocks only. The active (pinned) definition is the one in force; `show.card` is Show on Now. A block with no field to draw is counted as hidden.
// The RPG's own blocks (a definition with a `role`: Character, Skills, Foes, its rules) are not trackers: Party and the fight board show them.
function trackersOf(read) {
  const trackers = [];
  let hidden = 0;
  for (const row of list(read('dataModules.setup', {})).filter(r => r.pinned === true)) {
    const definition = row.pinnedDefinition ?? row.definition;
    if (text(definition?.role)) continue;
    const view = definition?.scope === 'chat' ? read('dataModules.view', { module: row.module }) : null;
    const fields = fieldsOf(definition, view);
    if (!fields.length) { hidden += 1; continue; }
    trackers.push({ id: text(row.module), name: text(definition?.name) || text(row.module), showOnNow: Boolean(definition?.show?.card), removable: row.packId === 'chat', fields });
  }
  return { trackers, trackersHidden: hidden };
}

// The one plain line the plan shows when it has nothing to draw: with the Threads switch off, the switch (only while the plan is shown); else, hidden
// or shown, that the Director has not planned yet (no arc and no thread; it names no part of a plan). '' when there are cards or their counts.
const NO_PLAN = 'The Director has no plan yet; it plans after the opening.';
const THREADS_OFF = 'Beats, clocks, off-screen agendas and secrets are off. Turn on Story Director’s Threads switch in Settings › Director to see them.';
const noteOf = (shown, threadsOn, parts, hasArc) => (!threadsOn ? (shown ? THREADS_OFF : '') : hasArc || parts.some(group => group.count > 0) ? '' : NO_PLAN);

export function selectStory(read, opts = {}) {
  const shown = opts.planShown === true;
  const plan = read('director.plan', {}) ?? {};
  const sway = list(read('ripples.sway', {}));
  const beats = gate(list(plan.beats), shown, beatOf), clocks = gate(list(plan.clocks), shown, clockOf), hooks = gate(list(plan.hooks).filter(row => row.planned !== false), shown, hookOf);
  const newsOnWay = gate(onTheRoad(read('chronicle.events', { open: true })), shown, x => x);
  const agendas = gate(list(plan.agendas), shown, agendaOf(ownerOf(read('people.list', {}))));
  const secrets = gate(list(plan.secrets), shown, secretOf(read('people.secretOwners', {})));
  const arcView = read('director.arc', {});
  // (a plan waiting for Accept is a plan: the card does not also say there is none)
  const hasArc = Boolean(arcView?.current && typeof arcView.current === 'object') || Boolean(opts.arcStatus?.draft);
  return {
    plan: { shown, note: noteOf(shown, opts.threadsOn !== false, [beats, clocks, hooks, newsOnWay, agendas, secrets], hasArc), off: opts.directorOn === false },
    pulse: pulseOf(read('pulse.view', {}), shown),
    arc: arcOf(arcView, shown, read('director.calendar', {}), opts.arcStatus),
    beats, clocks, hooks, newsOnWay, agendas,
    cast: castOf(read('director.cast.counts', {})),
    secrets,
    ripples: gate(sway, shown, row => ({ name: text(row.name), sway: number(row.sway) })),
    ...trackersOf(read),
    trackerTemplates: BLOCK_STARTERS.map(({ id, name, about }) => ({ id, name, about })),
  };
}
