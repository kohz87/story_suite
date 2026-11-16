// Story Director v2, world: when and where {{user}} heard of each chronicle event, read from the chat's receipts (chat data, so a
// swipe, a middle delete or a reload gives the same stamps). Nothing is stored; no teller is known, so `from` is always null.

import { clockSet, receiptOf } from '../../chronicle/days-parts/receipt-classify.js';
import { dateText } from './clock.js';
import { isInt, isRecord, text, cut } from './shared-text.js';

const PLACE_TYPES = new Set(['capture.place', 'scene.place']);
const MAX_STAMPS = 5;

/**
 * `Map(event id → [{ where, when, from }])`: one stamp per reply whose world line changed the event (a receipt marked `idle`: held, unchanged or already ended, gives none), oldest first (the last
 * `MAX_STAMPS`): `where` "in <the scene's place then>" ('' before any place), `when` the story date then ('' while the clock was unset),
 * `from` null; a reply with neither gives none. Empty without receipts.
 */
export function heardStamps(tools, calendar) {
    const out = new Map();
    let entries = [];
    try { entries = typeof tools?.receipts === 'function' ? tools.receipts() ?? [] : []; } catch { entries = []; }
    let place = '';
    let minutes = null;
    for (const entry of Array.isArray(entries) ? entries : []) {
        const receipt = receiptOf(entry);
        if (!receipt) continue;
        if (clockSet(receipt)) minutes = receipt.data.minutes;
        if (PLACE_TYPES.has(receipt.type) && text(receipt.data?.name)) place = cut(receipt.data.name, 80);
        const id = receipt.type === 'capture.world' && isRecord(receipt.data) && receipt.data.idle !== true ? text(receipt.data.event) : '';
        if (!id) continue;
        const stamp = { where: place ? `in ${place}` : '', when: isInt(minutes) ? dateText(calendar, minutes, { time: false }) : '', from: null };
        if (!stamp.where && !stamp.when) continue;
        const list = out.get(id) ?? [];
        const last = list[list.length - 1];
        if (!last || last.where !== stamp.where || last.when !== stamp.when) list.push(stamp);
        out.set(id, list.slice(-MAX_STAMPS));
    }
    return out;
}
