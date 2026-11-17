// The stat budget: points left, the summary line and how far a stat may move.

import { statsOf } from './stat-list.js';
import { draftCreation } from './creation.js';

/** How low and how high a stat may be set: 5 to 10 at creation (the start to the cap), and never off the value an imported character came with. */
export function statBounds(draft, stat) {
    const base = draft?.from?.stats?.[stat], creation = draftCreation(draft);
    return Number.isSafeInteger(base) ? [Math.min(creation.min, base), Math.max(creation.max, base)] : [creation.min, creation.max];
}

/** Points left: the budget (an imported character's own points) minus what the stats cost (a stat above where it starts costs a point a step; below it gives one back). */
export const pointsLeft = draft => (draft.from ? draft.from.points : draftCreation(draft).budget)
    - statsOf(draft).reduce((sum, stat) => sum + draft.stats[stat] - (draft.from ? draft.from.stats[stat] : draftCreation(draft).start), 0);

/** "STR 14 · VIT 12 · …" for the summary row. */
export const statsLine = draft => statsOf(draft).map(stat => `${stat.toUpperCase()} ${draft.stats[stat]}`).join(' · ');
