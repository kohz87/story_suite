// The People page's list editors: Custom feelings (listed under its row, Add a meter adds one), Per-feeling stages and the Stage ladder (opened
// by their Edit buttons). Each change stores the whole list through the page's onChange (people.<row>, the NPC State key the engine reads),
// then reads the page's rows again (the engine's view of what it uses); the open editors and their lists live as long as the overlay.
import { h } from '../../kit/dom.js';
import { listEditorNodes, patchEditorNodes } from './list-editor.js';

const SECTION = 'people';
const EDITORS = {
  'people.customMeters': {
    noun: 'Meter', max: 6, toggle: false, addLabel: null,
    notUsed: 'Not used: give it a name of its own (not Trust, Affection, Desire, Tension or another meter’s).',
    fields: () => [
      { f: 'name', label: 'Name', kind: 'txt', size: 'grow' }, { f: 'min', label: 'Lowest', kind: 'num' }, { f: 'max', label: 'Highest', kind: 'num' },
      { f: 'start', label: 'Starts at', kind: 'num', placeholder: '0' },
      { f: 'describe', label: 'Rule for the story', kind: 'txt', size: 'wide', placeholder: 'What moves it: rises when…, falls when…' },
      { f: 'bands', label: 'Words instead of the number', kind: 'txt', size: 'wide', placeholder: 'doubtful 25, steady 60, devoted' },
    ],
    fresh: items => ({ name: unique('New meter', items, 'name'), min: 0, max: 100, start: 0, show: 'bar', tone: 'neutral', describe: '', bands: '', drift: null, driftTo: null }),
  },
  'people.perMeterStages': {
    noun: 'Stage', max: 80, toggle: true, addLabel: 'Add a stage',
    notUsed: 'Not used: pick a feeling in use, a name, and a threshold no other stage of that feeling has (eight a feeling at most).',
    fields: list => [{ f: 'meter', label: 'Feeling', kind: 'sel', options: list.meters ?? [] }, { f: 'at', label: 'At', kind: 'num' }, { f: 'name', label: 'Stage', kind: 'txt', size: 'grow' }],
    fresh: (items, list) => {
      const meter = list.meters?.[0] ?? 'Trust';
      const taken = new Set(items.filter(s => s.meter === meter).map(s => s.at));
      return { meter, at: [25, 50, 75, 100, -25, -50, -75, -100].find(n => !taken.has(n)) ?? null, name: unique('New stage', items, 'name') };
    },
  },
  'people.stageLadder': {
    noun: 'Rung', max: 48, toggle: true, addLabel: 'Add a stage',
    notUsed: 'Not used: give it a name of its own and what it needs (“trust 60, affection 40”) or a milestone.',
    fields: () => [
      { f: 'name', label: 'Stage', kind: 'txt', size: 'grow' }, { f: 'needs', label: 'Needs', kind: 'txt', size: 'grow', placeholder: 'trust 60, affection 40' },
      { f: 'milestone', label: 'Milestone', kind: 'txt', size: 'grow', placeholder: 'saved her brother' }, { f: 'track', label: 'Track', kind: 'txt', placeholder: 'everyone' },
    ],
    fresh: items => ({ name: unique('New stage', items, 'name'), needs: 'trust 20', milestone: '', track: '' }),
  },
};

const flag = (el, name, on) => (on ? el.setAttribute(name, '') : el.removeAttribute(name));

function unique(base, items, f) {
  const names = new Set(items.map(x => String(x[f] ?? '').toLowerCase()));
  for (let n = 1; ; n += 1) { const name = n === 1 ? base : `${base} ${n}`; if (!names.has(name.toLowerCase())) return name; }
}

// One overlay's editor state (its ctx object is the same on every paint): open editors, the lists as last read, the last save's failure.
const STATES = new WeakMap();
const peopleRowsOf = settings => settings?.sections?.find(s => s.id === SECTION)?.rows ?? null;
function read(state, rows) {
  for (const key of Object.keys(EDITORS)) { const r = rows?.find(x => x.key === key); if (r?.list) state.lists[key] = structuredClone(r.list); }
}
function stateFor(ctx, section) {
  if (!STATES.has(ctx)) STATES.set(ctx, { open: {}, lists: {}, error: {} });
  const state = STATES.get(ctx);
  read(state, section.rows);
  return state;
}

