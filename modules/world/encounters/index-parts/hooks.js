// The encounters' two hooks: before a reply, the roll as a prelude step; after the reply's lines, the promotion of a backdrop person
// the reply named and NPC State now has (stored on the reply, so a swipe, a Re-read, a delete or a rewind takes it back with it).

import { shownText } from '../../../cast/cast/hooks-parts/text.js';
import { ENCOUNTER, PROMOTE, encountersOn } from './ids.js';
import { ledgerOf } from './ledger.js';
import { promotionOf } from './promote.js';

const isInt = value => Number.isSafeInteger(value);

/** `beforeGenerate(view, info)`: one `director.encounter` step per reply written (normal, swipe or regenerate; a Continue commits nothing). */
export function encounterHook(view, info = {}) {
    if (!view?.state?.domains?.director || !encountersOn(view)) return undefined;
    const type = String(info?.type ?? 'normal').toLowerCase();
    const length = view?.chat?.length;
    if (info?.commit === false || !['normal', 'swipe', 'regenerate'].includes(type) || !isInt(length)) return undefined;
    return { commands: [{ type: ENCOUNTER, payload: { at: Math.max(0, length - (type === 'swipe' ? 1 : 0)) } }] };
}

/** `afterCapture(view, info)`: a `director.encounter.promote` step when this reply's encounter is a recurring backdrop person it named. */
export function promoteHook(view, info = {}) {
    if (!encountersOn(view) || !isInt(info?.index)) return undefined;
    const ledger = ledgerOf(view?.state?.domains?.director);
    const entry = ledger.results.find(item => item.at === info.index);
    if (!entry) return undefined;
    // The story's messages (the host's chat: `view.chat` is only its length).
    const chat = typeof view?.story?.chat === 'function' ? view.story.chat() : null;
    const message = Array.isArray(chat) ? chat[info.index] : null;
    if (!message || typeof message.mes !== 'string') return undefined;
    const found = promotionOf({ entry, npcs: view?.state?.domains?.people?.npcs, text: shownText(message.mes), bound: ledger.bound });
    if (!found || ledger.bound[found.ref]?.key === found.key) return undefined;
    return { commands: [{ type: PROMOTE, payload: { at: info.index, ...found } }] };
}
