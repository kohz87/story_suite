// Whether a reply came with no <Changes> block and nothing stored for it (no repair, no safety-net lines): the chat view's "no changes recorded" badge.

import { assistSections, extractBlock } from '../../core/capture.js';
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
