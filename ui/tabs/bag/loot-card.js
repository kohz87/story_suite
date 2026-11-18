// Builds the Bag's "To pick up" card: every reply's loot not taken yet, newest first, each with its chips and Take selected.
import { h } from '../../kit/dom.js';
import { lootPick } from '../../kit/loot-pick.js';

/** Builds the To pick up card from the bag view-model's `loot` (LOOT_OFFER_SHAPE offers); ctx = { port }. Null when nothing is laid out. */
export function lootCard(bag, ctx = {}) {
  const offers = Array.isArray(bag?.loot) ? bag.loot.filter(offer => !offer.taken && offer.items?.length) : [];
  if (!offers.length) return null;
  const onTake = (sid, pick) => ctx.port?.command('inventory.lootTake', { sid, pick });
  return h(
    'section',
    { class: 'card glass loot', dataset: { card: 'loot' } },
    h('div', { class: 'ch' }, h('h3', null, 'To pick up'), h('span', { class: 'cnt' }, offers.length === 1 ? 'from the story' : `${offers.length} places`)),
    offers.map(offer => lootPick(offer, { look: 'bag', onTake })),
  );
}
