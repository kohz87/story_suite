// The open quests' stated rewards, for the money guard: a payment that is exactly an open quest's reward (from its giver, when it names one) is not "far above the purse".

import { parseAmount } from '../../../modules/inventory/money.js';

const text = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();

// "2 silver" is 20 where silver is worth 10: what the reward text means in the smallest coin.
function amountOf(reward, currency) {
    try { return parseAmount(String(reward), currency).amount ?? 0; } catch { return 0; }
}

/** The open quests of a state as [{ reward, giver, amount }] (lower-cased text; `amount` is the reward in the currency's smallest coin when it reads as money, else 0), only those with a reward. */
export function openRewards(state, currency = null) {
    const threads = state?.domains?.director?.threads;
    if (!threads || typeof threads !== 'object') return [];
    return Object.values(threads)
        .filter(thread => thread?.kind === 'quest' && thread.status === 'active' && text(thread.fields?.reward))
        .map(thread => ({ reward: text(thread.fields.reward), giver: text(thread.fields?.giver), amount: amountOf(thread.fields.reward, currency) }));
}

/** True when `amount` paid `from` source is the stated reward of one of the open quests (the amount as a whole number in its reward text; the giver, when stated, in the source). */
export function isQuestReward(amount, source, rewards) {
    const from = text(source);
    return (rewards ?? []).some(quest => {
        const numbers = quest.reward.match(/\d+/gu) ?? [];
        return (quest.amount === amount || numbers.some(number => Number(number) === amount)) && (!quest.giver || !from || from.includes(quest.giver) || quest.giver.includes(from));
    });
}
