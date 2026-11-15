// Builds the Agendas card: off-screen plans closest to you first, five then Show all, with the told-this-reply tag.
import { h } from '../../kit/dom.js';
import { moreList } from '../../kit/more.js';

function agendaRow(a, ctx) {
  const who = a.whoId
    ? h('a', { href: '#', dataset: { personId: a.whoId }, onClick: (e) => { e.preventDefault?.(); ctx.go?.('people', { personId: a.whoId }); } }, a.who)
    : a.who;
  const pct = a.of > 0 ? Math.min(100, Math.max(0, (a.step / a.of) * 100)) : 0;
  return h('div', { class: 'it2', dataset: { agenda: a.title } },
    h('div', { class: 'h' }, h('b', null, a.title),
      a.toldThisReply ? h('span', { class: 'tagx told', title: 'The narrator was told this in this reply' }, 'told this reply') : null,
      h('span', { class: 'tagx' }, `step ${a.step} of ${a.of}`)),
    h('p', null, h('b', null, who), ` · ${a.text}`),
    h('div', { class: 'agbar' }, h('b', { style: { width: `${pct}%` } })),
    h('div', { class: 'm' }, h('span', { class: 'why' }, a.why), h('span', null, `since ${a.since}`),
      h('span', null, `📍 ${a.place}`), h('span', null, `next: ${a.next}`)));
}

/** Builds the Agendas card, or null when there are none; items stay hidden (count only) while the plan is hidden. */
export function agendasCard(agendas, shown, ctx = {}) {
  const count = Number.isFinite(agendas?.count) ? agendas.count : 0;
  if (!count) return null;
  const prefs = ctx.prefs;
  const body = shown
    ? moreList({
      items: agendas.items ?? [], render: a => agendaRow(a, ctx), limit: 5,
      expanded: Boolean(prefs?.getFold?.('story.agendas.all', false)),
      onToggle: open => prefs?.setFold?.('story.agendas.all', open),
    })
    : h('div', { class: 'hiddenrow' }, h('i', null, '🔒'), `${count} ${count === 1 ? 'agenda is' : 'agendas are'} hidden`);
  return h('section', { class: 'card glass dc wide', dataset: { card: 'agendas' } },
    h('div', { class: 'ch' }, h('h3', null, 'Agendas'), h('span', { class: 'cnt' }, `${count} ${count === 1 ? 'agenda' : 'agendas'} · closest to you first`)), body);
}
