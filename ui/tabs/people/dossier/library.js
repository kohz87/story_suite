// Builds the dossier library strip at the foot of a dossier: folded to one line (the people around, "+N more"), or open with chips, a search and portraits with names (a grid on a phone); ‹ › step through the chip.
import { h } from '../../../kit/dom.js';
import { portraitDisc } from '../person-card.js';
import { chipSets, searchPeople, stepPerson } from './library-sets.js';

const CHIPS = Object.freeze([['around', 'Around'], ['party', 'Party'], ['followed', '★ Following'], ['all', 'All']]);
const EMPTY = Object.freeze({ around: 'Nobody around.', party: 'Nobody in the party.', followed: 'Nobody followed yet.', all: 'No one here.' });

/**
 * Builds the strip for `people` (dossier view-models in libraryPeople's order). opts = { currentId, open, filter ('around' | 'party' | 'followed' | 'all'), query,
 * onToggle(), onFilter(id), onQuery(text), onMore(), onStep(delta), onPick(id) }.
 * The open person is highlighted; a followed person's portrait has a gold ring. Tapping a portrait calls onPick with that person's id.
 * ‹ › and the arrow keys (focus in the strip, outside the search box) call onStep. Typing redraws only the portraits, so the search box keeps the focus.
 */
export function dossierLibrary(people = [], { currentId = null, open = false, filter = 'around', query = '', onToggle, onFilter, onQuery, onMore, onStep, onPick } = {}) {
  const sets = chipSets(people);
  const chosen = sets[filter] ?? sets.around;
  const lone = stepPerson(people, chosen, currentId, 1) === null;
  const head = h('button', { type: 'button', class: 'lhd', 'aria-expanded': String(open), dataset: { act: 'library' }, onClick: () => onToggle?.() },
    h('span', { class: 'lt' }, `${open ? '▾' : '▸'} Dossier library · `, h('span', { class: 'ln' }, String(people.length)), h('span', { class: 'lw' }, people.length === 1 ? ' person' : ' people')));
  const step = (delta, act, text, label) => h('button', { type: 'button', class: 'lst', 'aria-label': label, title: label, disabled: lone, dataset: { act }, onClick: () => onStep?.(delta) }, text);
  const steps = h('span', { class: 'lsteps' }, step(-1, 'libprev', '‹', 'Previous person'), step(1, 'libnext', '›', 'Next person'));
  const onKeydown = (event) => {
    const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (!delta || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || String(event.target?.tagName).toUpperCase() === 'INPUT') return;
    // (the host page swipes replies on these keys: they stop here)
    event.preventDefault?.();
    event.stopPropagation?.();
    onStep?.(delta);
  };
  const nav = (cls, ...kids) => {
    const el = h('nav', { class: cls, 'aria-label': 'Dossier library' }, ...kids);
    el.addEventListener('keydown', onKeydown);
    return el;
  };
  const current = p => (p.id === currentId ? 'true' : null);
  if (!open) {
    const more = people.length - sets.around.length;
    return nav('dlib', head, steps,
      h('span', { class: 'row2' }, sets.around.map(p => h('button', {
        type: 'button', class: ['p', p.id === currentId ? 'on' : null], 'aria-label': p.name, 'aria-current': current(p), dataset: { personId: p.id }, onClick: () => onPick?.(p.id),
      }, portraitDisc(p, 'pf')))),
      more > 0 ? h('button', { type: 'button', class: 'lmore', dataset: { act: 'libmore' }, onClick: () => onMore?.() }, `+${more} more`) : null);
  }
  const row = h('div', { class: 'lrow' });
  let typed = query;
  const fill = () => {
    const shown = searchPeople(chosen, typed);
    row.replaceChildren(...(shown.length ? shown.map(p => h('button', {
      type: 'button', class: ['lp', p.id === currentId ? 'on' : null, p.following ? 'fol' : null, p.life !== 'alive' ? 'dead' : null],
      'aria-current': current(p), dataset: { personId: p.id }, onClick: () => onPick?.(p.id),
    }, h('span', { class: 'p' }, portraitDisc(p, 'pf')), h('b', null, p.name))) : [h('p', { class: 'fine' }, typed.trim() ? 'Nobody found.' : EMPTY[filter] ?? EMPTY.around)]));
  };
  const search = h('input', {
    class: 'lsearch', type: 'search', placeholder: 'Find by name', 'aria-label': 'Find in the dossier library', dataset: { act: 'libsearch' },
    onInput: (event) => { typed = String(event.target.value ?? ''); onQuery?.(typed); fill(); },
  });
  search.value = query;
  fill();
  const chips = h('span', { class: 'fchips', role: 'group', 'aria-label': 'Show' }, CHIPS.map(([id, label]) => h('button', {
    type: 'button', class: 'fchip', 'aria-pressed': String(filter === id), dataset: { filter: id }, onClick: () => onFilter?.(id),
  }, label, h('small', null, String(sets[id].length)))));
  return nav('dlib open', h('div', { class: 'hd' }, head, steps, h('span', { class: 'sp' }), search, chips), row);
}
