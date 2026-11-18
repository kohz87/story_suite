// The quest the reader picked as the focus (a per-chat pref), and its Today › focus line while that quest is still open.

import { PREFS_KEY } from '../port/prefs-key.js';
import { FOCUS_KEY } from '../port/focus.js';

const text = value => (typeof value === 'string' ? value.trim() : '');

/** The picked quest id from the chat's metadata, '' when none. */
export function pickOf(ctx) {
  try { return text(ctx()?.chatMetadata?.[PREFS_KEY]?.[FOCUS_KEY]); } catch { return ''; }
}

/** `director.threads` rows → { title, detail } for the open quest `id`; null when none is open by that id (a deleted or finished quest falls back to director.goal). */
export function pickedFocus(read, id) {
  if (!id) return null;
  const rows = read('director.threads', { kind: 'quest', status: 'active', open: true });
  const row = (Array.isArray(rows) ? rows : []).find(t => t && !(t.offer && !t.taken) && t.id === id);
  if (!row) return null;
  const title = text(row.fields?.goal) || text(row.summary) || text(row.key);
  return title ? { title, detail: text(row.fields?.step) || null } : null;
}
