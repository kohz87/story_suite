// The `time.settle` command and the beforeGenerate hook that asks for it.

import { needsSettle, settle, settleSummary } from '../settle.js';
import { calendarOf, timeSettings } from '../records.js';
import { ownedKind, threadsOn } from '../../threads.js';
import { isInt } from './shared-int.js';

export const SETTLE = 'time.settle';

function fail(ctx, code, message) {
    ctx.fail(code, message);
    // ctx.fail throws; this is only for a ctx that does not.
    const error = new Error(message);
    error.code = code;
    throw error;
}

/*
 * The meta.rev this receipt will carry (SPEC §2.4, MODULES §F2 `ctx.rev`). Without `ctx.rev`,
 * the hook's `rev` (the head's meta.rev + 1: the cue is committed at once on that head), else
 * meta.rev + 1 through `ctx.read('meta')`, else 0.
 */
function receiptRev(ctx, given) {
    if (isInt(ctx?.rev)) return ctx.rev;
    if (isInt(given)) return given;
    try {
        const meta = ctx.read('meta');
        if (isInt(meta?.rev)) return meta.rev + 1;
    } catch {
        // No meta through ctx.read.
    }
    return 0;
}

/**
 * `time.settle` (cause `system`, from the hook). Payload `{ at?, rev? }`: the chat's length when
 * the hook ran (which reply the recap is for) and the revision the hook expects this receipt to
 * have (used only when the host gives no `ctx.rev`). Refused (`REFUSED`) while the story time is
 * not set.
 */
export function settleCommand(ctx, payload = {}) {
    const at = payload?.at ?? null;
    const given = payload?.rev ?? null;
    if (!(at === null || (isInt(at) && at >= 0))) fail(ctx, 'INVALID', 'time.settle: "at" must be the chat\'s length (a whole number).');
    if (!(given === null || (isInt(given) && given >= 0))) fail(ctx, 'INVALID', 'time.settle: "rev" must be a whole number.');
    const director = ctx.draft('director');
    if (!isInt(director?.time?.minutes)) fail(ctx, 'REFUSED', 'The story time is not set yet, so there is nothing to settle.');
    const settings = timeSettings(ctx.settings);
    const calendar = calendarOf(settings);
    const rev = receiptRev(ctx, given);
    // Each thread it closes is marked (Story Block's ctx.ifThere, SPEC §2.2 rule d): when the reply that
    // made the thread is deleted, replay passes over that closing and keeps the rest of the settle.
    const within = id => { if (typeof ctx.ifThere === 'function') ctx.ifThere('director', `/threads/${id}`); };
    const done = settle(director, { calendar, settings, rev, at, claim: key => ctx.claim(key), within, fights: ctx.fights !== false });
    // The receipt's words (told to the next reply) name only quests and hooks while the feature `story-director.threads` is off; the
    // closing itself is the same, so the state does not depend on the switch.
    const told = settleSummary(threadsOn(ctx) ? done.closed : done.closed.filter(entry => !ownedKind(entry.kind)), { calendar, now: done.now });
    return {
        summary: told || `Story time settled at ${calendar.format(done.now, { era: false })}.`,
        narrate: Boolean(told),
        data: {
            minutes: done.now,
            from: done.from,
            lapsed: done.closed.map(({ id, key, kind, reason }) => ({ id, key, kind, reason })),
            overdue: [...done.standing.overdue],
            pay: [...done.standing.pay],
            due: [...done.standing.due],
            recap: Boolean(done.recap && done.recap.rev === rev),
        },
    };
}

/** `beforeGenerate(view)`: `{ lines: [], commands: [time.settle] }` when there is something to settle. */
export function beforeGenerate(view) {
    const state = view?.state;
    if (!state?.domains?.director) return { lines: [], commands: [] };
    const settings = timeSettings(view.settings);
    const at = isInt(view?.chat?.length) ? view.chat.length : null;
    const calendar = calendarOf(settings);
    if (!needsSettle(state, { calendar, settings, at })) return { lines: [], commands: [] };
    const rev = isInt(state.meta?.rev) ? state.meta.rev + 1 : null;
    return { lines: [], commands: [{ type: SETTLE, payload: { at, rev } }] };
}
