// The story-day source: the whole story day number after a reply.

// (ties fade) The same clock as a whole story day number after reply `index` (minutes / 1440), or null without a host clock. It is the day of
// that reply, so a Re-read, a swipe and a replay record the same value as live. index.js sets the source.
let storyDayAtSource = null;

export function setStoryDayAtSource(source = null) {
    storyDayAtSource = typeof source === 'function' ? source : null;
}

export function storyClockDayAt(index) {
    if (!storyDayAtSource || !Number.isInteger(index) || index < 0) return null;
    try { const day = storyDayAtSource(index); return Number.isInteger(day) ? day : null; } catch { return null; }
}
