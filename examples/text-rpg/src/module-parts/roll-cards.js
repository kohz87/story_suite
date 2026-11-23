// The card under a reply: one "Rolls" card: the matchup it was written under, the foes it set up, a row for each roll it made (what was rolled, why it was raised, what it cost, what it taught) and a row for what the reply earned.
import { DIFFICULTIES } from '../rules/difficulty.js';
import { DOMAIN } from '../domain/shape.js';
import { FEATURE } from './constants.js';
import { BAND_WORD } from './band-words.js';
import { rollsOf } from './rolls.js';

const ORDER = ['great', 'success', 'cost', 'failure', 'bad'];
const TONE = { great: 'good', success: 'good', cost: 'accent', failure: 'info', bad: 'bad' };
const PAID = { wound: 'a wound', skill: 'the skill\'s cost again', stamina: 'a step of stamina' };
const ROWS = 8;
const signed = n => (n < 0 ? `− ${-n}` : `+ ${n}`);
const dcOf = roll => DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, Math.max(0, roll.difficulty))];

// One compact row: "Snap Cut, ordinary → a bad failure (2 + 0 vs 15) · a wound · practice +10"; a raised roll says why inside its difficulty, a natural 20 or 1 its quality, an edge or a skill not on the sheet what they did.
function rollRow(roll, named) {
    const word = dcOf(roll).word;
    const hard = roll.raised ? `${word} (${roll.why.length ? roll.why.join(', ') : 'the scene allows nothing easier'})` : word;
    const parts = [`${roll.target}, ${hard} → ${BAND_WORD[roll.band] ?? roll.band}${roll.quality ? `, ${roll.quality}` : ''} (${roll.die} ${signed(roll.bonus)} vs ${dcOf(roll).dc})`];
    if (roll.edge) parts.push(`edge ${roll.edge.steps > 0 ? '+' : '−'}${Math.abs(roll.edge.steps)} (${roll.edge.why})`);
    if (roll.unlearned) parts.push('not on the sheet');
    if (PAID[roll.paid]) parts.push(PAID[roll.paid]);
    if (roll.practice > 0) parts.push(`practice +${roll.practice}${roll.rankUp ? ` (${roll.target} reaches ${roll.rankUp})` : ''}`);
    return { text: `${named ? `${roll.who}: ` : ''}${parts.join(' · ')}`, tag: '' };
}

function spendText(item) {
    const reach = item.rankUp ? ` (reaches ${item.rankUp})` : '';
    if (!item.sessions) return `${item.who} practised ${item.skill} +${item.practice}${reach}`;
    const note = item.asked > item.sessions ? `asked ${item.asked}, story time ${item.days} day${item.days === 1 ? '' : 's'}` : `${item.sessions} session${item.sessions === 1 ? '' : 's'}`;
    return `${item.who} trained ${item.skill}: +${item.practice} (${note})${reach}`;
}

function earnedRow({ spends, xp, lessons }) {
    const parts = [...xp.map(item => item.summary || `${item.amount} xp`), ...lessons.map(item => `${item.who} learned from the fight: ${item.skill} +${item.practice}${item.rankUp ? ` (reaches ${item.rankUp})` : ''}`), ...spends.map(spendText)];
    const levels = xp.find(item => item.levels > 0);
    return parts.length ? { text: `Earned: ${parts.join(' · ')}`, tag: levels ? `level ${levels.levels > 1 ? `+${levels.levels}` : 'up'}` : '' } : null;
}

// The foes row: what the reply set up, added or ended ("Foes: 24 rats beneath · reinforcements: 6 wolves above · gone: bandits").
function foesRow(foes) {
    const parts = foes.map(item => (item.ended ? `gone: ${item.name}` : `${item.reinforcements ? 'reinforcements: ' : ''}${item.count} ${item.name} ${item.threat}`));
    return parts.length ? { text: `Foes: ${parts.join(' · ')}`, tag: '' } : null;
}

// The one card of a reply: the matchup and foes rows, a row for each roll (the rest in one row when there are more than the card holds), then the earned row; its tone is the worst band.
function rollsCard({ rolls, spends, xp, lessons = [], foes = [], matchup = null }) {
    const earned = earnedRow({ spends, xp, lessons });
    if (!rolls.length && !earned) return null;
    const head = [matchup ? { text: `Matchup: ${matchup.band} (${matchup.why})`, tag: '' } : null, foesRow(foes)].filter(Boolean);
    const named = new Set(rolls.map(roll => roll.who)).size > 1;
    const room = ROWS - (earned ? 1 : 0) - head.length;
    const shown = rolls.length > room ? room - 1 : rolls.length;
    const rows = [...head, ...rolls.slice(0, shown).map(roll => rollRow(roll, named))];
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

/** `rollsOf` for the `textRpg.rolls` query: `{ index, names }` → { rolls, spends, xp, lessons, foes, matchup } of that reply. */
export function rollsAnswer(entries, args) {
    const names = args?.names && typeof args.names === 'object' ? args.names : {};
    return rollsOf(entries, args?.index, id => names[id] ?? String(id));
}
