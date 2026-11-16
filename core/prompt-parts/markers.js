// Story Suite v2: the marker texts and counts of the [Happened] note and the static header.

export const HAPPENED = '[Happened]';
// [Happened] lines always kept, however long they are; the rest share half the tail budget.
export const MIN_HAPPENED = 5;
// The static header's first line; turn.js looks for it to tell whether SillyTavern sent it.
export const STATIC_MARKER = '[Story Suite: how this story is kept]';
