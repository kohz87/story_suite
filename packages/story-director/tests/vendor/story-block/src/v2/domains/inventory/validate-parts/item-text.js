// Writes an item's name with its count ("Potion ×3").

export const itemText = (name, qty) => (qty === 1 ? name : `${name} ×${qty}`);
