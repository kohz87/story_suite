// What a Re-read keeps of the reply's last event: the reason kept and whether the event log is kept.
import { clean } from '../npc-meters-config.js';
import { cutWords, readEvent } from '../npc-meters-pacing.js';

/**
 * The reason a story line gave, as the reply's last event may keep it: a Re-read of a reply whose earlier read kept none (older code) keeps none.
 * Rule mark (reason length): a reason is kept to 240 characters, cut at a word with an ellipsis (cutWords). A Re-read of a reply whose earlier read
 * stored its reason cut to 80 (no stored why over 80) keeps writing that: the first 80 characters, as before. Only text is shaped (the evidence map passes).
 */
export const reasonKept = (ctx, key, reason) => {
    if (ctx.standing && !/"why"/.test(String(ctx.standing.domains?.npc?.npcs?.[key]?.lastEvent ?? ''))) return '';
    if (typeof reason !== 'string') return reason;
    const earlier = ctx.standing ? readEvent(ctx.standing.domains?.npc?.npcs?.[key]?.lastEvent) : null;
    const wide = !earlier || earlier.events.some(item => String(item.why ?? '').length > 80);
    return wide ? cutWords(reason) : clean(reason, 80);
};
/**
 * Rule mark (the last three changes): the reply's last event keeps a log of the earlier replies' events (npc-meters-pacing.js). A Re-read of a reply whose
 * earlier read wrote its event without that log (older code) writes it without one, as it was. A first read and a new reply always may.
 */
export const logKept = (ctx, key, reply) => {
    const earlier = ctx.standing ? readEvent(ctx.standing.domains?.npc?.npcs?.[key]?.lastEvent) : null;
    return !earlier || earlier.at !== reply || Array.isArray(earlier.prev);
};
