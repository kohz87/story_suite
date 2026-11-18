// The Journal's "Focus" pick: stored with this chat's view prefs (chat metadata), so it outlasts a redraw, a reload, a swipe and a chat change.

export const FOCUS_KEY = 'focusQuest';

/** `quest.focus { id }` → the pick kept in the chat's prefs (`{ get, set }`); an empty id clears it. Answers { ok } or a failure. */
export function focusCommand(chat, payload) {
  const id = typeof payload?.id === 'string' ? payload.id.trim() : '';
  if (typeof chat?.set !== 'function') return { ok: false, code: 'FAILED', message: 'This chat cannot keep a focus pick.' };
  return chat.set(FOCUS_KEY, id) === false ? { ok: false, code: 'FAILED', message: 'The focus pick could not be kept.' } : { ok: true };
}
