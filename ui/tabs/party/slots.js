// Builds the equipment doll: five slots each side of the portrait, one glyph per slot type, rarity edge, dashed when empty.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { SLOT_META, slotSheet } from './slot-picker.js';
import { carrierSheet } from './carrier-picker.js';
import { isSafePortraitUrl } from '../../kit/safe-url.js';

const LEFT = ['head', 'armor', 'cloak', 'feet', 'mount'];
const RIGHT = ['weapon', 'offhand', 'accessory1', 'accessory2', 'bag'];
const RARITY_CLASS = { uncommon: 'r-unc', rare: 'r-rare', epic: 'r-epic' };
// The Mount and Bag slots hold a mount (its pace) and a carried bag (the load it adds), each with its own sheet.
const CARRIER = { mount: item => (item.pace ? `${item.pace} km/day` : ''), bag: item => (item.carry ? `+${item.carry} load` : '') };

/** Builds a round portrait: a background image when the value looks like a path or data URL, else the initial. */
export function portraitEl(member, className) {
  const src = member.portrait;
  const style = isSafePortraitUrl(src) ? { 'background-image': `url("${src}")` } : null;
  return h('span', { class: className, style, dataset: { portrait: src ?? null }, 'aria-hidden': 'true' }, style ? null : member.name.slice(0, 1));
}

function slotButton(member, key, ctx) {
  const [glyphName, label, short] = SLOT_META[key];
  const item = member.slots.find(s => s.key === key)?.item ?? null;
  const extra = item && CARRIER[key] ? CARRIER[key](item) : '';
  const named = item ? [item.name, extra].filter(Boolean).join(', ') : 'empty';
  return h(
    'button',
    {
      type: 'button',
      class: ['slot', item ? RARITY_CLASS[item.rarity] : 'empty'],
      dataset: { slot: key },
      'aria-label': `${label}: ${named}${item?.torn ? ', torn' : ''}`,
      title: item ? named : `${label}: empty, tap to ${CARRIER[key] ? 'choose' : 'equip'}`,
      onClick: () => (CARRIER[key] ? carrierSheet : slotSheet)(member, key, ctx),
    },
    h('span', { class: 'si' }, glyph(glyphName)),
    h('span', { class: 'sx' }, h('small', null, h('span', { class: 'lf' }, extra ? `${label} · ${extra}` : label), h('span', { class: 'ls' }, short)), h('b', null, item ? item.name : 'empty')),
    item?.torn ? h('span', { class: 'torn', title: 'Torn' }, glyph('crack')) : null,
  );
}

/** Builds the doll for one member: left column, big portrait, right column; every slot opens the slot sheet. */
export function slotsDoll(member, ctx = {}) {
  return h(
    'div',
    { class: 'doll' },
    h('div', { class: 'dcol' }, LEFT.map(k => slotButton(member, k, ctx))),
    portraitEl(member, 'big'),
    h('div', { class: 'dcol right' }, RIGHT.map(k => slotButton(member, k, ctx))),
  );
}
