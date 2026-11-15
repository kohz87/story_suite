// Builds the Director cards (plan bar, pulse, cast, arc, beats, clocks, hooks, news on its way) and the shared plan-gated card.
import { h } from '../../kit/dom.js';
import { button, toggle } from '../../kit/controls.js';

const CLOCK_SHOWN = Object.freeze({ none: 'not yet', sign: 'a sign', warning: 'a warning' });

/** Builds a plan-gated card: counts always show; rows only while the plan is shown; null when the group is empty. */
export function gatedCard(title, group, shown, render, extra = null) {
  const count = Number.isFinite(group?.count) ? group.count : 0;
  if (!count) return null;
  const body = shown
    ? [(group.items ?? []).map(render), extra]
    : h('div', { class: 'hiddenrow' }, h('i', null, '🔒'), `${count} ${count === 1 ? 'is' : 'are'} hidden`);
  return h('section', { class: 'card glass dc', dataset: { card: title.toLowerCase().replace(/\W+/g, '-') } },
    h('div', { class: 'ch' }, h('h3', null, title), h('span', { class: 'cnt' }, String(count))), body);
}

/** Builds the Show/Hide the plan bar; onChange(next) is called when the reader flips it. */
export function planBar(shown, onChange) {
  const label = h('span', { class: 't' }, shown ? 'Plan spoilers shown' : 'Plan spoilers hidden',
    h('small', null, shown ? 'Spoilers for this chat are on this screen.' : 'Counts only; nothing that would spoil the story.'));
  const btn = button({
    label: shown ? 'Hide the plan' : 'Show the plan', className: ['spobtn', shown ? 'on' : null].filter(Boolean).join(' '),
    pressed: shown, dataset: { act: 'plan' }, onClick: () => onChange?.(!shown),
  });
  return h('section', { class: 'glass spobar', dataset: { card: 'plan-bar' } }, label, btn);
}

const item = (title, tag, text, meta, tagClass = '') => h('div', { class: 'it2' },
  h('div', { class: 'h' }, h('b', null, title), tag ? h('span', { class: ['tagx', tagClass] }, tag) : null),
  text ? h('p', null, text) : null, meta ? h('div', { class: 'm' }, h('span', null, meta)) : null);

function pulseCard(pulse, shown, ctx) {
  if (!pulse || (pulse.mode === 'off' && !pulse.recent?.length)) return null;
  const latest = pulse.latest;
  const head = pulse.quiet
    ? h('p', { class: 'fine' }, 'Quiet scene: no rolls until the scene changes.')
    : h('div', { class: 'pulse' },
      h('span', { class: 'die' }, shown && latest?.roll != null ? String(latest.roll) : '?'),
      h('span', null, h('b', null, shown && latest?.kind ? latest.kind : 'Rolled this reply'),
        h('small', null, shown && latest?.cause ? latest.cause : 'What it caused is part of the plan.')));
  const recent = (pulse.recent ?? []).map(r => h('div', { class: ['rrow', r.skipped ? 'skip' : null] },
    h('span', { class: 'rd' }, r.skipped || shown ? (r.roll ?? '—') : '?'),
    h('span', { class: 'rt2' }, h('b', null, r.kind),
      h('small', null, r.skipped || shown ? r.text + (shown && r.effect ? ` · ${r.effect}` : '') : 'what it caused is part of the plan'))));
  return h('section', { class: 'card glass dc', dataset: { card: 'pulse' } },
    h('div', { class: 'ch' }, h('h3', null, 'World pulse'), h('span', { class: 'cnt' }, 'this reply')), head,
    recent.length ? h('div', { class: 'recent' }, h('div', { class: 'secl2' }, 'Recent rolls'), recent) : null,
    h('div', { class: 'prow' },
      h('span', { class: 'tgl' }, toggle({ checked: pulse.quiet, label: 'Quiet scene', onChange: on => ctx.command?.('pulse.quiet', { on }) }), 'Quiet scene'),
      h('span', { class: 'fine' }, `mode: ${pulse.mode}`)));
}

function castCard(cast) {
  if (!cast || !cast.total) return null;
  const cell = (n, label) => h('div', null, h('b', null, String(n)), h('small', null, label));
  return h('section', { class: 'card glass dc', dataset: { card: 'cast' } },
    h('div', { class: 'ch' }, h('h3', null, 'The cast'), h('span', { class: 'cnt' }, 'from the pack')),
    h('div', { class: 'castn' }, cell(cast.total, 'in the pack'), cell(cast.met, 'met (in People)'), cell(cast.unmet, 'unmet (some may have died off-screen)')),
    h('p', { class: 'fine' }, 'Unmet people are never named here, even with the plan shown.' + (cast.lastMoved ? ` Last moved ${cast.lastMoved}.` : '')));
}

function arcCard(arc, shown, ctx) {
  const note = h('textarea', { class: 'note2', placeholder: 'A note for the next plan (optional): e.g. more about Torka’s past' });
  const plan = arc?.plan;
  const body = !shown
    ? h('div', { class: 'hiddenrow' }, h('i', null, '🔒'), 'The arc plan is hidden')
    : plan ? h('div', { class: 'arcbox' }, h('b', null, plan.title), h('p', null, plan.text), h('span', { class: 'm' }, plan.summary)) : h('p', { class: 'fine' }, 'No arc is planned yet.');
  return h('section', { class: 'card glass dc wide', dataset: { card: 'arc' } },
    h('div', { class: 'ch' }, h('h3', null, 'Arc'), h('span', { class: 'cnt' }, arc?.accepted ? `accepted ${arc.accepted}` : 'none accepted')), body,
    h('div', { class: 'prow' },
      button({ label: 'Plan the next arc', dataset: { act: 'arc-plan' }, onClick: () => ctx.command?.('arc.plan', { note: note.value ?? '' }) }),
      button({ label: 'End this arc', dataset: { act: 'arc-end' }, onClick: () => ctx.command?.('arc.end', {}) })), note);
}

/** Returns the Director cards in phone order, leaving out the empty ones; ctx = { command(name, payload) }. */
export function directorCards(story = {}, ctx = {}) {
  const shown = Boolean(story.plan?.shown);
  return [
    pulseCard(story.pulse, shown, ctx),
    castCard(story.cast),
    arcCard(story.arc, shown, ctx),
    gatedCard('Beats', story.beats, shown, b => item(b.title, b.state === 'ready' ? 'ready' : 'waiting', b.text, b.when, b.state)),
    gatedCard('Clocks', story.clocks, shown, c => item(c.title, `due ${c.due}`, c.text, `shown in the story: ${CLOCK_SHOWN[c.shown] ?? c.shown}`)),
    gatedCard('Hooks the story is planning', story.hooks, shown, k => item(k.title, 'planned', k.text, k.when)),
    gatedCard('News on its way', story.newsOnWay, shown, n => item(n.title, n.reaches, n.text, n.how)),
  ];
}
