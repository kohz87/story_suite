// Builds the Trackers view: one card per tracker with bars, numbers or text, Show on Now and Edit.
import { h } from '../../kit/dom.js';
import { button, toggle } from '../../kit/controls.js';

function field(f) {
  const bar = f.kind === 'bar' && Number.isFinite(f.pct)
    ? h('i', null, h('b', { class: f.tone ? `tone-${f.tone}` : null, style: { width: `${Math.min(100, Math.max(0, f.pct))}%` } }))
    : h('span', null);
  return h('div', { class: 'fld' }, h('span', null, f.label), bar, h('span', { class: 'v' }, f.value));
}

/** Builds the Trackers view; ctx.command('tracker.pin' | 'tracker.edit', …) carries the switch and the Edit button. */
export function trackersView(story = {}, ctx = {}) {
  const list = Array.isArray(story.trackers) ? story.trackers : [];
  const hidden = Number(story.trackersHidden) || 0;
  const onNow = list.filter(t => t.showOnNow).length;
  if (!list.length && !hidden) return h('div', { class: 'story-trackers', dataset: { view: 'trackers' } }, h('p', { class: 'fine' }, 'No trackers yet. New trackers are made in Settings › Trackers.'));
  return h('div', { class: 'story-trackers', dataset: { view: 'trackers' } },
    list.map(t => h('section', { class: 'card glass trk', dataset: { card: 'tracker', trackerId: t.id } },
      h('div', { class: 'th2' }, h('b', null, t.name),
        h('span', { class: 'pinnow' }, toggle({ checked: t.showOnNow, label: 'Show on Now', onChange: on => ctx.command?.('tracker.pin', { id: t.id, on }) }), 'Show on Now'),
        button({ label: 'Edit', dataset: { act: 'edit' }, onClick: () => ctx.command?.('tracker.edit', { id: t.id }) })),
      (t.fields ?? []).map(field))),
    hidden ? h('div', { class: 'hiddenrow' }, h('i', null, '🔒'), `${hidden} ${hidden === 1 ? 'tracker is' : 'trackers are'} hidden by the pack`) : null,
    h('p', { class: 'fine' }, `Up to 20 trackers, 28 shown on Now at most. ${list.length} here, ${hidden} hidden by the pack, ${onNow} shown on Now. New trackers and field changes are in Settings › Trackers.`));
}
