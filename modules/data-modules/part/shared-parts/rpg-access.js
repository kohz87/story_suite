// Reaches the lazily loaded RPG library's pieces at the time they are used.
import { refuse } from '../../interpreter.js';
import { rpgLib } from '../../../../../../../modules/rpg/rpg-lazy.js';

// The RPG library's pieces, at the time they are used: a step that needs them while the library is not there is refused (the loader brings it in first).
const rpg = () => rpgLib() ?? refuse('FAILED', '', 'The RPG is still loading. Try again in a moment.');
const J = new Proxy({}, { get: (_target, key) => rpg().RPG_STRINGS.join[key] });

export { rpg, J };
