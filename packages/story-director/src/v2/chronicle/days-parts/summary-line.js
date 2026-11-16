// Story Director v2, chronicle part: formatting money, fight, and summary lines for a day digest. Pure.

import { cut, flat } from './shared-text.js';
import { isInt } from './shared-values.js';
import { MAX_LINE } from './text-caps.js';

// ---- the one line -----------------------------------------------------------------------------

const unitOf = (amount, currency) => {
    const name = flat(currency?.name) || 'coin';
    const plural = flat(currency?.plural) || `${name}s`;
    return `${amount} ${amount === 1 ? name : plural}`;
};
const listed = (items, max = 3) => (items.length > max ? `${items.slice(0, max).join(', ')} and ${items.length - max} more` : items.join(', '));

/** The money of a day as words: "150 marks in, 20 out" ('' when nothing moved). */
export function moneyText(money, currency) {
    const income = isInt(money?.in) ? money.in : 0;
    const spent = isInt(money?.out) ? money.out : 0;
    if (!income && !spent) return '';
    if (income && spent) return `${unitOf(income, currency)} in, ${spent} out`;
    return income ? `${unitOf(income, currency)} in` : `${unitOf(spent, currency)} out`;
}

/** The fights of a day as words: "2 fights (1 won, 1 fled)" ('' when there were none). */
export function fightText(fights) {
    if (!isInt(fights?.count) || fights.count <= 0) return '';
    const parts = ['won', 'lost', 'fled'].filter(word => fights[word] > 0).map(word => `${fights[word]} ${word}`);
    return `${fights.count} ${fights.count === 1 ? 'fight' : 'fights'}${parts.length ? ` (${parts.join(', ')})` : ''}`;
}

/**
 * The day's one line: its date and the facts in a fixed order, at most 200 code points.
 * "June 3, 1200: to Harrow, Old Weir; took on Rat Cellar; finished Lost Ring; 2 fights (2 won); 150 marks in, 20 out; 1 NPC stage moved; 1 world event."
 */
export function dayLine(date, facts, { currency = null } = {}) {
    const parts = [];
    if (facts.places.length) parts.push(`to ${listed(facts.places)}`);
    if (facts.quests.taken.length) parts.push(`took on ${listed(facts.quests.taken)}`);
    if (facts.quests.done.length) parts.push(`finished ${listed(facts.quests.done)}`);
    if (facts.quests.failed.length) parts.push(`failed ${listed(facts.quests.failed)}`);
    if (facts.quests.dropped.length) parts.push(`gave up ${listed(facts.quests.dropped)}`);
    const fought = fightText(facts.fights);
    if (fought) parts.push(fought);
    const paid = moneyText(facts.money, currency);
    if (paid) parts.push(paid);
    if (facts.npcs.length) parts.push(`${facts.npcs.length} NPC ${facts.npcs.length === 1 ? 'stage' : 'stages'} moved`);
    if (facts.world.length) parts.push(`${facts.world.length} world ${facts.world.length === 1 ? 'event' : 'events'}`);
    if (!parts.length) parts.push(facts.happened[0] ? facts.happened[0].replace(/[.!?…]+$/, '') : `${facts.count} ${facts.count === 1 ? 'change' : 'changes'} kept`);
    return cut(`${flat(date) || 'A day'}: ${parts.join('; ')}.`, MAX_LINE);
}
