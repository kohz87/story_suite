// Builds the item sheet body: tile, rarity and kind chips, details, and the Wear on / Take off / Give to / Use on / Drop actions.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { itemTile, memberName, KIND_LABEL } from './item-grid.js';

const RARITY_LABEL = { uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic' };
const RARITY_CLASS = { uncommon: 'rar-unc', rare: 'rar-rare', epic: 'rar-epic' };

function row(label, ...value) {
  return [h('dt', null, label), h('dd', null, ...value)];
}

function weightText(item) {
  if (!item.weight) return 'No weight';
  return item.qty > 1 ? `${item.weight * item.qty} load · ${item.weight} each × ${item.qty}` : `${item.weight} load`;
}

function details(item, rpg, ctx) {
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
    wear,
    rpg ? row('Weight', weightText(item)) : [],
    row('Worth here', item.worth),
    item.from ? row('From', h('span', { class: 'bfrom' }, `${item.from} ›`)) : [],
  );
}

/** Builds the item sheet body; ctx = { rpg, members, port, close() }. Actions send commands through ctx.port. */
export function itemSheet(item, ctx = {}) {
  const rpg = Boolean(ctx.rpg);
  const names = Object.keys(ctx.members ?? {});
  const picker = h('div', { class: 'pick-wrap' });
  const send = (type, payload) => {
    ctx.port?.command(type, payload);
    ctx.close?.();
  };
  const pick = (label, type) => {
    picker.replaceChildren(
      h('div', { class: 'secl' }, label),
      h('div', { class: 'pick' }, names.map(id => h(
        'button',
        { type: 'button', class: 'mb', dataset: { member: id }, onClick: () => send(type, { stack: item.stack, member: id }) },
        h('span', { class: 'a', dataset: { portrait: id } }), memberName(id, ctx),
      ))),
    );
  };
  const gear = item.kind === 'gear';
  const actions = [];
  if (gear && item.wornBy) {
    actions.push(button({ label: 'Take off', tone: 'primary', onClick: () => send('inventory.unequip', { stack: item.stack, member: item.wornBy }) }));
    actions.push(button({ label: 'Give to…', onClick: () => pick('Give to', 'inventory.transfer') }));
  } else if (gear) {
    actions.push(button({ label: 'Wear on…', tone: 'primary', onClick: () => pick('Wear on', 'item.equip') }));
  }
  if (item.kind === 'use') actions.push(button({ label: 'Use on…', tone: 'primary', onClick: () => pick('Use on', 'item.use') }));
  const kindLabel = KIND_LABEL[item.kind] + (gear && item.glyph ? ` · ${item.glyph === 'bagslot' ? 'Bag' : item.glyph[0].toUpperCase() + item.glyph.slice(1)}` : '');
  return h(
    'div',
    { class: 'bag-sheet', dataset: { sheet: 'item' } },
    h('div', { class: 'dh' }, itemTile(item, rpg, 'sm'), h('div', null,
      h('div', { class: 'dn' }, item.name),
      h('div', { class: 'chips' },
        rpg && RARITY_LABEL[item.rarity] ? h('span', { class: ['lvl2', RARITY_CLASS[item.rarity]] }, RARITY_LABEL[item.rarity]) : null,
        h('span', { class: 'lvl2' }, kindLabel),
        item.qty > 1 ? h('span', { class: 'lvl2' }, `×${item.qty}`) : null))),
    h('p', { class: 'desc' }, item.desc),
    details(item, rpg, ctx),
    h('div', { class: 'brow' }, actions, h('span', { class: 'grow' }),
      button({ label: 'Drop', tone: 'danger', onClick: () => send('inventory.drop', { stack: item.stack }) })),
    picker,
  );
}
