// The People page's list editors: Custom meters (listed under its row, Add a meter adds one), Per-meter stages and the Stage ladder (opened
// by their Edit buttons). Each change stores the whole list through the page's onChange (people.<row>, the NPC State key the engine reads),
// then reads the page's rows again (the engine's view of what it uses); the open editors and their lists live as long as the overlay.
import { h } from '../../kit/dom.js';
import { listEditorNodes } from './list-editor.js';

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
    notUsed: 'Not used: pick a meter in use, a name, and a threshold no other stage of that meter has (eight a meter at most).',
    fields: list => [{ f: 'meter', label: 'Meter', kind: 'sel', options: list.meters ?? [] }, { f: 'at', label: 'At', kind: 'num' }, { f: 'name', label: 'Stage', kind: 'txt', size: 'grow' }],
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
  if (!STATES.has(ctx)) { const s = { open: {}, lists: {}, error: {} }; read(s, section.rows); STATES.set(ctx, s); }
  return STATES.get(ctx);
}

/** Adds the editors under their rows in the People page `nodes` (the rows' own buttons are replaced by ones this page answers). */
export function attachPeopleLists(nodes, section, ctx) {
  const state = stateFor(ctx, section);
  const boxes = {};
  const draw = key => {
    const { box, btn } = boxes[key];
    const def = EDITORS[key];
    const list = state.lists[key];
    if (def.toggle) btn.setAttribute('aria-expanded', String(Boolean(state.open[key])));
    else flag(btn, 'disabled', list.items.length >= def.max);
    const active = globalThis.document?.activeElement;
    const tag = active && box.contains(active) ? active.dataset?.f : null;
    const shut = def.toggle && !state.open[key];
    flag(box, 'hidden', shut);
    box.replaceChildren(...(shut ? [] : listEditorNodes({ ...def, fields: def.fields(list) }, list, {
      max: def.max, error: state.error[key] ?? null,
      on: { edit: (i, f, v) => change(key, list.items.map((x, j) => (j === i ? { ...x, [f]: v } : x))), remove: i => change(key, list.items.filter((_x, j) => j !== i)), add: () => add(key) },
    })));
    if (tag) box.querySelector(`[data-f="${tag}"]`)?.focus();
  };
  const drawAll = () => { for (const key of Object.keys(boxes)) draw(key); };
  const refresh = () => read(state, peopleRowsOf(ctx.view?.('settings')));
  async function change(key, items) {
    state.lists[key] = { ...state.lists[key], items };
    let answer;
    try { answer = await ctx.onChange?.(key, items); } catch (error) { answer = { ok: false, message: String(error?.message ?? error) }; }
    state.error[key] = answer?.ok === false ? String(answer.message ?? 'That was not saved.') : null;
    refresh();
    drawAll();
  }
  const add = key => {
    const list = state.lists[key];
    if (list.items.length < EDITORS[key].max) change(key, [...list.items, EDITORS[key].fresh(list.items, list)]);
  };
  const toggle = key => { state.open[key] = !state.open[key]; if (state.open[key]) refresh(); draw(key); };

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
  drawAll();
  return nodes;
}
