// Word helpers shared by gear's slot, rarity and stat-choice readers: a text as lowercase words, a word as its singular.

export const words = text => String(text ?? '').normalize('NFKC').toLowerCase().split(/[^a-z]+/).filter(Boolean);
export const singular = word => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);
