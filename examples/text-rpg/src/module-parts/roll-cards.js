// The cards under a reply: one for each roll it made (what was rolled, why it was raised, what it cost, what it taught, what wore) and one for what the reply earned.
import { DIFFICULTIES } from '../rules/difficulty.js';
import { DOMAIN } from '../domain/shape.js';
import { FEATURE } from './constants.js';
import { BAND_WORD } from './band-words.js';
import { rollsOf } from './rolls.js';

const TONE = { great: 'good', success: 'good', cost: 'accent', failure: 'info', bad: 'bad' };
const PAID = { wound: 'Cost: a wound stage', skill: 'Cost: the skill\'s cost again', stamina: 'Cost: a step of stamina' };
const PLACE = { weapon: 'weapon', body: 'armour', 'off-hand': 'shield' };
const ROLLS = 3;
const signed = n => (n < 0 ? `− ${-n}` : `+ ${n}`);

function rollCard(roll) {
    const word = DIFFICULTIES[Math.min(4, Math.max(0, roll.difficulty))].word;
    const rows = [];
    if (roll.raised) rows.push({ icon: 'fa-arrow-up', text: `Raised to ${word}: ${roll.why.length ? roll.why.join(', ') : 'the scene allows nothing easier'}` });
    if (PAID[roll.paid]) rows.push({ icon: 'fa-heart-crack', text: PAID[roll.paid] });
    if (roll.practice > 0) rows.push({ icon: 'fa-graduation-cap', text: `Practice +${roll.practice}${roll.rankUp ? `; ${roll.target} reaches ${roll.rankUp}` : ''}` });
    // (one row for the pieces: a card keeps four rows)
    if (roll.worn.length) rows.push({ icon: 'fa-shield-halved', text: `Wear: ${roll.worn.map(piece => `${PLACE[piece.slot] ?? piece.slot} ${piece.before} → ${piece.now}${piece.broken ? ' (broken)' : ''}`).join('; ')}` });
    return { tone: TONE[roll.band] ?? 'info', icon: 'fa-dice-d20', title: `${roll.target}, ${word} → ${BAND_WORD[roll.band] ?? roll.band}`, text: `${roll.who}: ${roll.die} ${signed(roll.bonus)} vs ${DIFFICULTIES[Math.min(4, Math.max(0, roll.difficulty))].dc}`, rows, actions: [] };
}

function earnedCard({ spends, xp }) {
    const rows = [
        ...xp.map(item => ({ icon: 'fa-star', text: item.summary || `${item.amount} xp`, tag: item.levels > 0 ? `level ${item.levels > 1 ? `+${item.levels}` : 'up'}` : '' })),
        ...spends.map(item => ({ icon: 'fa-graduation-cap', text: `${item.who} practised ${item.skill}: +${item.practice}${item.rankUp ? `; reaches ${item.rankUp}` : ''}` })),
    ];
    return rows.length ? { tone: 'good', icon: 'fa-star', title: 'Earned', text: '', rows, actions: [] } : null;
}

/** The `cards` of the module: `text-rpg-roll-1…3` (each roll of the reply, in order) and `text-rpg-earned`; each is a pure read of the reply's own receipts (`textRpg.rolls`). */
export function rollCards() {
    const read = (ctx, state) => {
        const names = state?.domains?.[DOMAIN]?.members ?? {};
        return ctx?.query?.('textRpg.rolls', { index: ctx.index, names: Object.fromEntries(Object.entries(names).map(([id, member]) => [id, member.name])) }) ?? null;
    };
    const cards = {};
    for (let at = 0; at < ROLLS; at += 1) cards[`text-rpg-roll-${at + 1}`] = { feature: FEATURE, for: (state, _message, ctx) => { const roll = read(ctx, state)?.rolls[at]; return roll ? rollCard(roll) : null; } };
    cards['text-rpg-earned'] = { feature: FEATURE, for: (state, _message, ctx) => { const got = read(ctx, state); return got ? earnedCard(got) : null; } };
    return cards;
}

/** `rollsOf` for the `textRpg.rolls` query: `{ index, names }` → { rolls, spends, xp } of that reply. */
export function rollsAnswer(entries, args) {
    const names = args?.names && typeof args.names === 'object' ? args.names : {};
    return rollsOf(entries, args?.index, id => names[id] ?? String(id));
}
