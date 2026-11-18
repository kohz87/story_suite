// The Export sheet of a party member: what the saved character file holds, the Inventory and Money choices, and Save.
import { h } from '../../kit/dom.js';
import { saveGamePack } from '../../settings/game-export.js';
import { openSheet } from './slot-picker.js';

const things = n => `${n} thing${n === 1 ? '' : 's'}`;
const NOTE = 'Saves a file you can import when you make a character in another chat. The name stays in this chat.';
const NOT_SAVED = 'Not saved: the name, XP, Health, Mana and Stamina (a new character starts full), skill practice, and anything about the story.';

/** Opens "Export <name>" for `member`; the file is asked of the RPG again at Save, so it is what is true then. `ctx` has the `port` and the `doc`. */
export async function exportSheet(member, ctx = {}) {
  const sheet = openSheet(ctx, { title: `Export ${member.name}`, subtitle: 'Party member' });
  const first = await ctx.port?.command('party.export', { member: member.id });
  if (first?.ok !== true) { sheet.body.replaceChildren(h('p', { class: 'ps-note' }, first?.message || 'This character is no longer in the story.')); return sheet; }
  const keep = { inventory: first.items > 0, money: first.own === true && first.money > 0 };
  const status = h('p', { class: 'ps-note', role: 'status' }, '');
  const option = (key, label, help, available) => {
    const box = h('input', { type: 'checkbox', dataset: { option: key }, disabled: !available, 'aria-label': label, onChange: () => { keep[key] = box.checked; } });
    box.checked = keep[key];
    return h('label', { class: 'ps-opt', dataset: { option: key } }, box, h('b', null, label), h('small', null, available ? help : ''));
  };
  const save = async () => {
    const now = await ctx.port?.command('party.export', { member: member.id, inventory: keep.inventory, money: keep.money });
    if (now?.ok !== true) { status.textContent = now?.message || 'The file could not be saved.'; return; }
    try { saveGamePack(ctx.doc ?? globalThis.document, now.text, now.fileName); } catch { status.textContent = 'The file could not be saved.'; return; }
    sheet.close();
  };
  sheet.body.replaceChildren(
    h('p', { class: 'ps-note' }, NOTE),
    h('div', { class: 'ps-opt', dataset: { option: 'character' } }, h('b', null, 'Character'), h('small', null, `Lv ${first.level} · ${first.points ? `${first.points} to spend` : 'no points to spend'}, the seven stats and its skills`)),
    option('inventory', first.items ? `Inventory · ${things(first.items)}` : 'Inventory · nothing carried', 'Names, counts and notes, with what kind and rarity each is.', first.items > 0),
    first.own ? option('money', first.money > 0 ? `Money · ${first.money}` : 'Money · nothing in the purse', 'Kept as its value, so another game\'s coins show it in their own words.', first.money > 0) : null,
    h('p', { class: 'ps-note' }, NOT_SAVED),
    status,
    h('div', { class: 'ps-row' }, h('button', { type: 'button', class: 'ps-b', dataset: { cancel: '1' }, onClick: () => sheet.close() }, 'Cancel'),
      h('button', { type: 'button', class: 'ps-b pri', dataset: { save: '1' }, onClick: save }, `Save ${first.fileName}`)),
  );
  return sheet;
}
