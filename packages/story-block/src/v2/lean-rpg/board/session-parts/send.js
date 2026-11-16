// Keeps a byte-for-byte copy of the staged fight beside the reader's waiting message.
import { hashText } from '../../../assist/common.js';
import { readRecord } from '../../../../../../../core/persist.js';
import { SEND, object } from './shared-meta.js';
import { boardPayload } from './current.js';

/**
 * "Send with this fight": at the press the staged fight is copied, byte for byte, beside the reader's waiting message and its anchor reply.
 * The send takes the fight from this copy whenever the session itself is not there, so nothing else can stand in for a staged fight.
 */
export function markSend(meta, pending, session) {
    if (!object(meta) || !object(pending) || !object(session) || !session.exchanges?.length || session.anchor !== pending.anchor) return false;
    meta[SEND] = { anchor: pending.anchor, message: pending.message, board: boardPayload(session) };
    return true;
}

/** The copy for the chat's waiting message (its anchor reply and text must still match), else null. */
export function readSend(meta, chat) {
    const mark = meta?.[SEND], last = Array.isArray(chat) ? chat.at(-1) : null;
    if (!object(mark) || !object(mark.board) || !last?.is_user || readRecord(chat.at(-2))?.sid !== mark.anchor
        || hashText(String(last.mes ?? '').trim()) !== mark.message) return null;
    return mark;
}

export function clearSend(meta) { if (object(meta)) delete meta[SEND]; }
