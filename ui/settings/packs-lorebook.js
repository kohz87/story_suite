// Renders a world pack's lorebook rows on Settings › Packs: Create / Update / Up to date, the Use with this character tick, the line moving an
// earlier version's chat lorebook to the character, the Update confirm card and the result line.
import { h } from '../kit/dom.js';

const USE = 'Use with this character';
const MOVE = 'Move it from this chat to the character';

/**
 * `book` = the installed row's `lorebook` view (ui/select/packs-lorebook.js); `state.lorebook` = { confirming (pack id), use ({ [id]: bool }), busy (id),
 * result ({ id, text, ok }) } with `state.setLorebook(patch)` and `state.makeLorebook({ id, use, confirmed, move })` (the page sends `packs.lorebook.make`).
 * → the rows under the pack's own row.
 */
export function lorebookRows(book, state) {
  const own = state.lorebook ?? {};
  const set = patch => state.setLorebook?.(patch);
  const use = book.use.disabled ? false : (own.use?.[book.id] ?? book.use.on);
  const busy = own.busy === book.id;
  const make = (confirmed = false, attachOnly = false) => state.makeLorebook?.({ id: book.id, use: attachOnly ? true : use, confirmed });
  const press = () => (book.state === 'update' ? set({ confirming: own.confirming === book.id ? '' : book.id, result: null }) : make());
  const box = h('input', { type: 'checkbox', disabled: book.use.disabled || busy, 'aria-label': USE, onChange: () => set({ use: { ...(own.use ?? {}), [book.id]: box.checked } }) });
  box.checked = use;
  const tick = book.upToDate ? null : h('label', { class: 'lbtick' }, box, USE);
  const action = book.upToDate
    ? [h('span', { class: 'always' }, 'Up to date'), book.attach ? h('button', { type: 'button', class: 'btn2', disabled: busy, onClick: () => make(false, true) }, USE) : null]
    : [h('button', { type: 'button', class: ['btn2', 'pri'], disabled: busy, onClick: press }, book.button)];
  const move = book.move ? h('small', { class: 'lbmove' }, h('button', { type: 'button', class: 'btn2', disabled: busy, onClick: () => state.makeLorebook?.({ id: book.id, use: true, move: true }) }, MOVE)) : null;
  const row = h('div', { class: ['srow', 'lbook'], dataset: { lorebook: book.id } }, h('span', { class: 'lb' }, h('b', 'Lorebook'), h('small', book.desc), book.use.note ? h('small', book.use.note) : null, move), h('span', { class: 'ctl' }, tick, action));
  const confirm = own.confirming === book.id ? h('div', { class: 'cfm' }, h('b', `Update ${book.name}?`), h('small', `This replaces the book ${book.name}; edits you made in it are lost.`),
    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng', onClick: () => { set({ confirming: '' }); make(true); } }, 'Update'), h('button', { type: 'button', class: 'btn2', onClick: () => set({ confirming: '' }) }, 'Keep it'))) : null;
  const result = own.result?.id === book.id ? h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('small', { role: 'status' }, own.result.text))) : null;
  return [row, confirm, result];
}
