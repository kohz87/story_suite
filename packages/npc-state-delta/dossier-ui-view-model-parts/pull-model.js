/* NPC State Delta dossier view-model part: the Pull tile: the instinct word with its strength ring. */
import { object } from './shared-object.js';

// Pull: the instinct word with a strength ring and "high · 2 days". Null (no tile) without one.
const PULL_WORDS = ['Belonging', 'Closure', 'Awe'];
export const pullWord = kind => PULL_WORDS.find(word => word.toLowerCase() === kind) || '';
const STRENGTH = ['', 'low', 'medium', 'high'];
export function pullTile(npc) {
    const pull = object(npc.v2Meters).pull;
    if (!pull) return null;
    const days = pull.days === 1 ? '1 day' : `${pull.days} days`;
    return { title: 'Pull', text: pullWord(pull.kind), level: pull.level, note: `${[STRENGTH[pull.level], days].filter(Boolean).join(' · ')}`, cause: pull.cause, fresh: pull.days === 0 };
}
