// Reads a module's raw card under a reply into the view's clean card: tone, title, text, rows and buttons (plain text only, never parsed).

import { oneLine } from '../../core/text.js';

export const CARD_TONES = Object.freeze(['accent', 'bad', 'good', 'info']);
const ROWS_MAX = 4;
const ACTIONS_MAX = 4;
const COMMAND = /^[a-z0-9][a-z0-9_-]*(\.[a-z0-9_-]+)+$/i;
const OPEN = /^[A-Za-z0-9._\-/]{1,120}$/;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// A payload as plain JSON (what a command or a window's draft takes), or {} when it cannot be copied.
function payloadOf(value) {
  if (!isRecord(value)) return {};
  try {
    const copy = JSON.parse(JSON.stringify(value));
    return isRecord(copy) ? copy : {};
  } catch {
    return {};
  }
}

function rowOf(raw) {
  if (!isRecord(raw)) return null;
  const text = oneLine(raw.text ?? '', 120);
  return text ? { text, tag: oneLine(raw.tag ?? '', 24) } : null;
}

function actionOf(raw, at) {
  if (!isRecord(raw)) return null;
  // (32 code points, so an emoji in a name never loses half of itself)
  const label = [...oneLine(raw.label ?? '', 128)].slice(0, 32).join('');
  // (a button with both opens the window, as the earlier cards did)
  const open = typeof raw.open === 'string' && OPEN.test(raw.open) ? raw.open : '';
  const command = !open && typeof raw.command === 'string' && COMMAND.test(raw.command) ? raw.command : '';
  if (!label || (!command && !open)) return null;
  return { id: oneLine(raw.id ?? '', 40) || `action-${at}`, label, primary: raw.primary === true, command, open, payload: payloadOf(raw.payload) };
}

/** A module's card, read: { tone, title, text, rows: [{ text, tag }], actions: [{ id, label, primary, command, open, payload }] }, or null without a title. */
export function readCard(raw) {
  if (!isRecord(raw)) return null;
  const title = oneLine(raw.title ?? '', 60);
  if (!title) return null;
  return {
    tone: CARD_TONES.includes(raw.tone) ? raw.tone : 'info',
    title,
    text: oneLine(raw.text ?? '', 240),
    rows: (Array.isArray(raw.rows) ? raw.rows : []).map(rowOf).filter(Boolean).slice(0, ROWS_MAX),
    actions: (Array.isArray(raw.actions) ? raw.actions : []).map(actionOf).filter(Boolean).slice(0, ACTIONS_MAX),
  };
}

/** The head reply's cards for the chat view: { index, list: [{ key, card }] } from the handle's answer, or null when none reads. */
export function replyCardsOf(answer) {
  if (!isRecord(answer) || !Number.isInteger(answer.index) || answer.index < 0) return null;
  const list = (Array.isArray(answer.cards) ? answer.cards : []).map(item => ({ key: oneLine(item?.key ?? '', 80), card: readCard(item?.card) })).filter(item => item.key && item.card);
  return list.length ? { index: answer.index, list } : null;
}
