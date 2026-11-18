// What the chat view tells of a reply's stored lines: the "no changes recorded" badge (no block, nothing stored for it) and the reply sheet's "Discard repair" (the repair's lines are stored), and whether a reply has a record at all.

import { assistSections, extractBlock, repairState } from '../../core/capture.js';
import { isCarrier, readRecord } from '../../core/persist.js';

/** True for the last story reply of `chat` (or reply `at`) that has a story record, no block and no stored assist lines; never for the first reply (the greeting). */
export function unrecordedAt(chat, at = null) {
  const list = Array.isArray(chat) ? chat : [];
  const index = Number.isInteger(at) ? at : list.findLastIndex(isCarrier);
  const message = list[index];
  if (!isCarrier(message) || message.is_system || !readRecord(message) || index === list.findIndex(isCarrier)) return false;
  const mes = String(message.mes ?? '');
  if (extractBlock(mes) !== null) return false;
  const stored = assistSections(mes);
  return !stored.now.length && !stored.next.length;
}

/** True when the last story reply of `chat` (or reply `at`) came with no block and holds the repair's stored lines: the reply sheet may offer to discard them. */
export function repairedAt(chat, at = null) {
  const list = Array.isArray(chat) ? chat : [];
  const index = Number.isInteger(at) ? at : list.findLastIndex(isCarrier);
  const message = list[index];
  if (!isCarrier(message) || message.is_system) return false;
  const mes = String(message.mes ?? '');
  return extractBlock(mes) === null && repairState(mes) === 'repaired';
}

/** True when the last story reply of `chat` (or reply `at`) has a story record: its ✦ sheet is offered even when no change line came of it (a delete or a rewind can leave such a reply last), so Re-read stays reachable. */
export function recordedAt(chat, at = null) {
  const list = Array.isArray(chat) ? chat : [];
  const message = list[Number.isInteger(at) ? at : list.findLastIndex(isCarrier)];
  return isCarrier(message) && !message.is_system && Boolean(readRecord(message));
}
