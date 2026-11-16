// Timeout: waits for a value or promise, giving a TIMED_OUT marker when it does not settle in time.

export const TIMED_OUT = Symbol('timed out');

// `value`, or TIMED_OUT when it is a promise that has not settled within `ms`.
export async function within(value, ms) {
    if (!value || typeof value.then !== 'function') return value;
    let timer;
    try {
        return await Promise.race([value, new Promise(resolve => { timer = setTimeout(resolve, ms, TIMED_OUT); })]);
    } finally {
        clearTimeout(timer);
    }
}
