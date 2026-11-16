// Building the optional prompt tail lines for the people present.
import { lieTail } from '../npc-notes-lies.js';
import { knowsTail } from '../npc-notes-knows.js';
import { tasteTail } from '../npc-notes-tastes.js';
import { NOTES_TAIL_PER_NPC, NOTES_TAIL_MAX } from './consts.js';

/**
 * The optional tail lines for the people present this reply. `record` maps a person's key to { name, lies, knows, tastes } (their
 * stored leaves); `ctx.present` lists the keys nearest-relevant first. Per person up to NOTES_TAIL_PER_NPC lines, in the order
 * uncaught lie, secret or fact, taste; at most NOTES_TAIL_MAX lines in all (the nearer people fill it first). Ties and drives have
 * no tail. → string[] (every line is optional for the host's budget).
 */
export function notesTail(record, { present = [] } = {}) {
    const out = [];
    for (const key of Array.isArray(present) ? present : []) {
        if (out.length >= NOTES_TAIL_MAX) break;
        const person = record?.[key];
        if (!person || typeof person !== 'object') continue;
        const name = person.name;
        const lines = [
            lieTail(name, person.lies),
            ...knowsTail([{ name, knows: person.knows }]),
            tasteTail(name, person.tastes),
        ].filter(Boolean);
        out.push(...lines.slice(0, Math.min(NOTES_TAIL_PER_NPC, NOTES_TAIL_MAX - out.length)));
    }
    return out;
}
