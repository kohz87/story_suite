// Story Director v2, part screens: the quest views: the current goal (`director.goal`) and the quest board.

import { queryFrom } from './shared-ask.js';
import { isOffer, isOpen, threadsOf } from './shared-threads.js';
import { text } from './shared-words.js';
import { clipStep, stepsFor } from '../../tracker/capture-parts/step-trail.js';

// The trail while its last step is the quest's step now; else just that step (none when it is cleared).
const current = (trail, step) => (step && trail.at(-1) === clipStep(step) ? trail : [step].filter(Boolean));

export const FINISHED_SHOWN = 20;

/**
 * `director.goal` → the active quest touched most recently (highest `rev`; the tracker's order breaks
 * a tie), not an open offer: `{ id, key, goal, step, giver, due, taken }`, or null.
 */
export function currentGoal(state, args, tools) {
    const quests = threadsOf(state, queryFrom(tools), { status: 'active' }).filter(thread => isOpen(thread) && !isOffer(thread)
        && (thread.kind === 'quest' || thread.rpg || thread.acceptance));
    let best = null;
    for (const thread of quests) if (!best || (thread.rev ?? 0) > (best.rev ?? 0)) best = thread;
    if (!best) return null;
    const fields = best.fields ?? {};
    return {
        id: best.id,
        key: text(best.key),
        goal: text(fields.goal) || text(best.summary),
        step: text(fields.step),
        giver: text(fields.giver),
        due: text(fields.due),
        taken: Boolean(best.taken),
    };
}

/** Story-told quests on the Home screen, using only Director threads: `{ id, key, goal, status, meter, step, steps, reward, difficulty }` (a gap is ''). */
export function questBoard(state, _args, tools) {
    const quests = threadsOf(state, queryFrom(tools), { kind: 'quest', status: 'active' }).filter(isOpen);
    const row = thread => ({
        id: thread.id,
        key: text(thread.key),
        goal: text(thread.fields?.goal) || text(thread.summary),
        status: isOffer(thread) ? { state: 'offered', text: 'Offered' } : { state: 'active', text: 'Under way' },
        meter: false,
        step: text(thread.fields?.step),
        steps: current(stepsFor(state?.domains?.director, thread.id), text(thread.fields?.step)),
        reward: text(thread.fields?.reward),
        difficulty: text(thread.fields?.difficulty).toLowerCase(),
    });
    return { active: quests.filter(thread => !isOffer(thread)).map(row), offers: quests.filter(isOffer).map(row) };
}
