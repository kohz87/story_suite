// The longest board fight the notes are measured on: 4 v 6, 4 exchanges, items and gear wear, the fightLen mark on.
import { settledNote } from '../../../../packages/story-block/src/v2/lean-rpg/board/note.js';

const party = ['Astra', 'Bram', 'Cyra', 'Dov'];
const foes = ['Rat 1', 'Rat 2', 'Rat 3', 'Rat 4', 'Rat 5', 'Rat 6'];
const act = (n, i) => ({ kind: 'act', pc: { who: party[i] }, foe: { name: foes[(n + i) % 6], slot: (n + i) % 6 }, skill: 'Cut', outcome: i % 2 ? 'fail' : 'success',
    damage: i % 2 ? undefined : { id: `f:${(n + i) % 6}`, name: foes[(n + i) % 6], from: 5, to: 3, size: 5 } });
const foeLine = (n, i) => ({ kind: 'foe', pc: { who: party[i % 4] }, foe: { name: foes[i] }, skill: 'Dodge', outcome: (n + i) % 3 ? 'success' : 'fail',
    ...((n + i) % 3 ? {} : { damage: { id: `pc:${i % 4}`, name: party[i % 4], from: 5, to: 4, size: 5 } }) });
const item = (n, who) => ({ kind: 'act', pc: { who }, target: party[0], item: 'Salve', pool: 'health', gained: 2 });

export const FIGHT_RESULT = {
    stop: 'open',
    order: [...party.map((name, i) => ({ id: `c:${i}`, name, party: true })), ...foes.map((name, i) => ({ id: `f:${i}`, name, party: false }))],
    rounds: [1, 2, 3, 4].map(n => ({ n, lines: [...party.map((_, i) => act(n, i)), ...foes.map((_, i) => foeLine(n, i)), item(n, party[n % 4])] })),
    wear: [{ n: 2, who: 'Astra', item: 'Sword', from: 'good', to: 'worn' }, { n: 3, who: 'Bram', item: 'Coat', from: 'torn', to: 'broken' }],
};
export const FIGHT_SETUP = { fightLen: 1 };
export const fightNote = () => settledNote(FIGHT_RESULT, FIGHT_SETUP);
