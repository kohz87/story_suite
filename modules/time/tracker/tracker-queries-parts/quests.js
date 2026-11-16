// Reading closed quest outcomes and quests finished in a reply.

import { questDifficulty } from '../changes.js';
import { FAILED } from '../tracker-said.js';

// (0.9.19) A closed quest's own reason, read for the Journal: given up is the reader's choice,
// failed is the story's, anything else is done.
const ABANDONED = /\b(?:abandon|gave up|give up|given up|giving up|forfeit|quit\b|walked away|backed out|withdr[eao]w)/i;

/** How a closed quest ended: 'done' | 'failed' | 'abandoned', or null (open, or merged into another). */
export function questOutcome(record) {
    if (record?.kind !== 'quest' || record.status !== 'resolved') return null;
    const reason = String(record.resolved?.reason ?? '');
    if (ABANDONED.test(reason)) return 'abandoned';
    return FAILED.test(reason) ? 'failed' : 'done';
}

/**
 * The quests finished in the reply at `message`: closed there with a `-` line that is not a
 * failure (failed, abandoned, expired…) or a supersession, as `[{ id, name, type, difficulty,
 * reward, giver }]` plain copies; quests finished earlier are not listed.
 */
export function questsDoneIn(tracker, message) {
    const at = Number(message);
    if (!Number.isInteger(at)) return [];
    const text = value => String(value ?? '').trim();
    return (tracker?.records ?? [])
        .filter(record => record.kind === 'quest' && record.status === 'resolved'
            && record.resolved?.message === at && !FAILED.test(record.resolved?.reason ?? ''))
        .map(record => ({
            id: record.id,
            name: record.key,
            type: text(record.fields?.type),
            difficulty: questDifficulty(record.fields?.difficulty),
            reward: text(record.fields?.reward),
            giver: text(record.fields?.giver),
        }));
}
