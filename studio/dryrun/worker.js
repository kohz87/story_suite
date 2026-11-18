// The dry run's Worker: one message in (the pack, seed, tempo, days, calendar), progress messages every few days, then `{ result }` or `{ error }` out.

import { simulate } from './run.js';

/** `answer(input, post)` runs the simulation and reports through `post`: `{ progress: day }` every 10 days, then `{ result }` or `{ error }`. */
export function answer(input, post) {
    try {
        const result = simulate({ ...input, onDay: day => { if (day % 10 === 0) post({ progress: day }); } });
        post({ result });
    } catch (error) {
        post({ error: String(error?.message ?? error) });
    }
}

if (typeof WorkerGlobalScope !== 'undefined') self.onmessage = event => answer(event.data, message => self.postMessage(message));
