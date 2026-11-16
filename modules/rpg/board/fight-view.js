// The fight kind's `view(state, setup, steps, preview)`: FIGHT_SHAPE for the Fight tab, built by the engine the stored setup names (the v1 mark, else the old engine).
// `result` rides along unchanged (the record the page's own Auto and note read from `current().view`); a v1 fight's is the settle envelope, which has the `stop` Auto reads.
import { V1 } from './v1-kind.js';
import { v1View } from './fight-view-v1.js';
import { oldView } from './fight-view-old.js';

/** `exchanges` = the steps as the old engine reads them (`toExchanges`); `preview` = what the kind's `play` answered. */
export function fightView(state, setup, steps, preview, exchanges) {
    if (V1.isV1(setup)) return { ...v1View(state, setup, steps, preview.view.result), result: preview.result };
    return { ...oldView(state, setup, steps, exchanges), result: preview.view.result };
}
