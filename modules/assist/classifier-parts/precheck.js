// The `assist.precheck` command: its claim test and the handler that commits the check.

import { CHECK_KIND, claimKey } from './names.js';
import { checkLine } from './check-line.js';

/** Whether `state` already holds this message's pre-roll claim. */
export function claimed(state, key) {
    const claims = state?.meta?.claims;
    return Boolean(claims) && Object.hasOwn(claims, claimKey(key)) && claims[claimKey(key)] === true;
}

const KEY = /^\d{1,7}-[0-9a-z]{1,7}$/;

/**
 * `assist.precheck { key, line }`: the command the classifier's answer is committed through (see
 * the top of this file). Synchronous and pure apart from ctx, like every handler (SPEC §3.2).
 */
export function precheck(ctx, payload = {}) {
    const key = String(payload?.key ?? '');
    if (!KEY.test(key)) ctx.fail('INVALID', 'A pre-rolled check needs the key of the message it was made for.');
    const line = checkLine(payload?.line);
    if (!line) ctx.fail('INVALID', 'A pre-rolled check needs one check line with a skill and a difficulty.');
    if (!ctx.claim(claimKey(key))) ctx.fail('CLAIMED', 'This message has already been turned into a check.');
    const made = ctx.call(`capture.${CHECK_KIND}`, { ...line, index: 0, word: CHECK_KIND }) ?? {};
    const result = made.data?.v2?.result ?? made.data ?? {};
    const outcome = result.outcome;
    return {
        summary: String(made.summary ?? '').trim() || `A ${line.name} check is made.`,
        narrate: true,
        replan: true,
        data: {
            key,
            skill: line.name,
            dc: line.labels.dc,
            check: typeof result.check === 'string' ? result.check : null,
            rolled: typeof outcome === 'string',
            outcome: typeof outcome === 'string' ? outcome : null,
        },
    };
}
