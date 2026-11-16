// What rewind and save points share: the failure answer, and the time limit on SillyTavern's branch and open calls.

export const fail = (code, message) => ({ ok: false, code, message });

// SillyTavern's branch / open call that never settles would keep `running` set for the whole page life (every later save point
// or rewind answering "already going"): after this long the call counts as failed and the flag clears.
export const STILL_WAITING_MS = 60_000;
export const limited = (work, what) => {
    let timer;
    const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`SillyTavern did not ${what} within ${STILL_WAITING_MS / 1000} s`)), STILL_WAITING_MS); });
    return Promise.race([Promise.resolve().then(work), late]).finally(() => clearTimeout(timer));
};
