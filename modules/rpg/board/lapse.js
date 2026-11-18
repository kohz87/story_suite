// A standing fight the reader does not play lapses: foes a reply set stay on the Foes block while the reader types past the fight offer, and
// in the reply to the reader's LAPSE_REPLIES-th message that does not play it they are cleared by a prelude with a receipt (the foes withdrew
// or were left behind). The count is read from the stored replies (the latest reply that touched the Foes block, `rpg.foesTouched`, and the
// replies after it up to the reader's message), so a swipe counts what the first try did; the prelude is stored with the reply, so a Re-read,
// a reload and a rebuild keep it, and on a replay where the slot no longer holds that group it clears nothing.
import { FOES_TOUCH_QUERY } from '../names-parts/queries.js';
import { BOARD_LAPSE, LAPSE_REPLIES } from '../names-parts/lapse.js';
import { fold } from '../read-parts/match.js';
import { knownFoeAction } from './action-gate.js';
import { clearFoes } from './foe-writes.js';
import { FIGHT_KIND } from './port-session.js';

const text = (value, max = 80) => typeof value === 'string' && value.length > 0 && value.length <= max;
const groupsOf = payload => (Array.isArray(payload?.groups) && payload.groups.length > 0 && payload.groups.length <= 64
    && payload.groups.every(group => text(group?.module, 200) && Number.isSafeInteger(group.local) && group.local >= 1 && Number.isSafeInteger(group.slot)
        && text(group.name) && text(group.label) && Number.isSafeInteger(group.count)) ? payload.groups : null);

/**
 * The lapse prelude for this reply, or null. `sheet` is the head's sheet (readSheet), `messages` the chat, `index` the reader's message, `meta` the
 * chat's metadata. Nothing lapses while no reply set the foes (foes set by hand), while the reader has the fight open on the board, or when the
 * message is a typed attack on the standing foes (the fight pause asks about that one).
 */
export function lapseOffer(view, { sheet, messages, index, text: message, meta }) {
    const standing = sheet.foes.filter(foe => foe.filled && foe.hurt > 0);
    if (!standing.length || meta?.storySuiteInteraction?.open?.kindId === FIGHT_KIND || knownFoeAction(message, sheet)) return null;
    let touched = -1;
    try { touched = view.query?.(FOES_TOUCH_QUERY); } catch { return null; }
    if (!Number.isInteger(touched) || touched < 0 || touched > index) return null;
    const since = messages.slice(0, index + 1).filter((entry, at) => at > touched && !entry?.is_user && !entry?.is_system).length;
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
        summary: `The fight with ${lapsed.join(', ')} was never played on the board, so it lapsed: they withdrew or were left behind. Tell no blows.`,
        narrate: true, data: { lapsed, keep: true, chain: true },
    };
}
