// Story Director v2, part screens: what a quest card shows of a thread: whether it is a quest, its chip and its short rows.

/** The threads the Quests screen lists (the same test the plain list in the template makes). */
export const isQuestThread = thread => thread != null && typeof thread === 'object'
    && (thread.kind === 'quest' || (thread.rpg ?? null) !== null || (thread.fields?.goal ?? null) !== null);

const OUTCOME_CHIPS = Object.freeze({
    done: ['Done', 'good'],
    failed: ['Failed', 'bad'],
    abandoned: ['Abandoned', 'bad'],
    declined: ['Declined', 'bad'],
    superseded: ['Superseded', 'neutral'],
});

export const text = value => (typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '');

/** `{ label, tone }` of a thread's chip. */
export function chipOf(thread) {
    if (thread.status === 'active') return thread.offer ? { label: 'Offered', tone: 'neutral' } : { label: 'Active', tone: 'accent' };
    const [label, tone] = OUTCOME_CHIPS[thread.ended?.outcome] ?? [thread.status === 'resolved' ? 'Finished' : text(thread.status) || 'Finished', 'neutral'];
    return { label, tone };
}

/** The short rows of a card, only those that are set (difficulty "normal" is left out). */
export function rowsOf(thread) {
    const fields = thread.fields ?? {};
    const rows = [];
    for (const [name, label] of [['progress', 'Progress'], ['giver', 'Giver'], ['reward', 'Reward'], ['difficulty', 'Difficulty'], ['due', 'Due']]) {
        const value = text(fields[name]);
        if (!value) continue;
        if (name === 'difficulty' && value.toLowerCase() === 'normal') continue;
        rows.push([label, value]);
    }
    return rows;
}
