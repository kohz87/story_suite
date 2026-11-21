// The seeded pick from an encounter table: one draw from (campaign seed, story day, scene key), so the same day, scene and place give
// the same encounter on every swipe and Re-read, and a later scene draws anew. Pure.

import { seededDraw } from '../../daily/chance.js';

/** The scene key a roll is seeded by: the place and the part of the day (one encounter at most per place and part of a day). */
export const sceneKey = (place, time) => `encounter|${place.key}|${time || 'any'}`;

/** `rollEncounter(rows, { seed, day, key })` → `{ row, draw }`: the row the draw lands on by weight (rows in their table order); null row for an empty table. */
export function rollEncounter(rows, { seed, day, key }) {
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    const draw = seededDraw(seed, day, key);
    if (!(total > 0)) return { row: null, draw };
    let at = draw * total;
    for (const row of rows) {
        if (at < row.weight) return { row, draw };
        at -= row.weight;
    }
    return { row: rows.at(-1), draw };
}
