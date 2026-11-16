// The mount carry table: what one mount of a kind carries, and what a story item's name adds.

export const KIND_CARRY = Object.freeze({
    pony: 30, horse: 40, mule: 50, donkey: 50, cart: 60, barrow: 60, sledge: 60, carriage: 80, coach: 80, boat: 100, barge: 150, wagon: 150,
});
export const OTHER_CARRY = 20;
const WORD_KIND = Object.freeze({
    horses: 'horse', ponies: 'pony', mules: 'mule', donkeys: 'donkey', carts: 'cart', barrows: 'barrow', sledges: 'sledge', carriages: 'carriage',
    coaches: 'coach', wagons: 'wagon', boats: 'boat', barges: 'barge', handcart: 'cart', handcarts: 'cart',
});

/** What one mount of this kind carries: pony 30, horse 40, mule/donkey/pack animal 50, cart/barrow/hand-cart/sledge 60, carriage/coach 80, boat 100, barge/wagon 150, other 20. */
export function kindCarry(kind) {
    const text = String(kind ?? '').normalize('NFKC').toLowerCase();
    if (/pack[\s-]*(animal|beast|horse|pony)/.test(text)) return 50;
    for (const word of text.split(/[^a-z]+/).filter(Boolean)) {
        const base = WORD_KIND[word] ?? word;
        if (Object.hasOwn(KIND_CARRY, base)) return KIND_CARRY[base];
    }
    return OTHER_CARRY;
}

/** The capacity a story item adds by its name (cart, barrow, hand-cart, sledge 60; carriage, coach 80; barge, wagon 150: the mount table), or null. */
export function itemCarryOf(name) {
    const words = String(name ?? '').normalize('NFKC').toLowerCase().split(/[^a-z]+/).filter(Boolean).map(word => word.replace(/^(coach)es$/, '$1').replace(/s$/, ''));
    if (words.some(word => word === 'wagon' || word === 'barge')) return KIND_CARRY.wagon;
    if (words.some(word => word === 'carriage' || word === 'coach')) return KIND_CARRY.carriage;
    if (words.some(word => ['cart', 'handcart', 'sledge'].includes(word) || word.endsWith('barrow'))) return KIND_CARRY.cart;
    return null;
}
