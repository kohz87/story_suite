// Story Director v2, part **keypeople**: takes a key person off the list, records why and says it in words.

import { MAX_GONE } from '../domain.js';
import { dateText } from '../time.js';
import { addNote } from './notes.js';
import { revOf } from './shared-ctx.js';
import { gonePath } from './shared-text.js';

/**
 * Takes `key` off the list (the draft `kp`): the pin and its away record go, `gone` records why, and the reply's card is
 * told. `reason`: died | archived | unpinned. Returns the sentence for the receipt.
 */
export function writeGone(ctx, kp, key, name, reason, now, defer = false) {
    // A record an older reply made is rewritten field by field: marked, so it is passed over when that reply was deleted.
    if (Object.hasOwn(kp.gone, key) && typeof ctx.ifThere === 'function') ctx.ifThere('keypeople', gonePath(key));
    delete kp.gone[key];
    // `owed`: the card line is for the reply that follows this step (`keypeople.tell`), not the reply that holds it.
    kp.gone[key] = { name, reason, on: now, rev: revOf(ctx), ...(defer ? { owed: true } : {}) };
    const keys = Object.keys(kp.gone);
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_GONE))) delete kp.gone[old];
}

export function removePin(ctx, kp, key, pin, reason, calendar, now, { defer = false } = {}) {
    delete kp.pins[key];
    if (Object.hasOwn(kp.away, key)) delete kp.away[key];
    writeGone(ctx, kp, key, pin.name, reason, now, defer);
    const why = whyText(reason, calendar, now);
    if (!defer) addNote(ctx, kp, { kind: 'gone', name: pin.name, head: `${pin.name} is no longer a key person`, rest: `(${why}).` });
    return `${pin.name} is no longer a key person (${why}).`;
}

/** Why a person left the list, in words: "died, Goldwane 18", "archived in NPC State Delta", "unpinned". */
export function whyText(reason, calendar, now) {
    const day = dateText(calendar, now);
    return reason === 'died' ? `died${day ? `, ${day}` : ''}` : reason === 'archived' ? 'archived in NPC State Delta' : 'unpinned';
}
