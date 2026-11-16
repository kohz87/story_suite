// Story Suite v2: how Story Suite fits the context size and what the reader is told when it does not.

import { DEFAULT_TAIL_BUDGET, MIN_TAIL_BUDGET } from './tail-budget.js';
import { DEFAULT_CONTEXT_SHARE, CONTEXT_SHARE_MIN, CONTEXT_SHARE_MAX } from './share-limits.js';

/**
 * How Story Suite fits the context: `context` = { size, reply, room } (the context size the reader set, the
 * reply's length or null, the tokens the prompt may take; turn.js contextRoom) or null when not known,
 * `staticTokens` the static part's size, `settings` the host settings ({ tailBudget, contextShare }),
 * `ownTokens` what modules send on their own (their `ownPrompt` hooks; 0 by default).
 * → { size, reply, room, percent, share, static, own, budget, tooSmall } or null (no context known: the
 * tail budget is the setting's).
 */
export function contextFit(context, staticTokens, settings = {}, ownTokens = 0) {
    const tail = Number.isInteger(settings?.tailBudget) && settings.tailBudget > 0 ? settings.tailBudget : DEFAULT_TAIL_BUDGET;
    const room = Number(context?.room);
    if (!Number.isFinite(room) || room <= 0) return null;
    const asked = settings?.contextShare;
    const percent = Number.isInteger(asked) ? Math.min(CONTEXT_SHARE_MAX, Math.max(CONTEXT_SHARE_MIN, asked)) : DEFAULT_CONTEXT_SHARE;
    const share = Math.floor(room * percent / 100);
    const own = Number.isFinite(Number(ownTokens)) && Number(ownTokens) > 0 ? Math.round(Number(ownTokens)) : 0;
    const budget = Math.min(tail, Math.max(MIN_TAIL_BUDGET, share - staticTokens - own));
    const size = Number.isFinite(Number(context.size)) && Number(context.size) > 0 ? Math.round(Number(context.size)) : Math.round(room);
    const reply = Number.isFinite(Number(context.reply)) && Number(context.reply) > 0 ? Math.round(Number(context.reply)) : null;
    return { size, reply, room: Math.round(room), percent, share, static: staticTokens, own, budget, tooSmall: staticTokens > share };
}

/** What the reader is told when the static part alone is over the share (`fit` from contextFit). */
export function contextNotice(fit) {
    const n = value => Math.round(Number(value) || 0).toLocaleString('en-US');
    return `Your context size (${n(fit?.size)} tokens) is too small for Story Suite's instructions (about ${n(fit?.static)} tokens). Raise the context size or turn features off.`;
}
