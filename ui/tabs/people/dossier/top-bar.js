// Builds the dossier's top bar: ‹ origin, NPC DOSSIER, the name, Reply #N, the Dossier / Map switch, ⋯ with its menu dropping from it, and Close.
import { h } from '../../../kit/dom.js';
import { button } from '../../../kit/controls.js';
import { can } from '../../../runtime/can.js';

// Edit leads the menu: the mock's bar has no Edit button, so the editor is reached here.
export const MENU = Object.freeze([
  ['edit', 'Edit', 'names, looks, profile and memories'], ['refresh', 'Refresh', 're-read the recent story for them'], ['portrait', 'Portrait', 'view, upload or generate'],
  ['inspect', 'Inspector', 'this person’s records'], ['merge', 'Merge', 'fold a duplicate into this person'], ['delete', 'Delete', 'remove this person and their records'],
]);

/**
 * Builds the bar for dossier `d`. opts = { ctx, tab ('dossier' | 'map'), menu (open), sure (Delete asked once), onTab(id), onMenu(), onPick(id), onClose() }.
 * The ⋯ menu lists only what the port answers (`can`); Delete asks twice. Returns the bar element.
 */
export function dossierBar(d, { ctx = {}, tab = 'dossier', menu = false, sure = false, onTab, onMenu, onPick, onClose } = {}) {
  const items = MENU.filter(([id]) => can(ctx, `npc.${id}`));
  const tabs = h('div', { class: 'seg dseg', role: 'group', 'aria-label': 'View' }, [['dossier', 'Dossier'], ['map', 'Map']].map(([id, label]) => h('button', {
    type: 'button', 'aria-pressed': String(tab === id), dataset: { tab: id }, onClick: () => { if (tab !== id) onTab?.(id); },
  }, label)));
  const list = !menu ? null : h('div', { class: 'menu', role: 'menu' }, items.map(([id, label, hint]) => {
    const confirm = id === 'delete' && sure;
    return h('button', { type: 'button', role: 'menuitem', class: id === 'delete' ? 'dng' : null, dataset: { act: id }, onClick: () => onPick?.(id) },
      h('b', null, confirm ? 'Tap again to delete' : label), h('small', null, confirm ? 'this cannot be undone' : hint));
  }));
  // (a control nobody answers is left out, not drawn as the text "null")
  return h('header', { class: 'dbar' }, [
    button({ label: ctx.origin ?? '‹ People', className: 'bk2', dataset: { act: 'close' }, onClick: () => onClose?.() }),
    h('span', { class: 'k' }, 'NPC DOSSIER'),
    h('span', { class: 'nm2' }, d.name),
    Number.isInteger(d.lastReply) ? h('span', { class: 'pill', dataset: { reply: String(d.lastReply) } }, `Reply #${d.lastReply}`) : null,
    h('span', { class: 'sp' }),
    tabs,
    items.length ? h('span', { class: 'anchor' }, h('button', { type: 'button', class: 'ibtn', 'aria-label': 'More', 'aria-expanded': String(menu), dataset: { act: 'menu' }, onClick: () => onMenu?.() }, '⋯'), list) : null,
    button({ label: 'Close', className: 'xbtn', dataset: { act: 'shut' }, onClick: () => onClose?.() }),
  ].filter(Boolean));
}