/** Adds the editors under their rows in the People page `nodes` (the rows' own buttons are replaced by ones this page answers). */
export function attachPeopleLists(nodes, section, ctx) {
  const state = stateFor(ctx, section);
  const boxes = {};
  // The row button's state: Edit's aria-expanded, or Add a meter disabled at six.
  const marks = key => {
    const { box, btn } = boxes[key];
    const def = EDITORS[key];
    if (def.toggle) btn.setAttribute('aria-expanded', String(Boolean(state.open[key])));
    else flag(btn, 'disabled', state.lists[key].items.length >= def.max);
    flag(box, 'hidden', def.toggle && !state.open[key]);
  };
  // The handlers read the list when they run, so two edits in a row both land.
  const on = key => ({
    edit: (i, f, v) => change(key, state.lists[key].items.map((x, j) => (j === i ? { ...x, [f]: v } : x)), false),
    remove: i => change(key, state.lists[key].items.filter((_x, j) => j !== i), true),
    add: () => add(key),
  });
  // A full draw of one editor: on opening it, on Add or Remove, or when a change cannot be made in place.
  const build = key => {
    const { box } = boxes[key];
    const def = EDITORS[key];
    const list = state.lists[key];
    const active = globalThis.document?.activeElement;
    const tag = active && box.contains(active) ? active.dataset?.f : null;
    marks(key);
    box.replaceChildren(...(def.toggle && !state.open[key] ? [] : listEditorNodes({ ...def, fields: def.fields(list) }, list, { max: def.max, error: state.error[key] ?? null, on: on(key) })));
    if (tag) box.querySelector(`[data-f="${tag}"]`)?.focus();
  };
  // A field edit (or another editor's change to this list) changes the drawn editor in place (marks, notes, values the store cleaned, a
  // choice's options), so the field the reader moved to keeps focus and a click lands.
  const settle = key => {
    marks(key);
    const def = EDITORS[key];
    const list = state.lists[key];
    if (def.toggle && !state.open[key]) return;
    if (!patchEditorNodes(boxes[key].box, { ...def, fields: def.fields(list) }, list, state.error[key] ?? null)) build(key);
  };
  const refresh = () => read(state, peopleRowsOf(ctx.view?.('settings')));
  async function change(key, items, structural) {
    state.lists[key] = { ...state.lists[key], items };
    if (structural) build(key);
    let answer;
    try { answer = await ctx.onChange?.(key, items); } catch (error) { answer = { ok: false, message: String(error?.message ?? error) }; }
    state.error[key] = answer?.ok === false ? String(answer.message ?? 'That was not saved.') : null;
    const before = Object.fromEntries(Object.keys(boxes).map(k => [k, JSON.stringify(state.lists[k])]));
    refresh();
    for (const k of Object.keys(boxes)) if (k === key || JSON.stringify(state.lists[k]) !== before[k]) settle(k);
  }
  const add = key => {
    const list = state.lists[key];
    if (list.items.length < EDITORS[key].max) change(key, [...list.items, EDITORS[key].fresh(list.items, list)], true);
  };
  const toggle = key => { state.open[key] = !state.open[key]; if (state.open[key]) refresh(); build(key); };

  for (const key of Object.keys(EDITORS)) {
    const rowEl = nodes.map(n => n?.querySelector?.(`.srow[data-key="${key}"]`)).find(Boolean);
    const old = rowEl?.querySelector('.ctl button');
    if (!old || !state.lists[key]) continue;
    const def = EDITORS[key];
    const id = `sedit-${key.replace('.', '-')}`;
    const btn = h('button', { type: 'button', class: 'btn2', 'aria-controls': id, onClick: () => (def.toggle ? toggle(key) : add(key)) }, old.textContent);
    old.parentNode.insertBefore(btn, old);
    old.remove();
    const box = h('div', { class: 'sedit', id, dataset: { edit: key } });
    rowEl.parentNode.insertBefore(box, rowEl.nextElementSibling);
    boxes[key] = { box, btn };
  }
  for (const key of Object.keys(boxes)) build(key);
  return nodes;
}
