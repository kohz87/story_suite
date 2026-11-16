// Reads the story's rank scale as one line for the foe pre-check's prompt.

import { bandsOf, packLevelsOf } from '../../levels.js';
import { ask, cut } from './shared-text.js';

/** The scale as one line, "Ranks: F 1-9, E 10-19", or '' when the story has no ranks. */
export function rankScale(query) {
    const ranks = bandsOf(packLevelsOf(ask(query, 'packs.content', { kind: 'rpg' }))?.ranks);
    return ranks.length ? `Ranks: ${ranks.map(rank => `${cut(rank.name, 24)} ${rank.from}-${rank.to}`).join(', ')}` : '';
}
