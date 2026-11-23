// The card under a reply: one "Rolls" card, a row for each roll it made (what was rolled, why it was raised, what it cost, what it taught, what wore) and a row for what the reply earned.
import { DIFFICULTIES } from '../rules/difficulty.js';
import { DOMAIN } from '../domain/shape.js';
import { FEATURE } from './constants.js';
import { BAND_WORD } from './band-words.js';
import { rollsOf } from './rolls.js';

const ORDER = ['great', 'success', 'cost', 'failure', 'bad'];
const TONE = { great: 'good', success: 'good', cost: 'accent', failure: 'info', bad: 'bad' };
const PAID = { wound: 'a wound', skill: 'the skill\'s cost again', stamina: 'a step of stamina' };
const PLACE = { weapon: 'weapon', body: 'armour', 'off-hand': 'shield' };
const ROWS = 8;
const signed = n => (n < 0 ? `− ${-n}` : `+ ${n}`);
const dcOf = roll => DIFFICULTIES[Math.min(4, Math.max(0, roll.difficulty))];

// One compact row: "Snap Cut, normal → a bad failure (2 + 0 vs 12) · a wound · practice +10 · wear: weapon 69, armour 69"; a raised roll says why inside its difficulty.
function rollRow(roll, named) {
    const word = dcOf(roll).word;
    const hard = roll.raised ? `${word} (${roll.why.length ? roll.why.join(', ') : 'the scene allows nothing easier'})` : word;
    const parts = [`${roll.target}, ${hard} → ${BAND_WORD[roll.band] ?? roll.band} (${roll.die} ${signed(roll.bonus)} vs ${dcOf(roll).dc})`];
    if (PAID[roll.paid]) parts.push(PAID[roll.paid]);
    if (roll.practice > 0) parts.push(`practice +${roll.practice}${roll.rankUp ? ` (${roll.target} reaches ${roll.rankUp})` : ''}`);
    if (roll.worn.length) parts.push(`wear: ${roll.worn.map(piece => `${PLACE[piece.slot] ?? piece.slot} ${piece.broken ? 'broken' : piece.now}`).join(', ')}`);
    return { text: `${named ? `${roll.who}: ` : ''}${parts.join(' · ')}`, tag: '' };
}

function earnedRow({ spends, xp }) {
    const parts = [...xp.map(item => item.summary || `${item.amount} xp`), ...spends.map(item => `${item.who} practised ${item.skill} +${item.practice}${item.rankUp ? ` (reaches ${item.rankUp})` : ''}`)];
    const levels = xp.find(item => item.levels > 0);
    return parts.length ? { text: `Earned: ${parts.join(' · ')}`, tag: levels ? `level ${levels.levels > 1 ? `+${levels.levels}` : 'up'}` : '' } : null;
}

// The one card of a reply: a row for each roll (the rest in one row when there are more than the card holds), then the earned row; its tone is the worst band.
function rollsCard({ rolls, spends, xp }) {
    const earned = earnedRow({ spends, xp });
    if (!rolls.length && !earned) return null;
    const named = new Set(rolls.map(roll => roll.who)).size > 1;
    const room = ROWS - (earned ? 1 : 0);
    const shown = rolls.length > room ? room - 1 : rolls.length;
    const rows = rolls.slice(0, shown).map(roll => rollRow(roll, named));
    if (shown < rolls.length) rows.push({ text: `and ${rolls.length - shown} more: ${rolls.slice(shown).map(roll => `${roll.target} (${BAND_WORD[roll.band] ?? roll.band})`).join(', ')}`, tag: '' });
    if (earned) rows.push(earned);
    const worst = rolls.map(roll => roll.band).reduce((top, band) => (ORDER.indexOf(band) > ORDER.indexOf(top) ? band : top), 'great');
    return { tone: rolls.length ? TONE[worst] ?? 'info' : 'good', icon: rolls.length ? 'fa-dice-d20' : 'fa-star', title: rolls.length ? 'Rolls' : 'Earned', text: '', rows, actions: [] };
}

/** The `cards` of the module: `text-rpg-rolls`, one card for the reply (a row for each roll, then what it earned; up to 8 rows), a pure read of the reply's own receipts (`textRpg.rolls`). */
export function rollCards() {
    const read = (ctx, state) => {
        const names = state?.domains?.[DOMAIN]?.members ?? {};
        return ctx?.query?.('textRpg.rolls', { index: ctx.index, names: Object.fromEntries(Object.entries(names).map(([id, member]) => [id, member.name])) }) ?? null;
    };
    return { 'text-rpg-rolls': { feature: FEATURE, rows: ROWS, for: (state, _message, ctx) => { const got = read(ctx, state); return got ? rollsCard(got) : null; } } };
}

/** `rollsOf` for the `textRpg.rolls` query: `{ index, names }` → { rolls, spends, xp } of that reply. */
export function rollsAnswer(entries, args) {
    const names = args?.names && typeof args.names === 'object' ? args.names : {};
    return rollsOf(entries, args?.index, id => names[id] ?? String(id));
}
