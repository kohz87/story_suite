// The story-clock source and its one-pass memo: where the Story Director clock is set and read.

// (v2) Hosted by Story Block v2, the story's date can come from Story Director's clock: index.js sets a
// source that answers { minutes, calendar } (its `director.time` minutes and `director.calendar` config)
// or null (no host, no Story Director, its clock not set yet, or Delta's calendar kept as "mine"). Without
// a source, or when it answers null, nothing here runs and the dates are Delta's own (v1).
export let storyClockSource = null;

export function setStoryClockSource(source = null) {
    storyClockSource = typeof source === 'function' ? source : null;
}

// (1.10.1) One synchronous pass over every dossier (a chat state's normalization) asks for the story's
// clock once, not twice per dossier: each ask is two Story Block queries. Nothing can move the clock
// inside a synchronous pass, so every dossier sees the same answer it would have got on its own.
let storyClockMemo = null;

export function withStoryDateMemo(task) {
    if (storyClockMemo) return task();
    storyClockMemo = { read: false, clock: null };
    try { return task(); }
    finally { storyClockMemo = null; }
}

export function readStoryClock() {
    if (!storyClockMemo) return storyClockSource();
    if (!storyClockMemo.read) {
        storyClockMemo.read = true;
        try { storyClockMemo.clock = storyClockSource(); } catch { storyClockMemo.clock = null; }
    }
    return storyClockMemo.clock;
}
