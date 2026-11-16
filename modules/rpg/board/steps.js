// Turns the actions the reader chose for one exchange into the step the interaction api stages: one input per member, by the member's actor id.
import { fold, readSheet } from '../read.js';
import { actorIdOf } from '../roster.js';

/** `actions` (`{ who, kind, …}` as the board's buttons build them) on `state`'s sheet → `{ inputs: [{ actor, choice, args }] }`. An unknown member keeps an empty actor id, which the api refuses. */
export function toStep(state, actions) {
    const characters = readSheet(state).characters;
    return { inputs: actions.map(({ kind, ...args }) => {
        const who = characters.find(character => fold(character.who) === fold(args.who));
        return { actor: who ? actorIdOf(who.module) : '', choice: kind, args: structuredClone(args) };
    }) };
}
