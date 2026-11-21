// Companions the story has away, for the fight board (pure; Settings → RPG "Companions who are away wait", off unless set).
// An open absence is read from the `away` domain (modules/people/away): the person's name folded as the sheet's `key`. At open, the companions who wait are
// recorded in the fight's setup (`waits: [{ id, label, level }]`), so every later play, swipe, Re-read, rewind and reload settles the same fight.

import { fold } from '../read.js';

/** The standing heroes on `sheet` with an open absence in `slice` (the `away` domain), as `[{ id, label, level }]` in the sheet's order; none when that would leave nobody to fight. */
export function waitsOf(slice, sheet, standing) {
    const away = slice && typeof slice === 'object' && slice.away && typeof slice.away === 'object' ? Object.values(slice.away) : [];
    const gone = new Set(away.filter(record => record && typeof record === 'object' && !Object.hasOwn(record, 'home') && typeof record.name === 'string').map(record => fold(record.name)));
    const heroes = sheet.characters.filter(standing);
    const waits = heroes.filter(character => gone.has(character.key));
    return waits.length && waits.length < heroes.length ? waits.map(character => ({ id: character.key, label: String(character.who ?? character.key), level: Number(character.level) || 1 })) : [];
}

/** The fight's input without the companions who wait (`setup.waits`). */
export const withoutWaits = (input, setup) => (Array.isArray(setup?.waits) && setup.waits.length
    ? { ...input, party: input.party.filter(hero => !setup.waits.some(wait => wait.id === hero.id)) } : input);

/** What a waiting companion is paid of a won fight's XP, `percent` of what a hero of their level earns (whole XP, at least 1 when that earns anything). */
export const waitShare = (xp, percent) => (xp > 0 && percent > 0 ? Math.max(1, Math.floor(xp * percent / 100)) : 0);
