// Renders a world pack's lorebook rows on Settings › Packs: Create / Update / Up to date, the Use in this chat tick, the Update confirm card and the result line.
import { h } from '../kit/dom.js';

/**
 * `book` = the installed row's `lorebook` view (ui/select/packs-lorebook.js); `state.lorebook` = { confirming (pack id), use ({ [id]: bool }), busy (id),
 * result ({ id, text, ok }) } with `state.setLorebook(patch)` and `state.makeLorebook({ id, use, confirmed })` (the page sends `packs.lorebook.make`).
 * → the rows under the pack's own row.
 */
export function lorebookRows(book, state) {
  const own = state.lorebook ?? {};
  const set = patch => state.setLorebook?.(patch);
  const use = book.use.disabled ? false : (own.use?.[book.id] ?? book.use.on);
  const busy = own.busy === book.id;
  const make = (confirmed = false, attachOnly = false) => state.makeLorebook?.({ id: book.id, use: attachOnly ? true : use, confirmed });
  const press = () => (book.state === 'update' ? set({ confirming: own.confirming === book.id ? '' : book.id, result: null }) : make());
  const box = h('input', { type: 'checkbox', disabled: book.use.disabled || busy, 'aria-label': 'Use in this chat', onChange: () => set({ use: { ...(own.use ?? {}), [book.id]: box.checked } }) });
  box.checked = use;
  const tick = book.upToDate ? null : h('label', { class: 'lbtick' }, box, 'Use in this chat');
  const action = book.upToDate
    ? [h('span', { class: 'always' }, 'Up to date'), book.attach ? h('button', { type: 'button', class: 'btn2', disabled: busy, onClick: () => make(false, true) }, 'Use in this chat') : null]
    : [h('button', { type: 'button', class: ['btn2', 'pri'], disabled: busy, onClick: press }, book.button)];
  const notes = [book.use.note && (!book.upToDate || book.attach) ? h('small', book.use.note) : null, book.upToDate && book.attached ? h('small', 'It is this chat’s lorebook.') : null];
  const row = h('div', { class: ['srow', 'lbook'], dataset: { lorebook: book.id } }, h('span', { class: 'lb' }, h('b', 'Lorebook'), h('small', book.desc), notes), h('span', { class: 'ctl' }, tick, action));
  const confirm = own.confirming === book.id ? h('div', { class: 'cfm' }, h('b', `Update ${book.name}?`), h('small', `This replaces the book ${book.name}; edits you made in it are lost.`),
    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng', onClick: () => { set({ confirming: '' }); make(true); } }, 'Update'), h('button', { type: 'button', class: 'btn2', onClick: () => set({ confirming: '' }) }, 'Keep it'))) : null;
  const result = own.result?.id === book.id ? h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('small', { role: 'status' }, own.result.text))) : null;
  return [row, confirm, result];
}
