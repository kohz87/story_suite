// The open quests' stated rewards, for the money guard: a payment that is exactly an open quest's reward (from its giver, when it names one) is not "far above the purse".

const text = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();

/** The open quests of a state as [{ reward, giver }] (lower-cased text), only those with a reward. */
export function openRewards(state) {
    const threads = state?.domains?.director?.threads;
    if (!threads || typeof threads !== 'object') return [];
    return Object.values(threads)
        .filter(thread => thread?.kind === 'quest' && thread.status === 'active' && text(thread.fields?.reward))
        .map(thread => ({ reward: text(thread.fields.reward), giver: text(thread.fields?.giver) }));
}

/** True when `amount` paid `from` source is the stated reward of one of the open quests (the amount as a whole number in its reward text; the giver, when stated, in the source). */
export function isQuestReward(amount, source, rewards) {
    const from = text(source);
    return (rewards ?? []).some(quest => {
        const numbers = quest.reward.match(/\d+/gu) ?? [];
        return numbers.some(number => Number(number) === amount) && (!quest.giver || !from || from.includes(quest.giver) || quest.giver.includes(from));
    });
}
