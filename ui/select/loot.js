// Turns the `inventory.loot` answer into the loot view-model (LOOT_OFFER_SHAPE): each offer's things as labels to pick by their index.

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');

// A thing's chip label: "Healing draught ×2"; money comes already worded ("12 gold") with a count of 1.
const labelOf = item => {
  const name = text(item.name);
  return Number.isSafeInteger(item.qty) && item.qty > 1 ? `${name} ×${item.qty}` : name;
};

/** `inventory.loot` answer (an array of { sid, where, items, taken? }) → [{ sid, where, taken, items: [{ at, label }] }]; [] for no answer (the loot feature off) or none laid out. */
export function selectLoot(answer) {
  if (!Array.isArray(answer)) return [];
  return answer.filter(offer => isRec(offer) && text(offer.sid) && Array.isArray(offer.items)).map(offer => ({
    sid: offer.sid,
    where: text(offer.where),
    taken: offer.taken === true,
    // the index is the offer's own (inventory.lootTake picks by it), so it is kept before anything is left out
    items: offer.items.map((item, at) => ({ at, label: isRec(item) ? labelOf(item) : '' })).filter(item => item.label),
  })).filter(offer => offer.items.length);
}
