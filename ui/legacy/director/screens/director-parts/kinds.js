// Story Director v2, part screens: the thread kinds the Director screen groups, in order, with their headings.

import { BEHIND } from '../reveal.js';

/** The kinds in the order the screen shows them, with their headings (the tracker tab's order). */
export const KIND_GROUPS = Object.freeze([
    ['quest', 'Quests'], ['hook', 'Hooks'], ['agenda', 'Off-screen'], ['event', 'World'],
    ['clock', 'Clocks'], ['beat', 'Beats'], ['secret', 'Secrets'],
]);

/** The kinds the template itself draws: what the reader may see (the rest is behind the scenes, behind.js). */
export const OPEN_KIND_GROUPS = Object.freeze(KIND_GROUPS.filter(([kind]) => !BEHIND.has(kind)));
