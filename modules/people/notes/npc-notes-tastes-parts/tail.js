// The optional taste tail line for a present NPC: the newest like and dislike.
import { clean } from '../npc-meters-config.js';
import { LIKE, DISLIKE } from './shared-limits.js';
import { readTastes } from './record.js';

/** The optional tail line for a present NPC: the newest like and the newest dislike, mirrored ones left out. '' when none. */
export function tasteTail(name, tastes) {
    const list = readTastes(tastes).filter(row => !row.mirrored);
    const newest = sign => [...list].reverse().find(row => row.sign === sign);
    const like = newest(LIKE);
    const dislike = newest(DISLIKE);
    const parts = [like && `likes ${like.item}`, dislike && `dislikes ${dislike.item}`].filter(Boolean);
    if (!parts.length) return '';
    return `${clean(name, 60) || 'The NPC'} ${parts.join('; ')}.`;
}
