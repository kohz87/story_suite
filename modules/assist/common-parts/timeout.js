// The time limit for a model call: the error for a late answer and the wrapper that raises it.

import { TIMEOUT_MS } from './limits.js';

export class AssistTimeout extends Error {
    constructor(ms) {
        super(`The model gave no answer within ${ms >= 1000 ? `${Math.round(ms / 100) / 10} s` : `${ms} ms`}.`);
        this.name = 'AssistTimeout';
        this.code = 'TIMEOUT';
    }
}

const realTimer = Object.freeze({
    set: (fn, ms) => setTimeout(fn, ms),
    clear: handle => clearTimeout(handle),
});

/**
 * `run()`'s answer, or an AssistTimeout after `ms`. A late answer is dropped. `timer` ({ set, clear })
 * stands in for setTimeout in tests.
 */
export function withTimeout(run, ms = TIMEOUT_MS, timer = realTimer) {
    return new Promise((resolve, reject) => {
        let done = false;
        const handle = timer.set(() => {
            if (done) return;
            done = true;
            reject(new AssistTimeout(ms));
        }, ms);
        const finish = (fn, value) => {
            if (done) return;
            done = true;
            timer.clear(handle);
            fn(value);
        };
        Promise.resolve()
            .then(run)
            .then(value => finish(resolve, value), error => finish(reject, error));
    });
}
