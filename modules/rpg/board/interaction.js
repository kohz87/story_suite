// The fight board as an interaction kind (`story-block/fight`): play, settle, witness, actors, Auto and the next segment on the Combat Rules v1 engine (board/v1-kind.js over combat/*).
// A step is one exchange. A sheet with no v1 Character cannot open a fight (`openSetup` answers an error): there is no other engine.
import { openingSetup, openingWitness, openingNote } from './opening.js';
import { FIGHT_STATIC } from './kind-static.js';
import { V1 } from './v1-kind.js';
import { fightView } from './fight-view.js';
import { openingV1 } from './v1-opening.js';
import { settledNoteV1 } from '../combat/note.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// What the kind's pure functions read: the three domains a fight's commit reads (a plain object, so the engine may clone it).
const real = state => ({ domains: { dataModules: state.domains.dataModules, inventory: state.domains.inventory, scene: state.domains.scene } });

function openSetup(state, { anchor, seed, attempt = 0, args = {} }) {
    // A pre-check offer's opening (interaction/start.js): no foe stands yet, so the setup is the opening's own (board/opening.js).
    const made = args.opening ? openingSetup({ ...args.opening, anchor }) : null;
    if (made?.error) return made;
    if (!V1.sheet(state)) return { error: 'There is no fight to open.' };
    if (made) return { setup: { ...made.setup, v1: 1 } };
    return V1.open(state, { anchor, seed, attempt, args });
}

/** The kind definition the module registers as `story-block/fight`. */
export const fightKind = Object.freeze({
    ...FIGHT_STATIC, ready: () => true,
    actors: state => (V1.sheet(state) ? V1.actors(state) : []),
    open: (state, context) => openSetup(state, context),
    opening: (state, setup, dice) => openingV1(real(state), setup, dice),
    witness: (state, setup) => (setup.opening === true ? openingWitness(real(state)) : V1.witness(state, setup)),
    validate: (state, setup, steps, step) => V1.validate(state, setup, steps, step),
    play: (state, setup, steps, dice) => V1.play(state, setup, steps, dice),
    settle: (state, setup, steps, dice) => V1.settle(state, setup, steps, dice),
    auto: () => V1.auto(),
    next: (setup, result) => V1.next(setup, result),
    view: (state, setup, steps, preview) => fightView(state, setup, steps, preview),
    note: (result, setup, context) => (context?.opening ? openingNote(result) : settledNoteV1(result).split(' | ')),
});
