// Builds the item sheet body: tile, rarity and kind chips, details, and the Wear on / Take off / Give to / Carry as bag / Put down / Use on / Drop actions.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { itemTile, memberName, KIND_LABEL } from './item-grid.js';
import { itemEditForm } from './item-edit.js';
import { can } from '../../runtime/can.js';
import { ownerOf } from '../../runtime/owner-id.js';
import { portraitEl } from '../party/slots.js';
import { statsRow, changeView } from './stats-change.js';

const RARITY_LABEL = { uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic' };
const RARITY_CLASS = { uncommon: 'rar-unc', rare: 'rar-rare', epic: 'rar-epic' };

function row(label, ...value) {
  return [h('dt', null, label), h('dd', null, ...value)];
}

function weightText(item) {
  if (!item.weight) return 'No weight';
  return item.qty > 1 ? `${item.weight * item.qty} load · ${item.weight} each × ${item.qty}` : `${item.weight} load`;
}

function details(item, rpg, ctx, stats) {
  const wearer = item.wornBy
    ? row('Worn by', h('span', { class: 'av', dataset: { portrait: item.wornBy } }), memberName(item.wornBy, ctx))
    : [];
  const wear = rpg && item.kind === 'gear' && item.wear
    ? row('Wear', h('span', { class: ['wbar', item.wear === 'torn' ? 'w2' : null] },
      [1, 2, 3, 4].map(n => h('i', { class: n <= (item.wear === 'torn' ? 2 : 4) ? 'on' : null }))), item.wear === 'torn' ? 'Torn' : 'Good')
    : [];
  return h(
    'dl',
    { class: 'kv' },
    wearer,
    rpg && item.soak ? row('Bonus', `+${item.soak} soak`) : [],
    stats ? stats.cells : [],
    wear,
    rpg ? row('Weight', weightText(item)) : [],
    Number.isSafeInteger(item.carry) && (item.carry > 0 || item.bagLike) ? row('Carries', item.carry > 0 ? `+${item.carry} load` : 'Adds no load yet (Edit › Carries)') : [],
    row('Worth here', item.worth),
    item.from ? row('From', h('span', { class: 'bfrom' }, `${item.from} ›`)) : [],
  );
}

/** Builds the item sheet body; ctx = { rpg, members, port, close() }. Actions send commands through ctx.port; Edit swaps the body for the form (Save sends inventory.edit). */
export function itemSheet(item, ctx = {}) {
  const rpg = Boolean(ctx.rpg);
  const names = Object.keys(ctx.members ?? {});
  const picker = h('div', { class: 'pick-wrap' });
  // Wear and the bag choice wait for the engine: a refusal (no slot, not a bag, the taker's load…) keeps the sheet open with the reason, and Edit item when
  // the reader can set the slot there.
  const send = async (type, payload) => {
    const result = ctx.port?.command(type, payload);
    if (type !== 'item.equip' && type !== 'inventory.bag') { ctx.close?.(); return; }
    const answer = await result;
    if (answer && answer.ok === false) { refused(answer.message, type); return; }
    ctx.close?.();
  };
  const slotEditable = Boolean(ctx.rpg) && item.hand === true && item.kind === 'gear';
  const refused = (message, type) => picker.replaceChildren(
    h('p', { class: 'fine err', role: 'alert' }, message || (type === 'inventory.bag' ? 'That cannot be carried as a bag.' : 'That cannot be worn.')),
    slotEditable && type === 'item.equip' ? h('div', { class: 'brow' }, button({ label: 'Edit item', tone: 'primary', onClick: () => edit(true) })) : null,
  );
  // What each pick sends (the commands read `owner` / `to`, and the main character's things belong to `party`).
  const body = (type, id) => {
    const owner = ownerOf(id, ctx.pcId);
    if (type === 'item.equip') return { stack: item.stack, owner, transfer: true };
    if (type === 'inventory.transfer') return { stack: item.stack, to: owner };
    if (type === 'inventory.bag') return { owner, stack: item.stack };
    return { stack: item.stack, member: id };
  };
  const pick = (label, type) => {
    picker.replaceChildren(
      h('div', { class: 'secl' }, label),
      h('div', { class: 'pick' }, names.map(id => h(
        'button',
        { type: 'button', class: 'mb', dataset: { member: id }, onClick: () => send(type, body(type, id)) },
        portraitEl({ name: memberName(id, ctx), portrait: ctx.portraits?.[id] ?? null }, 'a'), memberName(id, ctx),
      ))),
    );
  };
  const gear = item.kind === 'gear';
  const actions = [];
  // A carried bag is put down (inventory.bag with no stack: a companion's goes back to the party's bag); a gear piece worn in a slot is taken off.
  if (item.isBag && item.wornBy) {
    actions.push(button({ label: 'Put down', tone: 'primary', onClick: () => send('inventory.bag', { owner: ownerOf(item.wornBy, ctx.pcId), stack: null }) }));
    if (gear) actions.push(button({ label: 'Give to…', onClick: () => pick('Give to', 'inventory.transfer') }));
  } else if (gear && item.wornBy) {
    actions.push(button({ label: 'Take off', tone: 'primary', onClick: () => send('inventory.unequip', { stack: item.stack }) }));
    actions.push(button({ label: 'Give to…', onClick: () => pick('Give to', 'inventory.transfer') }));
  } else if (gear) {
    actions.push(button({ label: 'Wear on…', tone: 'primary', onClick: () => pick('Wear on', 'item.equip') }));
  }
  if (item.kind === 'use' && can(ctx, 'item.use')) actions.push(button({ label: 'Use on…', tone: 'primary', onClick: () => pick('Use on', 'item.use') }));
  // An item that can be carried as a bag (gear.view's packs): the member picker sends inventory.bag (the Party Bag slot's command).
  if (item.bagLike) actions.push(button({ label: 'Carry as bag…', tone: actions.length ? undefined : 'primary', onClick: () => pick('Carry as bag', 'inventory.bag') }));
  const kindLabel = KIND_LABEL[item.kind] + (gear && item.glyph ? ` · ${item.glyph === 'bagslot' ? 'Bag' : item.glyph[0].toUpperCase() + item.glyph.slice(1)}` : '');
  const head = withEdit => h('div', { class: 'dh' }, itemTile(item, rpg, 'sm'), h('div', null,
    h('div', { class: 'dn' }, item.name),
    h('div', { class: 'chips' },
      rpg && RARITY_LABEL[item.rarity] ? h('span', { class: ['lvl2', RARITY_CLASS[item.rarity]] }, RARITY_LABEL[item.rarity]) : null,
      h('span', { class: 'lvl2' }, kindLabel),
      item.qty > 1 ? h('span', { class: 'lvl2' }, `×${item.qty}`) : null)),
    withEdit ? h('div', { class: 'bhact' }, button({ label: 'Edit', className: 'edit', onClick: edit }), h('span', { class: 'xgap' })) : null);
  const root = h('div', { class: 'bag-sheet', dataset: { sheet: 'item' } });
  // A gear piece's Stats row: Change opens the picker on its points (the engine's repoint edit), or shows the engine's reason it cannot.
  const stats = rpg && gear ? statsRow(item, { port: ctx.port, open: () => root.replaceChildren(head(false), changeView(item, { port: ctx.port, onDone: () => ctx.close?.(), onCancel: () => root.replaceChildren(...view) })) }) : null;
  const view = [
    head(true),
    h('p', { class: 'desc' }, item.desc),
    details(item, rpg, ctx, stats),
    stats ? stats.line : null,
    h('div', { class: 'brow' }, actions, h('span', { class: 'grow' }),
      button({ label: 'Drop', tone: 'danger', onClick: () => send('inventory.drop', { stack: item.stack }) })),
    picker,
  ].filter(Boolean);
  function edit(focusSlot = false) {
    root.replaceChildren(head(false), itemEditForm(item, {
      rpg,
      onCancel: () => root.replaceChildren(...view),
      // The edit first, then Carries on the stack the edit leaves (a rename of a shared piece gives it a definition of its own: the carry lands on that one).
      onSave: async (payload, carry) => {
        const result = payload ? await ctx.port?.command('inventory.edit', payload) : null;
        if (result && result.ok === false) return result;
        if (carry !== null && carry !== undefined) {
          const set = await ctx.port?.command('inventory.carry', { stack: result?.receipt?.data?.stack ?? item.stack, carry });
          if (set && set.ok === false) return payload ? { ...set, message: `The other changes are saved. ${set.message ?? ''}`.trim() } : set;
        }
        ctx.close?.();
        return result;
      },
    }));
    if (focusSlot) root.querySelector('[data-field="slot"]')?.focus();
  }
  root.replaceChildren(...view);
  return root;
}
