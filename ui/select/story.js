// Turns recorded Director and data-module query answers into the Story tab view-model (gaps come back null, empty or false).

// Reads: pulse.view (SD/screens/director.js:128), director.arc (SD/arc/domain.js:88), director.plan (SD/screens/queries.js:314),
// director.cast.counts (SD/cast/queries.js:60), ripples.sway (SD/ripples/index.js:362), dataModules.setup (SB/data-modules/part/factory.js:60),
// dataModules.view (SB/data-modules/part/views.js:51). `read(name, args)` returns the recorded answer, or null/undefined when the query is absent.

import { BLOCK_STARTERS } from '../../modules/data-modules/block-starters.js';

const MODES = ['off', 'quiet', 'lively'];
const list = value => (Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : []);
const text = value => (typeof value === 'string' ? value.trim() : '');
const number = value => (Number.isFinite(value) ? value : 0);

// Plan-gated lists carry their count always and their items only while the plan is shown (spoilers, decision 36.1).
const gate = (rows, shown, make) => ({ count: rows.length, items: shown ? rows.map(make) : [] });

function pulseOf(view, shown) {
  if (!view || typeof view !== 'object') return { mode: 'off', quiet: false, latest: null, recent: [] };
  const now = view.now && typeof view.now === 'object' ? view.now : null;
  const quiet = view.quiet === true;
  const roll = now && !now.skipped && Number.isFinite(Number(now.die)) ? Number(now.die) : null;
  return {
    mode: MODES.includes(view.mode) ? view.mode : 'lively',
    quiet,
    latest: now && !quiet ? { roll, kind: shown ? text(now.label) || null : null, cause: shown ? text(now.effect) || text(now.text) || null : null } : null,
    recent: list(view.recent).map(row => {
      const skipped = row.skipped === true;
      const open = shown || skipped;
      return {
        skipped,
        roll: skipped || row.die === undefined || row.die === null ? null : String(row.die),
        kind: open ? text(row.label) : 'Rolled',
        text: open ? text(row.text) : '',
        effect: shown ? text(row.effect) || null : null,
      };
    }),
  };
}

// accepted: no query gives the accept date, so null. The plan text is the arc's own and shows only with the plan.
function arcOf(view, shown) {
  const current = view?.current && typeof view.current === 'object' ? view.current : null;
  if (!current || !shown) return { accepted: null, plan: null };
  const beats = current.beats ?? {};
  return { accepted: null, plan: { title: text(current.key), text: text(current.desc), summary: `${number(beats.done)} of ${number(beats.total)} beats` } };
}

// A beat is "ready" while its row carries a `now` field; its `when` is the on/place condition (the plan row only has those fields).
const beatOf = row => ({
  title: text(row.key), state: text(row.fields?.now) ? 'ready' : 'wait', text: text(row.summary),
  when: text(row.fields?.on) || text(row.fields?.place), personId: null,
});
const clockOf = row => ({
  title: text(row.key), text: text(row.summary), due: text(row.fields?.due),
  shown: ['sign', 'warning'].includes(row.fields?.shown) ? row.fields.shown : 'none',
});
const hookOf = row => ({ title: text(row.key), text: text(row.summary), when: text(row.fields?.on) });
// who and whoId are GAPs (the plan row names no owner); toldThisReply is the plan row's `told`; the step line reads "step 2 of 3 · since Goldwane 12".
const agendaOf = row => ({
  title: text(row.key), who: '', whoId: null, text: text(row.summary), step: number(row.steps?.at), of: number(row.steps?.of),
  since: text(String(row.steps?.line ?? '').split('· since ')[1]), place: text(row.steps?.place) || text(row.fields?.where),
  next: text(row.fields?.then), why: '', toldThisReply: row.told === true,
});
// An open secret is told by its name alone (behindThread, queries.js:269); the person is whose stored dossier holds a secret of that title (people.secretOwners), else null.
const secretOf = owners => row => {
  const owner = owners?.[text(row.key).toLowerCase()];
  return { title: text(row.key), text: '', state: 'held', personId: owner?.id ?? null, ...(owner?.name ? { person: owner.name } : {}) };
};

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

function fieldsOf(definition, view) {
  const state = definition?.state ?? {};
  return Object.entries(view?.chat ?? {}).map(([key, value]) => {
    const spec = state[key] && typeof state[key] === 'object' ? state[key] : {};
    const label = text(spec.label) || key;
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
function trackersOf(read) {
  const trackers = [];
  let hidden = 0;
  for (const row of list(read('dataModules.setup', {})).filter(r => r.pinned === true)) {
    const definition = row.pinnedDefinition ?? row.definition;
    const view = definition?.scope === 'chat' ? read('dataModules.view', { module: row.module }) : null;
    const fields = fieldsOf(definition, view);
    if (!fields.length) { hidden += 1; continue; }
    trackers.push({ id: text(row.module), name: text(definition?.name) || text(row.module), showOnNow: Boolean(definition?.show?.card), removable: row.packId === 'chat', fields });
  }
  return { trackers, trackersHidden: hidden };
}

export function selectStory(read, opts = {}) {
  const shown = opts.planShown === true;
  const plan = read('director.plan', {}) ?? {};
  const sway = list(read('ripples.sway', {}));
  return {
    plan: { shown },
    pulse: pulseOf(read('pulse.view', {}), shown),
    arc: arcOf(read('director.arc', {}), shown),
    beats: gate(list(plan.beats), shown, beatOf),
    clocks: gate(list(plan.clocks), shown, clockOf),
    hooks: gate(list(plan.hooks), shown, hookOf),
    newsOnWay: gate([], shown, x => x), // GAP: no query lists news still on the road
    agendas: gate(list(plan.agendas), shown, agendaOf),
    cast: castOf(read('director.cast.counts', {})),
    secrets: gate(list(plan.secrets), shown, secretOf(read('people.secretOwners', {}))),
    ripples: gate(sway, shown, row => ({ name: text(row.name), sway: number(row.sway) })),
    ...trackersOf(read),
    trackerTemplates: BLOCK_STARTERS.map(({ id, name, about }) => ({ id, name, about })),
  };
}
