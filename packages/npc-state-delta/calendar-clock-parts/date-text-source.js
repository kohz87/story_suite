// The memory-date source: the story's date text as of a reply.

// (memory dates) The story's date as of reply `index`, in the dossier's words ("Icewane 27"), or '' without a host clock. index.js sets a
// source that asks the hosted adapter at that reply, so a date is the same live and in a replay (the date of the reply, not of viewing).
let storyDateAtSource = null;

export function setStoryDateAtSource(source = null) {
    storyDateAtSource = typeof source === 'function' ? source : null;
}

export function storyDateTextAt(index) {
    if (!storyDateAtSource || !Number.isInteger(index) || index < 0) return '';
    try { return String(storyDateAtSource(index) ?? '').trim().slice(0, 40); } catch { return ''; }
}
