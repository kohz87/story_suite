// Builds the Trackers view: one card per tracker with bars, numbers or text, Show on Now and Edit.
import { h } from '../../kit/dom.js';
import { button, toggle } from '../../kit/controls.js';
import { openSheet } from '../../kit/sheet.js';
import { trackerSheet } from './tracker-edit.js';
import { templatesSheet } from './tracker-templates.js';

function field(f) {
  const bar = f.kind === 'bar' && Number.isFinite(f.pct)
    ? h('i', null, h('b', { class: f.tone ? `tone-${f.tone}` : null, style: { width: `${Math.min(100, Math.max(0, f.pct))}%` } }))
    : h('span', null);
  return h('div', { class: 'fld' }, h('span', null, f.label), bar, h('span', { class: 'v' }, f.value));
}

// Edit opens the form in a sheet; Save sends `tracker.set` (only the changed fields), Remove sends `tracker.remove`; each closes the sheet and redraws.
function editTracker(t, ctx) {
  const sheet = openSheet(ctx, { id: 'tracker-editor', label: `Edit ${t.name}` });
  const finish = async (type, payload) => {
    if (type) await ctx.command?.(type, payload);
    sheet.close();
    ctx.refresh?.();
  };
  sheet.body.appendChild(trackerSheet(t, {
    onSave: fields => finish('tracker.set', { id: t.id, fields }),
    onRemove: () => finish('tracker.remove', { id: t.id }),
    onClose: () => finish(null),
  }));
}

// "Add from a template" opens the list in a sheet; Add sends `tracker.add` with the template id and the sheet stays open when the engine refuses.
function addTracker(templates, ctx) {
  const sheet = openSheet(ctx, { id: 'tracker-templates', label: 'Add from a template' });
  sheet.body.appendChild(templatesSheet(templates, {
    onAdd: async id => { const answer = await ctx.command?.('tracker.add', { template: id }); if (answer?.ok !== false) ctx.refresh?.(); return answer; },
    onClose: () => sheet.close(),
  }));
}

/** Builds the Trackers view; ctx.command('tracker.pin' | 'tracker.set' | 'tracker.remove', …) carries the switch and the Edit sheet; ctx = { command, doc, backStack, refresh }. */
export function trackersView(story = {}, ctx = {}) {
  const list = Array.isArray(story.trackers) ? story.trackers : [];
  const hidden = Number(story.trackersHidden) || 0;
  const onNow = list.filter(t => t.showOnNow).length;
  const templates = Array.isArray(story.trackerTemplates) ? story.trackerTemplates : [];
  const addRow = templates.length ? h('div', { class: 'brow' }, button({ label: 'Add from a template', className: 'add-tracker', dataset: { act: 'add' }, onClick: () => addTracker(templates, ctx) })) : null;
  if (!list.length && !hidden) return h('div', { class: 'story-trackers', dataset: { view: 'trackers' } }, h('p', { class: 'fine' }, templates.length ? 'No trackers yet.' : 'No trackers yet. New trackers are made in Settings › Trackers.'), addRow);
  return h('div', { class: 'story-trackers', dataset: { view: 'trackers' } },
    list.map(t => h('section', { class: 'card glass trk', dataset: { card: 'tracker', trackerId: t.id } },
      h('div', { class: 'th2' }, h('b', null, t.name),
        h('span', { class: 'pinnow' }, toggle({ checked: t.showOnNow, label: 'Show on Now', onChange: async on => { await ctx.command?.('tracker.pin', { id: t.id, on }); ctx.refresh?.(); } }), 'Show on Now'),
        button({ label: 'Edit', dataset: { act: 'edit' }, onClick: () => editTracker(t, ctx) })),
      (t.fields ?? []).map(field))),
    hidden ? h('div', { class: 'hiddenrow' }, h('i', null, '🔒'), `${hidden} ${hidden === 1 ? 'tracker is' : 'trackers are'} hidden by the pack`) : null,
    h('p', { class: 'fine' }, `Up to 20 trackers, 28 shown on Now at most. ${list.length} here, ${hidden} hidden by the pack, ${onNow} shown on Now.${templates.length ? '' : ' New trackers and field changes are in Settings › Trackers.'}`),
    addRow);
}
