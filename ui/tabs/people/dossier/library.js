// Builds the dossier library strip at the foot of a dossier: folded to one line, or open as a row (a grid on a phone) of portraits with names, All / ★ Following.
import { h } from '../../../kit/dom.js';
import { portraitDisc } from '../person-card.js';

/** Everyone in the port's `dossier` view once (it holds each person under the id and the lower-case name), in its order. */
export function libraryPeople(view) {
  const seen = new Set();
  return Object.values(view ?? {}).filter(vm => vm && typeof vm === 'object' && vm.id && !seen.has(vm.id) && seen.add(vm.id));
}

/**
 * Builds the strip for `people` (dossier view-models). opts = { currentId, open, filter ('all' | 'followed'), onToggle(), onFilter(id), onPick(id) }.
 * The open person is highlighted; a followed person's portrait has a gold ring. Tapping a portrait calls onPick with that person's id.
 */
export function dossierLibrary(people = [], { currentId = null, open = false, filter = 'all', onToggle, onFilter, onPick } = {}) {
  const shown = open && filter === 'followed' ? people.filter(p => p.following) : people;
  const head = h('button', { type: 'button', class: 'lhd', 'aria-expanded': String(open), dataset: { act: 'library' }, onClick: () => onToggle?.() },
    h('span', { class: 'lt' }, `${open ? '▾' : '▸'} Dossier library · `, h('span', { class: 'ln' }, String(people.length)), h('span', { class: 'lw' }, people.length === 1 ? ' person' : ' people')));
  if (!open) {
    return h('nav', { class: 'dlib', 'aria-label': 'Dossier library' }, head,
      h('span', { class: 'row2' }, people.map(p => h('button', {
        type: 'button', class: ['p', p.id === currentId ? 'on' : null], 'aria-label': p.name, 'aria-current': p.id === currentId ? 'true' : null, dataset: { personId: p.id }, onClick: () => onPick?.(p.id),
      }, portraitDisc(p, 'pf')))));
  }
  const chip = (id, label) => h('button', { type: 'button', class: 'fchip', 'aria-pressed': String(filter === id), dataset: { filter: id }, onClick: () => onFilter?.(id) }, label);
  return h('nav', { class: 'dlib open', 'aria-label': 'Dossier library' },
    h('div', { class: 'hd' }, head, h('span', { class: 'sp' }), h('span', { class: 'fchips' }, chip('all', 'All'), chip('followed', '★ Following'))),
    h('div', { class: 'lrow' }, shown.length ? shown.map(p => h('button', {
      type: 'button', class: ['lp', p.id === currentId ? 'on' : null, p.following ? 'fol' : null, p.life !== 'alive' ? 'dead' : null],
      'aria-current': p.id === currentId ? 'true' : null, dataset: { personId: p.id }, onClick: () => onPick?.(p.id),
    }, h('span', { class: 'p' }, portraitDisc(p, 'pf')), h('b', null, p.name))) : h('p', { class: 'fine' }, 'Nobody followed yet.')));
}
