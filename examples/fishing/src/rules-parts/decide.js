// Deciding a catch from a seed: the fish, when it bites, how long the window is and whether a press lands in it.
import { SPECIES, QUALITIES } from './tables.js';

// The bite: when it comes (ms after the cast) and how long the reader has to press Reel. Rarer fish
// give a shorter window.
const BITE_MIN = 1500;
const BITE_SPREAD = 4000;
const WINDOW_BASE = Object.freeze({ common: 1100, uncommon: 950, rare: 800, epic: 650, legendary: 500 });
const WINDOW_SPREAD = 200;

/** One entry of `list`, chosen by its `odds`. */
export function pickWeighted(rng, list) {
    const total = list.reduce((sum, entry) => sum + entry.odds, 0);
    let roll = rng() * total;
    for (const entry of list) {
        roll -= entry.odds;
        if (roll < 0) return entry;
    }
    return list[list.length - 1];
}

/** The fish: { name, rarity, grams, quality, value } (grams and value whole numbers, value >= 1). */
export function decideCatch(rng, water) {
    const table = SPECIES[water];
    if (!table) throw new Error(`There are no fish tables for "${water}".`);
    const species = pickWeighted(rng, table);
    const r = rng();
    const grams = species.min + Math.floor((species.max - species.min) * r * r);   // big ones are rarer
    const quality = pickWeighted(rng, QUALITIES);
    const value = Math.max(1, Math.round(species.perKg * grams * quality.worth / 100000));
    return { name: species.name, rarity: species.rarity, grams, quality: quality.id, value };
}

/** When it bites and for how long it can be hooked, in whole milliseconds. Drawn after decideCatch. */
export function decideBite(rng, rarity) {
    const bite = BITE_MIN + Math.floor(rng() * BITE_SPREAD);
    const window = (WINDOW_BASE[rarity] ?? WINDOW_BASE.common) + Math.floor(rng() * WINDOW_SPREAD);
    return { bite, window };
}

/** True when a press `elapsed` ms after the cast lands inside the bite window. */
export function inWindow(elapsed, timing) {
    return elapsed >= timing.bite && elapsed <= timing.bite + timing.window;
}
