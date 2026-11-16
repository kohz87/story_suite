// The fight kind as the core module registers it before the RPG's code is loaded: the plain members are the kind's own (board/kind-static.js), the functions
// are handed to the loaded library's kind (`rpgLib().fightKind`), and the kind is not ready until the library is there (a chat that holds a fight loads it first).
import { FIGHT_STATIC } from '../board/kind-static.js';
import { rpgLib } from './library.js';

const FUNCTIONS = ['open', 'opening', 'witness', 'validate', 'play', 'settle', 'note', 'actors', 'auto', 'next'];
const real = () => rpgLib()?.fightKind ?? null;
const waiting = () => { throw new Error('The RPG is still loading. Try again in a moment.'); };

export const lazyFightKind = Object.freeze({
    ...FIGHT_STATIC, ready: () => real() !== null,
    ...Object.fromEntries(FUNCTIONS.map(name => [name, (...args) => (real() ?? { [name]: waiting })[name](...args)])),
});
