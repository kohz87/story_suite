// Opens the Party tab's bottom sheet and fills it for one gear slot: the worn item and the Bag's matching items with Equip.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { ownerOf } from '../../runtime/owner-id.js';
import { tabTrap } from '../../kit/trap.js';
import { statsRow, changeView } from '../bag/stats-change.js';

/** Slot key → [glyph name, long label, short label]. */
export const SLOT_META = Object.freeze({
  head: ['head', 'Head', 'Head'],
  armor: ['armor', 'Armor', 'Armor'],
  cloak: ['cloak', 'Cloak', 'Cloak'],
  feet: ['feet', 'Feet', 'Feet'],
  mount: ['mount', 'Mount', 'Mount'],
  weapon: ['weapon', 'Weapon', 'Weap.'],
  offhand: ['offhand', 'Offhand', 'Off.'],
  accessory1: ['accessory', 'Accessory', 'Acc.'],
  accessory2: ['accessory', 'Accessory', 'Acc.'],
  bag: ['bagslot', 'Bag', 'Bag'],
});

const RARITY_LABEL = { uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic' };

/**
 * Opens the sheet frame (dim backdrop, grab bar, title, close button) and returns `{ body, subtitle, close }`.
 * Escape and the backdrop close it; Tab stays inside it (it is aria-modal); the back-stack gets one `sheet` entry; focus returns to the opener.
 */
export function openSheet(ctx = {}, { title = '', subtitle = '', tone = null } = {}) {
  const doc = ctx.doc ?? globalThis.document;
  const opener = doc.activeElement ?? null;
  const sub = h('div', { class: 'ps-s' }, subtitle);
  const body = h('div', { class: 'ps-body' });
  const closeBtn = h('button', { type: 'button', class: 'ps-x', 'aria-label': 'Close', dataset: { close: '1' } }, '×');
  const sheet = h(
    'div',
    { class: ['pty-sheet', tone], role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('span', { class: 'grab' }),
    h('div', { class: 'ps-h' }, h('div', null, h('div', { class: 'ps-n' }, title), sub), closeBtn),
    body,
  );
  const overlay = h('div', { class: 'pty-ov', dataset: { sheet: 'party' } }, sheet);
  const host = ctx.sheetHost ?? doc.querySelector?.('.su-root') ?? doc.body;
  let release = null;
  let open = true;

  function close() {
    if (!open) return false;
    open = false;
    release?.();
    overlay.remove();
    opener?.focus?.();
    return true;
  }
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('keydown', tabTrap(sheet, { doc, isOn: () => open }));
  host.appendChild(overlay);
  release = ctx.backStack?.push({ id: 'party-sheet', layer: 'sheet', close: () => { open = false; overlay.remove(); opener?.focus?.(); } }) ?? null;
  closeBtn.focus();
  return { body, close, subtitle: text => { sub.textContent = text; } };
}

const tile = (item, glyphName) => h('span', {
  class: ['ti', item?.rarity && item.rarity !== 'common' ? `r-${item.rarity}` : null],
}, glyph(glyphName));

// Soak is armour wording: a weapon or offhand piece says what it adds (its stat bonus) or just what it is.
const NO_SOAK = new Set(['weapon', 'offhand']);
const soakText = (item, slotKey) => (item.soak ? `Soak +${item.soak}` : NO_SOAK.has(slotKey) ? (item.bonus || SLOT_META[slotKey][1]) : 'No soak points');

function wearBar(torn) {
  return h('span', { class: ['ps-w', torn ? 't' : null] }, [1, 2, 3, 4].map(n => h('i', { class: n <= (torn ? 2 : 4) ? 'on' : null })));
}

function wornBlock(member, slot, meta, sheet, ctx, redraw) {
  const item = slot?.item;
  if (!item) return null;
  // The piece's Stats row (the Bag's own item: its points and whether they can move); Change swaps the sheet's body for the picker.
  const held = (ctx.port?.view?.('bag')?.items ?? []).find(it => it.stack === item.stack) ?? { ...item, kind: 'gear' };
  const stats = statsRow({ ...held, name: item.name }, {
    port: ctx.port,
    open: () => sheet.body.replaceChildren(changeView({ ...held, name: item.name }, { port: ctx.port, onDone: () => sheet.close(), onCancel: redraw })),
  });
  const owner = `worn by ${member.name}`;
  const unequip = h('button', {
    type: 'button',
    class: 'ps-b',
    dataset: { unequip: slot.key },
    onClick: async () => { await ctx.port?.command('inventory.unequip', { stack: item.stack }); sheet.close(); },
  }, 'Unequip');
  return [
    h('div', { class: 'ps-i' }, tile(item, meta[0]),
      h('div', null, h('div', { class: 'ps-n ps-n2' }, item.name),
        h('div', { class: 'ps-s' }, [RARITY_LABEL[item.rarity], owner].filter(Boolean).join(' · ')))),
    h('dl', { class: 'ps-kv' },
      h('dt', null, NO_SOAK.has(slot.key) && !item.soak ? 'Gives' : 'Soak'), h('dd', null, soakText(item, slot.key)),
      h('dt', null, 'Condition'), h('dd', null, wearBar(item.torn), item.torn ? 'Torn' : 'Fine'),
      stats.cells),
    stats.line,
    h('div', { class: 'ps-row' }, unequip),
  ];
}

function fitRow(member, slotKey, meta, item, sheet, ctx) {
  return h(
    'div',
    { class: 'ps-r', dataset: { stack: item.stack } },
    tile(item, meta[0]),
    h('span', null, h('b', null, item.name), h('small', null, `${soakText(item, slotKey)} · ${item.wear === 'torn' ? 'Torn' : 'Fine'}`)),
    h('button', {
      type: 'button',
      class: 'ps-b pri',
      dataset: { equip: item.stack, at: slotKey },
      onClick: async () => { await ctx.port?.command('item.equip', { owner: ownerOf(member.id, ctx.port?.view?.('party')?.pcId), slot: slotKey, stack: item.stack, transfer: true }); sheet.close(); },
    }, 'Equip'),
  );
}

/** Opens the slot sheet for one member and slot key; ctx = { port, backStack, go }. Returns the sheet handle. */
export function slotSheet(member, slotKey, ctx = {}) {
  const meta = SLOT_META[slotKey];
  if (!meta) return null;
  const slot = member.slots.find(s => s.key === slotKey) ?? { key: slotKey, item: null };
  const worn = slot.item;
  const sheet = openSheet(ctx, { title: `${member.name} · ${meta[1]}`, subtitle: worn ? '' : 'Nothing worn here', tone: 'ps-slot' });
  const items = ctx.port?.view('bag')?.items ?? [];
  const fits = items.filter(it => it.kind === 'gear' && it.glyph === meta[0] && !it.wornBy);
  const draw = () => sheet.body.replaceChildren(...[
    wornBlock(member, slot, meta, sheet, ctx, draw),
    h('div', { class: 'ps-sec' }, `In the Bag · fits ${meta[1].toLowerCase()}`),
    fits.length ? fits.map(it => fitRow(member, slotKey, meta, it, sheet, ctx)) : h('p', { class: 'ps-p' }, 'Nothing in the Bag fits this slot.'),
    typeof ctx.go === 'function'
      ? h('div', { class: 'ps-row' }, h('button', { type: 'button', class: 'ps-b', dataset: { tabgo: 'bag' }, onClick: () => { sheet.close(); ctx.go('bag'); } }, 'Open Bag'))
      : null,
  ].flat().filter(Boolean));
  draw();
  return sheet;
}
