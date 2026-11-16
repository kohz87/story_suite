// The fishing tables: the waters, the rarities, the quality grades and what bites where.

export const WATERS = Object.freeze(['river', 'lake', 'sea']);
export const RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']);

// Quality: odds out of 100 and the value it is worth, in percent of the base.
export const QUALITIES = Object.freeze([
    Object.freeze({ id: 'poor', odds: 15, worth: 60 }),
    Object.freeze({ id: 'fair', odds: 45, worth: 100 }),
    Object.freeze({ id: 'fine', odds: 30, worth: 130 }),
    Object.freeze({ id: 'prime', odds: 10, worth: 180 }),
]);

// What bites where. `odds` are relative weights; `min`/`max` the weight in grams; `perKg` the base value
// of one kilogram in the smallest coin (on the default copper / silver = 10 / gold = 10 scale, a common
// fish is a few copper and a legendary one a few gold).
const fish = (name, rarity, odds, min, max, perKg) => Object.freeze({ name, rarity, odds, min, max, perKg });
export const SPECIES = Object.freeze({
    river: Object.freeze([
        fish('Perch', 'common', 60, 150, 900, 6),
        fish('Brown Trout', 'common', 50, 300, 2500, 8),
        fish('Grayling', 'uncommon', 30, 300, 1500, 14),
        fish('Barbel', 'uncommon', 24, 1000, 6000, 10),
        fish('Spotted Salmon', 'rare', 12, 3000, 12000, 22),
        fish('River Sturgeon', 'epic', 4, 10000, 60000, 18),
        fish('Ghostfin Eel', 'legendary', 1, 1000, 5000, 180),
    ]),
    lake: Object.freeze([
        fish('Roach', 'common', 60, 100, 600, 5),
        fish('Bream', 'common', 50, 500, 4000, 6),
        fish('Tench', 'uncommon', 30, 500, 3500, 12),
        fish('Pike', 'uncommon', 24, 1500, 12000, 9),
        fish('Silver-violet Trout', 'rare', 12, 1500, 6000, 30),
        fish('Deepwater Char', 'epic', 4, 2000, 9000, 55),
        fish('Moonveil Carp', 'legendary', 1, 8000, 30000, 40),
    ]),
    sea: Object.freeze([
        fish('Mackerel', 'common', 60, 200, 900, 7),
        fish('Sea Bream', 'common', 50, 300, 2500, 9),
        fish('Cod', 'uncommon', 30, 1000, 12000, 8),
        fish('Sea Bass', 'uncommon', 24, 1000, 6000, 14),
        fish('Silverjack', 'rare', 12, 2000, 10000, 24),
        fish('Swordfish', 'epic', 4, 20000, 90000, 12),
        fish('Abyssal Lanternfish', 'legendary', 1, 500, 3000, 600),
    ]),
});
