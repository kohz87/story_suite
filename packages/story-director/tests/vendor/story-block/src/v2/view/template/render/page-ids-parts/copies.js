// Story Suite v2: the one table of copy numbers of a screen drawn now, taken and freed per copy.

// A screen is often drawn more than once at a time (a card under every reply, a tab and a hud), and
// ids and control names must not be shared between the copies (B-b5b-robust-r2-1: a label would check
// another copy's box, radios would be one group). The first copy of a screen on the page keeps the
// screen's ids (`ss-t-<screen>-<id>`); each other copy drawn at the same time adds `--c<n>`. A screen's
// CSS reaches every copy (css.js: `#id` is scoped to the screen's ids with or without the copy mark).
const COPIES = new Map();   // id prefix → the copy numbers drawn now

export function takeCopy(prefix) {
    const taken = COPIES.get(prefix) ?? new Set();
    COPIES.set(prefix, taken);
    let n = 1;
    while (taken.has(n)) n += 1;
    taken.add(n);
    return n;
}

export function freeCopy(prefix, n) {
    const taken = COPIES.get(prefix);
    taken?.delete(n);
    if (taken && !taken.size) COPIES.delete(prefix);
}
