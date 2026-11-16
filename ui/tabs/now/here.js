// Builds the Here card: people present with their feelings ring and the Scene spoiler for wants and hiding.
import { h } from '../../kit/dom.js';
import { feelingsRing } from '../../kit/ring.js';
import { spoilerSwitch, hiddenValue } from '../../kit/spoiler.js';
import { isSafePortraitUrl } from '../../kit/safe-url.js';

const LETTERS = Object.freeze([['trust', 'T'], ['affection', 'A'], ['desire', 'D'], ['tension', 'Tn']]);

function signed(n) {
  const v = Number(n) || 0;
  return v > 0 ? `+${v}` : String(v);
}

function portrait(person) {
  const src = person.portrait;
  const style = isSafePortraitUrl(src) ? { 'background-image': `url("${src}")` } : null;
  return h('span', { class: 'ph', style, dataset: { portrait: src ?? null } }, style ? null : person.name.slice(0, 1));
}

function personRow(person, shown, expanded, ctx, redraw) {
  const open = expanded.has(person.personId);
  const detail = open
    ? [
        h('dl', null,
          h('dt', null, 'Doing'), h('dd', null, person.doing ?? '—'),
          h('dt', null, 'Wearing'), h('dd', null, person.wearing ?? '—')),
        person.scene
          ? h('dl', { class: 'sec2' },
              h('dt', null, 'Wants'), h('dd', null, hiddenValue(person.scene.wants ?? '—', shown, 'Hidden · switch on Scene spoilers')),
              h('dt', null, 'Hiding'), h('dd', null, hiddenValue(person.scene.hiding ?? '—', shown, 'Hidden · switch on Scene spoilers')))
          : null,
      ]
    : null;
  return h(
    'div',
    { class: 'hp2', dataset: { personId: person.personId } },
    h('span', { class: 'prg' },
      feelingsRing(person.meters),
      portrait(person),
      person.followed ? h('span', { class: 'star', title: 'Followed' }, '★') : null),
    h('div', { class: 'hp2-body' },
      h('div', { class: 'nl' },
        h('b', null, person.name),
        h('span', { class: 'md2' }, person.mood),
        h('button', { type: 'button', class: 'dossier-link', onClick: () => ctx.go?.('people', { personId: person.personId }) }, 'Dossier ›')),
      h('div', { class: 'fl2' }, LETTERS.map(([key, letter], i) =>
        h('span', { class: `f${i}` }, `${letter} ${signed(person.meters?.[key])}`))),
      h('div', { class: 'wh2' }, person.where),
      person.thought ? h('div', { class: 'th3' }, `“${person.thought}”`) : null,
      detail,
      h('button', {
        type: 'button',
        class: 'more2',
        'aria-expanded': String(open),
        onClick: () => {
          if (expanded.has(person.personId)) expanded.delete(person.personId);
          else expanded.add(person.personId);
          redraw();
        },
      }, open ? 'Less ▴' : 'Doing, wearing, wants ▾')),
  );
}

/** Builds the Here card, or null when nobody is present; the Scene spoiler is read and written through ctx.prefs. */
export function hereCard(here, ctx = {}) {
  const people = Array.isArray(here) ? here : [];
  if (!people.length) return null;
  const expanded = new Set();
  const list = h('div', { class: 'here2' });
  const prefs = ctx.prefs;
  let shown = Boolean(prefs?.getSpoiler?.('scene'));

  function redraw() {
    list.replaceChildren(...people.map(p => personRow(p, shown, expanded, ctx, redraw)));
  }
  redraw();

  return h(
    'section',
    { class: 'card glass now-o2', dataset: { card: 'here' } },
    h('div', { class: 'ch' }, h('h3', null, 'Here'), h('span', { class: 'cnt' }, `${people.length} ${people.length === 1 ? 'person' : 'people'}`)),
    spoilerSwitch({
      id: 'now-scene-spoiler',
      title: 'Scene spoilers',
      hint: 'this scene’s wants and hiding · same switch as the dossier · per chat',
      checked: shown,
      onChange: (next) => {
        shown = prefs?.setSpoiler ? prefs.setSpoiler('scene', next) : next;
        redraw();
      },
    }),
    list,
  );
}
