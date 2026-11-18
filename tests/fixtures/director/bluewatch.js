// The Bluewatch starter in pack format 4 (job C2): the world pack and the game pack the director, time and atlas tests install. The bytes are pinned: they are what
// `node scripts/packs/convert-3to4.mjs` made of the old format 1 fixture (see docs/dev/packs.md), kept here as plain files.
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
export const BLUEWATCH_WORLD = read('ersveil-bluewatch.pack.json');
export const BLUEWATCH_GAME = read('ersveil-bluewatch.game.json');

/** Installs the world and then the game into `packs` (a host's `host.packs.packs`); each is selected as the first of its kind. → the world's install result. */
export async function installBluewatch(packs) {
    const world = await packs.install(BLUEWATCH_WORLD, { origin: 'pack.json' });
    const game = await packs.install(BLUEWATCH_GAME, { origin: 'game.json' });
    if (world.ok && !game.ok) return game;
    return world;
}

/** The Bluewatch calendar as a format 3 pack writes it (era, months, and a start with the month by name): for tests that still build a format 3 pack of their own. */
export function formatThreeCalendar() {
    const months = JSON.parse(BLUEWATCH_GAME).content.calendar.months;
    const { era, year, month, day, hour, minute } = JSON.parse(BLUEWATCH_WORLD).content.start.date;
    return { era, months, start: { year, month: months[month - 1].name, day, hour, minute } };
}
