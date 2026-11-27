// Opens the World editor sheet for a news item, a faction or a place and sends the changed fields as chronicle.edit / atlas.edit.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { openSheet } from '../../kit/sheet.js';

const STATES = ['looming', 'ongoing', 'resolved'];

// kind → the command, the id key, and the text fields (key, label, long?) the form offers.
const KINDS = Object.freeze({
  news: { command: 'chronicle.edit', idKey: 'id', noun: 'news', fields: [['name', 'Title'], ['summary', 'What happened', true], ['state', 'State', 'state'], ['place', 'Place']] },
  faction: { command: 'chronicle.edit', idKey: 'id', noun: 'faction', fields: [['name', 'Name'], ['summary', 'About', true], ['area', 'Area'], ['stance', 'Stance']] },
  place: { command: 'atlas.edit', idKey: 'place', noun: 'place', fields: [['name', 'Name'], ['kind', 'Kind'], ['region', 'Region']] },
});

/** The payload of changed fields only (a blank text keeps the old one); null when nothing changed. `values` and `current` are { field: text }. */
export function editPayload(kind, id, values, current) {
  const spec = KINDS[kind];
  if (!spec) return null;
  const patch = {};
  for (const [key] of spec.fields) {
    const next = String(values[key] ?? '').trim();
    if (next && next !== String(current[key] ?? '').trim()) patch[key] = next;
  }
  return Object.keys(patch).length ? { [spec.idKey]: id, ...patch } : null;
}

// The way out of the record: a faction is removed (asked twice), an open world news item is marked ended. A dated happening (`thread`) has
// no chronicle entry, and ended news has nothing to end.
function wayOut(target, done) {
  if (target.kind === 'faction') {
    let sure = false;
    const out = button({ label: 'Remove', tone: 'danger', className: 'remove', onClick: () => {
      if (sure) return done({ id: target.id }, 'chronicle.remove');
      sure = true;
      out.textContent = 'Tap again to remove';
    } });
    return out;
  }
  if (target.kind !== 'news' || target.thread || target.current?.state === 'resolved') return null;
  return button({ label: 'Mark ended', className: 'ended', onClick: () => done({ id: target.id, state: 'resolved' }) });
}

function control(key, kind, value) {
  if (kind === 'state') {
    const select = h('select', null, STATES.map(s => h('option', { value: s, selected: s === value }, s)));
    select.value = STATES.includes(value) ? value : 'ongoing';
    return select;
  }
  return kind === true ? h('textarea', { rows: 3, value: value ?? '' }) : h('input', { type: 'text', value: value ?? '' });
}

/**
 * Opens the editor for `target` = { kind: 'news' | 'faction' | 'place', id, current: { field: text } }; ctx = { port | command, doc, backStack, refresh }.
 * Save sends only what changed (nothing is sent when nothing did). A faction also has Remove (chronicle.remove, on the second tap) and an
 * open world news item Mark ended (not one with `target.thread`). Returns the sheet handle, or null for an unknown kind.
 */
export function openWorldEditor(ctx = {}, target) {
  const spec = KINDS[target?.kind];
  if (!spec) return null;
  const send = ctx.command ?? (ctx.port ? ctx.port.command.bind(ctx.port) : () => {});
  const sheet = openSheet(ctx, { id: 'world-editor', label: `Edit ${spec.noun}` });
  const current = target.current ?? {};
  const inputs = Object.fromEntries(spec.fields.map(([key, , kind]) => [key, control(key, kind, current[key])]));
  // A refused edit (a name already taken, an entry the command cannot change) keeps the sheet open with the engine's reason.
  const refusal = h('p', { class: 'fine err', role: 'alert', hidden: true });
  const done = async (payload, command = spec.command) => {
    const answer = payload ? await send(command, payload) : null;
    if (answer?.ok === false) {
      refusal.textContent = String(answer.message ?? 'That change was not kept.');
      refusal.removeAttribute('hidden');
      return;
    }
    sheet.close();
    ctx.refresh?.();
  };
  sheet.body.appendChild(h('div', { class: 'qsheet wsheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Edit ${spec.noun}`, dataset: { edit: target.kind, id: target.id } },
    h('div', { class: 'qeh' }, h('div', { class: 'dn' }, `Edit ${spec.noun}`), button({ label: '×', icon: h('span', null, '×'), tone: 'icon', ariaLabel: 'Close', className: 'x qclose', onClick: () => sheet.close() })),
    ...spec.fields.map(([key, label]) => h('label', { class: 'ef' }, label, inputs[key])),
    h('p', { class: 'fine' }, 'A blank field keeps what is there. Changes are kept as written by you.'),
    refusal,
    h('div', { class: 'brow' },
      button({ label: 'Save', tone: 'primary', className: 'save', onClick: () => done(editPayload(target.kind, target.id, Object.fromEntries(spec.fields.map(([k]) => [k, inputs[k].value])), current)) }),
      button({ label: 'Cancel', className: 'cancel', onClick: () => sheet.close() }),
      wayOut(target, done))));
  return sheet;
}
