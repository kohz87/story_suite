// The fight kind's `view(state, setup, steps, preview)`: FIGHT_SHAPE for the Fight tab, built on the Combat Rules v1 engine's record (board/fight-view-v1.js).
// `result` rides along unchanged (the page's own Auto and note read it from `current().view`); a fight's is the settle envelope, which has the `stop` Auto reads.
import { v1View } from './fight-view-v1.js';

/** `preview` = what the kind's `play` answered. */
export function fightView(state, setup, steps, preview) {
    return { ...v1View(state, setup, steps, preview.view.result), result: preview.result };
}
