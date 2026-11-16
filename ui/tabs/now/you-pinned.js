// Builds the folded You card (look, position, condition) and the pinned tracker cards.
import { h } from '../../kit/dom.js';

const FOLD_KEY = 'now.you';

function summary(you) {
  const look = you.look ? you.look.split(/[.,;]/)[0] : null;
  return [look, you.position ? you.position.charAt(0).toLowerCase() + you.position.slice(1) : null].filter(Boolean).join(' · ');
}

/** Builds the You card (folded by default per device), or null when there is nothing to say. */
export function youCard(you, ctx = {}) {
  if (!you || (!you.look && !you.position && !you.condition)) return null;
  const prefs = ctx.prefs;
  let folded = prefs?.getFold ? prefs.getFold(FOLD_KEY, true) : true;
  const body = h('div', { class: 'you-body' });
  const head = h('button', { type: 'button', class: 'fold', 'aria-expanded': 'false' });
  const section = h('section', { class: 'card glass you now-o4', dataset: { card: 'you' } }, h('div', { class: 'ch' }, head), body);

  function draw() {
    head.setAttribute('aria-expanded', String(!folded));
    head.replaceChildren(h('i', null, '›'), h('h3', null, 'You'), ...(folded ? [h('small', null, summary(you))] : []));
    body.replaceChildren(...(folded ? [] : [
      you.look ? h('span', { class: 'srcl' }, 'Look · from the story') : null,
      you.look ? h('p', null, you.look) : null,
      h('dl', { class: 'kv2' },
        you.position ? [h('dt', null, 'Position'), h('dd', null, you.position)] : null,
        you.condition ? [h('dt', null, 'Condition'), h('dd', null, you.condition)] : null),
    ].filter(Boolean)));
  }
  head.addEventListener('click', () => {
    folded = prefs?.setFold ? prefs.setFold(FOLD_KEY, !folded) : !folded;
    draw();
  });
  draw();
  return section;
}

function field(f) {
  const bar = typeof f.pct === 'number'
    ? h('i', { class: 'fbar' }, h('b', { class: f.tone ?? null, style: { width: `${Math.max(0, Math.min(100, f.pct))}%` } }))
    : h('span');
  return h('div', { class: 'fld' }, h('span', null, f.label), bar, h('span', { class: 'v' }, f.value));
}

/** Builds one card per pinned tracker; returns [] when none are pinned. */
export function pinnedCards(pinned) {
  return (Array.isArray(pinned) ? pinned : []).map(tracker => h(
    'section',
    { class: 'card glass now-o5', dataset: { card: 'pinned', trackerId: tracker.trackerId } },
    h('div', { class: 'ch' }, h('h3', null, tracker.name), h('span', { class: 'cnt' }, 'pinned · Story › Trackers')),
    (tracker.fields ?? []).map(field),
  ));
}
