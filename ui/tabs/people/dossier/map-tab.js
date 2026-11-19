// Builds the dossier's Map tab: the People tab's relationship map (map.js) with an All bonds toggle, and the picked person beside it (under it below 1,080 px):
// their ring portrait, name, chips, meter line, Bonds on the map, Open dossier › and Focus.
import { h } from '../../../kit/dom.js';
import { button } from '../../../kit/controls.js';
import { feelingsRing } from '../../../kit/ring.js';
import { castMap, lensValue } from '../map.js';
import { portraitDisc } from '../person-card.js';

const signed = n => (n > 0 ? `+${n}` : String(n));
// (a tie's word read from the picked person: "friend of Edda", "owes Tomas")
const BOND = { friend: ['g', 'friend of'], kin: ['g', 'kin of'], rival: ['bad', 'rival of'], owes: ['o', 'owes'] };

function picked(p, people, ties, { allBondsOn, onOpen, onFocus, focus }) {
  if (!p) return h('div', { class: 'rsel' }, h('p', { class: 'fine' }, 'Tap a face to see them here.'));
  const names = new Map(people.map(other => [other.personId, other.name]));
  const bonds = (ties ?? []).filter(t => t.a === p.personId || t.b === p.personId).map((t) => {
    const [tone, word] = BOND[t.kind] ?? ['g', `${t.kind} of`];
    return h('div', { class: 'bl' }, h('b', { class: tone }, word), ` ${names.get(t.a === p.personId ? t.b : t.a) ?? ''}`);
  });
  const m = p.meters ?? {};
  return h('div', { class: 'rsel', dataset: { picked: p.personId } },
    h('button', { type: 'button', class: 'rring', 'aria-label': `${p.name}: Profile`, dataset: { act: 'profile' }, onClick: () => onOpen(p.personId, 'profile') },
      feelingsRing(m, { width: 2.6, pad: 4 }), portraitDisc(p, 'disc'), h('span', { class: 'prof' }, 'Profile ›')),
    h('div', { class: 'rbox' },
      h('div', { class: 'dname' }, p.name),
      h('div', { class: 'chips' }, p.followed ? h('span', { class: 'chip pres' }, '★ Following') : null, p.mood ? h('span', { class: 'chip' }, p.mood) : null),
      h('div', { class: 'mets' }, h('span', { class: 'f1' }, `Warmth ${signed(lensValue(p, 'warmth'))}`), ' · ', h('span', { class: 'f0' }, `Trust ${signed(m.trust ?? 0)}`), ' · ', h('span', { class: 'f3' }, `Tension ${signed(m.tension ?? 0)}`)),
      bonds.length ? h('div', { class: 'rbonds' }, h('div', { class: 'secl' }, allBondsOn || focus ? 'Bonds on the map' : 'Their bonds'), bonds) : null,
      h('div', { class: 'rbtns' },
        button({ label: 'Open dossier ›', dataset: { act: 'open' }, onClick: () => onOpen(p.personId) }),
        focus === p.personId ? button({ label: 'Show everyone', dataset: { act: 'unfocus' }, onClick: () => onFocus(null) }) : button({ label: 'Focus', dataset: { act: 'focus' }, onClick: () => onFocus(p.personId) }))));
}

/**
 * Builds the tab for dossier `d`. opts = { people (the People view's here and elsewhere cards), ties, you, map ({ lens, sel, focus, allBonds }), onMap(next state), onOpen(personId, page?) }.
 * The picked person starts as the dossier's own; Open dossier › and Profile › call onOpen.
 */
export function dossierMapTab(d, { people = [], ties = [], you = { name: 'You' }, map = {}, onMap, onOpen } = {}) {
  const state = { lens: map.lens ?? 'warmth', sel: map.sel ?? d.id, focus: map.focus ?? null };
  const allBonds = map.allBonds !== false;
  const set = patch => onMap?.({ ...state, allBonds, ...patch });
  const toggle = h('button', { type: 'button', class: 'tgl', 'aria-pressed': String(allBonds), dataset: { act: 'bonds' }, onClick: () => set({ allBonds: !allBonds }) }, 'All bonds');
  const view = castMap({
    people, ties, state, you, card: false, legend: false, tools: toggle, allBonds,
    handlers: { lens: id => set({ lens: id }), pick: id => set({ sel: id }), focus: id => set({ focus: id, ...(id ? { sel: id } : {}) }) },
  });
  const sel = people.find(p => p.personId === state.sel) ?? null;
  return h('div', { class: 'dmapv' },
    h('div', { class: 'rmain' }, view),
    h('aside', { class: 'rpanel' }, picked(sel, people, ties, { allBondsOn: allBonds, focus: state.focus, onOpen: (id, page) => onOpen?.(id, page), onFocus: id => set({ focus: id, ...(id ? { sel: id } : {}) }) })));
}
