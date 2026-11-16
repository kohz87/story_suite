// Game view key: tells whether a key event is Alt+G alone.

/** True for Alt+G alone (no Ctrl, Meta or Shift); `code` so it works whatever Alt types on a Mac. */
export const isGameViewKey = event => Boolean(event?.altKey) && !event.ctrlKey && !event.metaKey && !event.shiftKey
    && (event.code === 'KeyG' || String(event.key ?? '').toLowerCase() === 'g');
