// Keeps a byte-for-byte copy of a staged interaction beside the waiting message and links replay payloads to it.

import { hashText } from '../assist/common.js';
import { readRecord } from '../persist.js';
import { interactionPayload } from './session.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const clone = value => structuredClone(value);

/** Copies the staged payload beside the reader's waiting message at Send. */
export function markSend(meta, pending, session) {
    if (!plain(meta) || !plain(pending) || !plain(session) || !Array.isArray(session.steps) || !session.steps.length
        || session.anchor !== pending.anchor || typeof pending.message !== 'string' || !pending.message) return false;
    const payload = interactionPayload(session);
    if (!payload) return false;
    meta.send = { anchor: session.anchor, message: pending.message, payload, ...(plain(session.opening) ? { opening: clone(session.opening) } : {}) };
    return true;
}

/** The send copy for the chat's waiting message (anchor and text still match), else null. */
export function readSend(meta, chat) {
    const mark = plain(meta?.send) ? meta.send : null, last = Array.isArray(chat) ? chat.at(-1) : null;
    if (!mark || !plain(mark.payload) || !last?.is_user || readRecord(chat.at(-2))?.sid !== mark.anchor
        || hashText(String(last.mes ?? '').trim()) !== mark.message) return null;
    return mark;
}

/** Links the reader's message to its reply's payload key, add-only, for regenerate after a middle delete. */
export function linkMessage(message, key) {
    if (!plain(message) || typeof key !== 'string' || !key) return false;
    if (!plain(message.extra)) message.extra = {};
    if (!plain(message.extra.storySuiteInteractionLinks)) message.extra.storySuiteInteractionLinks = {};
    message.extra.storySuiteInteractionLinks[key] = true;
    return true;
}

const settleIn = message => {
    const records = [message?.extra?.storySuite, ...(Array.isArray(message?.swipe_info) ? message.swipe_info.map(info => info?.extra?.storySuite) : [])];
    return records.flatMap(record => record?.receipts ?? []).filter(receipt => receipt?.type === 'interaction.settle' && plain(receipt.replan?.payload) && typeof receipt.replan.payload.kindId === 'string');
};

/** The earlier swipe's own interaction payload (not its opening), which is the authority for swipe and regenerate replay. */
export function priorPayload(message) {
    const receipt = settleIn(message).find(item => item.replan.payload.opening !== true);
    return receipt ? clone(receipt.replan.payload) : null;
}
