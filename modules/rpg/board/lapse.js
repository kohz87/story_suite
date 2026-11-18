// A standing fight the reader does not play lapses: foes a reply set stay on the Foes block while the reader types past the fight offer, and
// in the reply to the reader's LAPSE_REPLIES-th message that does not play it they are cleared by a prelude with a receipt (the foes withdrew
// or were left behind). The count is read from the stored replies' own records (the latest reply whose receipts touched a standing group: the
// story's set-slot line for it or a board fight's settle, and the replies after it up to the reader's message), so a swipe counts what the first
// try did; the prelude is stored with the reply, so a Re-read, a reload and a rebuild keep it, and on a replay where the slot no longer holds
// that group it clears nothing and tells nothing.
import { readRecord } from '../../../core/persist.js';
import { BOARD_LAPSE, LAPSE_REPLIES } from '../names-parts/lapse.js';
import { fold } from '../read-parts/match.js';
import { knownFoeAction } from './action-gate.js';
import { clearFoes } from './foe-writes.js';
import { FIGHT_KIND } from './port-session.js';
import { isFightReceipt } from './results.js';

const text = (value, max = 80) => typeof value === 'string' && value.length > 0 && value.length <= max;
const groupsOf = payload => (Array.isArray(payload?.groups) && payload.groups.length > 0 && payload.groups.length <= 64
    && payload.groups.every(group => text(group?.module, 200) && Number.isSafeInteger(group.local) && group.local >= 1 && Number.isSafeInteger(group.slot)
        && text(group.name) && text(group.label) && Number.isSafeInteger(group.count)) ? payload.groups : null);

// What a stored receipt did to the standing groups: 'story' (a set-slot line for one of them, or a board fight's settle, its opening too),
// 'hand' (the reader set one of them on the Foes block, `dm.set`), or null.
function touchOf(receipt, standing) {
    if (isFightReceipt(receipt)) return 'story';
    const module = receipt?.data?.v2?.guard?.predicate?.module, mine = standing.filter(foe => foe.module === module);
    if (!mine.length) return null;
    const slot = receipt.type === 'capture.dm' ? /^set-slot-(\d+)$/u.exec(String(receipt.data.v2.result?.kind ?? '')) : null;
    if (slot) return mine.some(foe => foe.local === Number(slot[1])) ? 'story' : null;
    const fields = receipt.type === 'dm.set' ? receipt.data.v2.result?.fields ?? {} : {};
    return mine.some(foe => Object.hasOwn(fields, `foe${foe.local}`) || Object.hasOwn(fields, `count${foe.local}`)) ? 'hand' : null;
}

/**
 * The lapse prelude for this reply, or null. `sheet` is the head's sheet (readSheet), `messages` the chat, `index` the reader's message, `meta` the
 * chat's metadata. Nothing lapses while the latest touch of the standing groups is the reader's own (foes set by hand) or there is none, while the
 * reader has the fight open on the board, or when the message is a typed attack on the standing foes (the fight pause asks about that one).
 */
export function lapseOffer(view, { sheet, messages, index, text: message, meta }) {
    const standing = sheet.foes.filter(foe => foe.filled && foe.hurt > 0);
    if (!standing.length || meta?.storySuiteInteraction?.open?.kindId === FIGHT_KIND || knownFoeAction(message, sheet)) return null;
    let touched = -1, touch = null;
    for (let at = Math.min(index, messages.length - 1); at >= 0 && touched < 0; at -= 1) {
        if (messages[at]?.is_user || messages[at]?.is_system) continue;
        const kinds = (readRecord(messages[at])?.receipts ?? []).map(receipt => touchOf(receipt, standing));
        if (kinds.some(Boolean)) { touched = at; touch = kinds.includes('hand') ? 'hand' : 'story'; }
    }
    if (touch !== 'story') return null;
    const since = messages.slice(touched + 1, index + 1).filter(entry => !entry?.is_user && !entry?.is_system).length;
    if (since < LAPSE_REPLIES - 1) return null;
    const instances = view.state?.domains?.dataModules?.instances ?? {};
    const groups = standing.flatMap(foe => {
        const name = instances[foe.module]?.chat?.fields?.[`foe${foe.local}`];
        return text(name) ? [{ module: foe.module, local: foe.local, slot: foe.slot, name, label: (foe.name || name).slice(0, 80), count: foe.count }] : [];
    });
    return groups.length ? { type: BOARD_LAPSE, payload: { groups } } : null;
}

/** The prelude: clears each group that still stands under its name (the block's own clear kind, why "gone") and tells what lapsed. */
export function lapseCommand(ctx, payload) {
    const groups = groupsOf(payload);
    if (!groups) ctx.fail('INVALID', 'The lapsed foes are damaged.');
    const domain = ctx.draft('dataModules'), lapsed = [];
    for (const group of groups) {
        const fields = domain?.instances?.[group.module]?.chat?.fields;
        if (!fields || fold(fields[`foe${group.local}`]) !== fold(group.name) || !(Number(fields[`count${group.local}`]) > 0)) continue;
        if (clearFoes(domain, [{ ...group, filled: true }], [group.slot]).length) lapsed.push(`${group.label} ×${group.count}`);
    }
    if (!lapsed.length) return { summary: '', narrate: false, data: { lapsed: [] } };
    return {
        summary: `The fight with ${lapsed.join(', ')} was left unplayed on the board, so it lapsed: they withdrew or were left behind.`,
        narrate: true, data: { lapsed, keep: true, chain: true },
    };
}
