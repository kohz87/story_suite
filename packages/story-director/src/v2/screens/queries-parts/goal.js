// Story Director v2, part screens: the quest views: the current goal (`director.goal`) and the quest board.

import { queryFrom } from './shared-ask.js';
import { isOffer, isOpen, threadsOf } from './shared-threads.js';
import { text } from './shared-words.js';

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

// The steps a quest has been through, the current one last: the thread's trail, else just its current step.
const stepsOf = thread => {
    const kept = Array.isArray(thread.steps) ? thread.steps.map(text).filter(Boolean) : [];
    const step = text(thread.fields?.step);
    return kept.length && step && step.startsWith(kept.at(-1)) ? kept : [step].filter(Boolean);
};

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
        steps: stepsOf(thread),
        reward: text(thread.fields?.reward),
        difficulty: text(thread.fields?.difficulty).toLowerCase(),
    });
    return { active: quests.filter(thread => !isOffer(thread)).map(row), offers: quests.filter(isOffer).map(row) };
}
